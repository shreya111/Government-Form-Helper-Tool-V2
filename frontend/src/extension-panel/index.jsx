/* global chrome */
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelperPanel } from "../panel/HelperPanel";
import { readLang } from "../panel/i18n";
import "./panel.css";

// Real extension: chrome.runtime.id exists. Mock page: fall back to the dev shim on the parent window.
const ext = () => (typeof window.chrome !== "undefined" && window.chrome.runtime?.id ? window.chrome : window.parent.chrome);
const post = (msg) => window.parent.postMessage({ source: "formwise-panel", ...msg }, "*");

// API base: config.js (loaded by panel/index.html) in the packaged extension; same origin on the mock page.
const apiBase = () => window.FORMWISE_API_BASE_URL || `${window.location.origin}/api`;
const webOrigin = () => apiBase().replace(/\/api\/?$/, "");

// Pending request/response pairs with the content script (page context, form fields, batch results).
const pending = {};
const request = (type, extra, timeoutMs = 2000, fallback = {}) =>
  new Promise((resolve) => {
    const requestId = String(Date.now() + Math.random());
    pending[requestId] = resolve;
    post({ type, requestId, ...extra });
    setTimeout(() => {
      if (pending[requestId]) {
        delete pending[requestId];
        resolve(fallback);
      }
    }, timeoutMs);
  });
const settle = (msg, pick) => {
  const resolve = pending[msg.requestId];
  if (!resolve) return;
  delete pending[msg.requestId];
  resolve(pick(msg));
};

// Direct, cookie-authenticated calls from the extension page (host_permissions cover the API origin).
const api = async (path, init = {}) => {
  const res = await fetch(`${apiBase()}${path}`, { credentials: "include", ...init });
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try { detail = (await res.json()).detail || detail; } catch (_) {}
    const err = new Error(detail);
    err.detail = detail;
    err.status = res.status;
    throw err;
  }
  return res.json();
};
const json = (method, body) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

const uploadWithProgress = (file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiBase()}/documents/upload`);
    xhr.withCredentials = true;
    xhr.upload.onprogress = (e) => onProgress?.(e.lengthComputable ? Math.round((e.loaded / e.total) * 100) : 0);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve(JSON.parse(xhr.responseText));
      let detail = `Upload failed (${xhr.status})`;
      try { detail = JSON.parse(xhr.responseText).detail || detail; } catch (_) {}
      reject({ detail });
    };
    xhr.onerror = () => reject({ detail: "Upload failed. Please try again." });
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });

const extDocApi = {
  available: true,
  pollAfterLogin: true,
  async getUser() {
    try { return await api("/auth/me"); } catch { return null; }
  },
  login() {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirect = encodeURIComponent(`${webOrigin()}/auth/extension`);
    ext().runtime.sendMessage({ type: "OPEN_TAB", url: `https://auth.emergentagent.com/?redirect=${redirect}` });
  },
  async logout() { await api("/auth/logout", { method: "POST" }); },
  requirements: (formId) => api(`/forms/${formId}/requirements`),
  list: () => api("/documents"),
  upload: uploadWithProgress,
  get: (id) => api(`/documents/${id}`),
  remove: (id) => api(`/documents/${id}`, { method: "DELETE" }),
  reclassify: (id, documentType) => api(`/documents/${id}/classification`, json("PATCH", { document_type: documentType })),
  autofillPreview: (formId, fields) => api("/autofill/preview", json("POST", { form_id: formId, client: "extension", fields })),
  autofillConfirm: (formId, mappings) => api("/autofill/confirm", json("POST", { form_id: formId, client: "extension", mappings })),
};

const useParentMessages = (handler) => {
  useEffect(() => {
    const listener = (e) => {
      if (e.source !== window.parent || e.data?.source !== "formwise-content") return;
      handler(e.data);
    };
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, [handler]);
};

const ExtensionPanel = () => {
  const [field, setField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [formId, setFormId] = useState("passport_fresh");
  const hostname = useRef("");
  const requestSeq = useRef(0);
  const lastField = useRef(null);

  const storageKey = () => `chat_${hostname.current}`;

  const fetchHelp = useCallback(async (info, formContext) => {
    lastField.current = { info, formContext };
    const seq = ++requestSeq.current;
    setField(info);
    setIsLoading(true);
    setResponse(null);
    setError(null);
    try {
      const res = await ext().runtime.sendMessage({
        type: "GET_FORM_HELP",
        payload: {
          fieldLabel: info.question,
          fieldType: info.type,
          fieldOptions: (info.options || []).map((o) => o.label).join(", "),
          sectionContext: info.section || "",
          helpText: info.helpText || "",
          formContext,
          language: readLang(),
        },
      });
      if (seq !== requestSeq.current) return;
      if (res?.success) setResponse(res.data);
      else setError(res?.error || "Failed to get guidance");
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError("Unable to connect to AI service");
    } finally {
      if (seq === requestSeq.current) setIsLoading(false);
    }
  }, []);

  const handleMessage = useCallback(
    async (msg) => {
      switch (msg.type) {
        case "FW_INIT": {
          hostname.current = msg.hostname || "";
          if (msg.formId) setFormId(msg.formId);
          try {
            const stored = await ext().storage.local.get([storageKey()]);
            setChatMessages(stored[storageKey()] || []);
          } catch (_) {}
          break;
        }
        case "FW_FIELD":
          fetchHelp(msg.fieldInfo, msg.formContext);
          break;
        case "FW_PROGRESS":
          setProgress(msg.progress);
          break;
        case "FW_PAGE_CONTEXT":
          settle(msg, (m) => m.context);
          break;
        case "FW_FORM_FIELDS":
          settle(msg, (m) => m.fields);
          break;
        case "FW_APPLY_BATCH_RESULT":
          settle(msg, (m) => ({ filled: m.filled, total: m.total }));
          break;
        default:
      }
    },
    [fetchHelp]
  );
  useParentMessages(handleMessage);

  useEffect(() => {
    post({ type: "FW_READY" });
  }, []);

  const sendChat = async (message, history) => {
    const pageContext = await request("FW_GET_PAGE_CONTEXT", {}, 1500, {});
    const res = await ext().runtime.sendMessage({
      type: "SEND_CHAT_MESSAGE",
      payload: { message, pageContext, chatHistory: history, language: readLang() },
    });
    if (!res?.success) throw new Error(res?.error || "Chat failed");
    return res.data.response;
  };

  const persistChat = (messages) => {
    setChatMessages(messages);
    try {
      ext().storage.local.set({ [storageKey()]: messages });
    } catch (_) {}
  };

  return (
    <HelperPanel
      embedded
      logoSrc="../icons/logo.png"
      onLanguageChange={() => lastField.current && fetchHelp(lastField.current.info, lastField.current.formContext)}
      activeField={field?.question || null}
      activeSection={field?.section || null}
      isLoading={isLoading}
      response={response}
      error={error}
      progress={progress}
      fieldOptions={field?.options}
      onApply={(value) => post({ type: "FW_APPLY", value })}
      docApi={extDocApi}
      formFields={() => request("FW_GET_FORM_FIELDS", {}, 3000, [])}
      formId={formId}
      onAutofill={(items) => request("FW_APPLY_BATCH", { items }, 5000, { filled: items.length })}
      chatMessages={chatMessages}
      onChatMessagesChange={persistChat}
      onSendChat={sendChat}
      onClose={() => post({ type: "FW_CLOSE" })}
      onJumpToField={(id) => post({ type: "FW_JUMP", id })}
    />
  );
};

createRoot(document.getElementById("root")).render(<ExtensionPanel />);
