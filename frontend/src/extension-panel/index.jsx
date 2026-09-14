/* global chrome */
import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HelperPanel } from "../panel/HelperPanel";
import "./panel.css";

// Real extension: chrome.runtime.id exists. Mock page: fall back to the dev shim on the parent window.
const ext = () => (typeof chrome !== "undefined" && chrome.runtime?.id ? chrome : window.parent.chrome);
const post = (msg) => window.parent.postMessage({ source: "formwise-panel", ...msg }, "*");

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
  const hostname = useRef("");
  const requestSeq = useRef(0);
  const pendingContext = useRef({});

  const storageKey = () => `chat_${hostname.current}`;

  const fetchHelp = useCallback(async (info, formContext) => {
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
        case "FW_PAGE_CONTEXT": {
          const resolve = pendingContext.current[msg.requestId];
          if (resolve) {
            delete pendingContext.current[msg.requestId];
            resolve(msg.context);
          }
          break;
        }
        default:
      }
    },
    [fetchHelp]
  );
  useParentMessages(handleMessage);

  useEffect(() => {
    post({ type: "FW_READY" });
  }, []);

  const getPageContext = () =>
    new Promise((resolve) => {
      const requestId = String(Date.now() + Math.random());
      pendingContext.current[requestId] = resolve;
      post({ type: "FW_GET_PAGE_CONTEXT", requestId });
      setTimeout(() => {
        if (pendingContext.current[requestId]) {
          delete pendingContext.current[requestId];
          resolve({});
        }
      }, 1500);
    });

  const sendChat = async (message, history) => {
    const pageContext = await getPageContext();
    const res = await ext().runtime.sendMessage({
      type: "SEND_CHAT_MESSAGE",
      payload: { message, pageContext, chatHistory: history },
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
      activeField={field?.question || null}
      activeSection={field?.section || null}
      isLoading={isLoading}
      response={response}
      error={error}
      progress={progress}
      fieldOptions={field?.options}
      onApply={(value) => post({ type: "FW_APPLY", value })}
      chatMessages={chatMessages}
      onChatMessagesChange={persistChat}
      onSendChat={sendChat}
      onClose={() => post({ type: "FW_CLOSE" })}
      onJumpToField={(id) => post({ type: "FW_JUMP", id })}
    />
  );
};

createRoot(document.getElementById("root")).render(<ExtensionPanel />);
