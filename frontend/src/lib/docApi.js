import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Cookie-based (same-origin) client for the web demo. withCredentials sends the session cookie.
const http = axios.create({ baseURL: API, withCredentials: true });

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export const loginWithGoogle = (redirectPath = "/demo") => {
  const redirectUrl = window.location.origin + redirectPath;
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
};

export const exchangeSession = async (sessionId) => {
  const res = await http.post("/auth/session", null, { headers: { "X-Session-ID": sessionId } });
  return res.data;
};

// docApi passed into the shared panel so the panel stays host-agnostic.
export const webDocApi = {
  available: true,
  pollAfterLogin: false,
  async getUser() {
    try {
      const res = await http.get("/auth/me");
      return res.data;
    } catch {
      return null;
    }
  },
  login: () => loginWithGoogle("/demo"),
  async logout() {
    await http.post("/auth/logout");
  },
  async requirements(formId) {
    return (await http.get(`/forms/${formId}/requirements`)).data;
  },
  async list() {
    return (await http.get("/documents")).data;
  },
  async upload(file, onProgress) {
    const form = new FormData();
    form.append("file", file);
    const res = await http.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: (e) => onProgress?.(e.total ? Math.round((e.loaded / e.total) * 100) : 0),
    });
    return res.data;
  },
  async get(id) {
    return (await http.get(`/documents/${id}`)).data;
  },
  async remove(id) {
    return (await http.delete(`/documents/${id}`)).data;
  },
  async reclassify(id, documentType) {
    return (await http.patch(`/documents/${id}/classification`, { document_type: documentType })).data;
  },
  async autofillPreview(formId, fields) {
    return (await http.post("/autofill/preview", { form_id: formId, client: "web", fields })).data;
  },
  async autofillConfirm(formId, mappings) {
    return (await http.post("/autofill/confirm", { form_id: formId, client: "web", mappings })).data;
  },
};
