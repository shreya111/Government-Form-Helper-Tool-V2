import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Trash2, LogIn, LogOut,
  ShieldCheck, Sparkles, ChevronRight, FileCheck2,
} from "lucide-react";
import { useT, docLabel } from "./i18n";
import { ConfidenceBadge, StatusPill, Empty, PrimaryButton, confidenceLevel } from "./documents/shared";
import { DocRequirements } from "./documents/DocRequirements";
import { ReviewScreen } from "./documents/ReviewScreen";

const consentKey = (user) => `fw_doc_consent_${user?.user_id || "anon"}`;
const POLL_MS = 2500;
const POLL_MAX_MS = 3 * 60 * 1000;

export const DocumentsTab = ({ docApi, formFields = [], formId = "passport_fresh", onAutofill }) => {
  const { t } = useT();
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out
  const [waiting, setWaiting] = useState(false); // sign-in opened in another tab; polling for the session
  const [consented, setConsented] = useState(false);
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState("list");
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const available = docApi?.available;

  const refresh = useCallback(async () => {
    if (!available || !user) return;
    try { setDocs(await docApi.list()); } catch { /* ignore */ }
  }, [available, user, docApi]);

  const loadUser = useCallback(async () => {
    const u = await docApi.getUser();
    setUser(u);
    if (u) { setConsented(localStorage.getItem(consentKey(u)) === "1"); setWaiting(false); }
    return u;
  }, [docApi]);

  useEffect(() => {
    if (!available) { setUser(null); return; }
    loadUser();
  }, [available, loadUser]);

  useEffect(() => { refresh(); }, [refresh]);

  // poll while any document is still being read
  useEffect(() => {
    if (!docs.some((d) => d.processing_status === "processing" || d.processing_status === "uploaded")) return;
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, [docs, refresh]);

  // poll for the session after sign-in was opened in another tab (extension flow)
  useEffect(() => {
    if (!waiting) return;
    const started = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - started > POLL_MAX_MS) { setWaiting(false); return; }
      const u = await loadUser();
      if (u) clearInterval(id);
    }, POLL_MS);
    return () => clearInterval(id);
  }, [waiting, loadUser]);

  const login = () => {
    docApi.login();
    if (docApi.pollAfterLogin) setWaiting(true);
  };

  const handleFiles = async (files) => {
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(true);
      setUploadPct(0);
      try {
        await docApi.upload(file, setUploadPct);
        await refresh();
      } catch (e) {
        setError(e?.response?.data?.detail || e?.detail || t("error.upload"));
      } finally {
        setBusy(false);
        setUploadPct(null);
      }
    }
  };

  const removeDoc = async (id) => {
    await docApi.remove(id);
    refresh();
  };

  const startReview = async () => {
    setError(null);
    setBusy(true);
    try {
      const fields = typeof formFields === "function" ? await formFields() : formFields;
      if (!fields?.length) { setError(t("error.nofields")); return; }
      const data = await docApi.autofillPreview(formId, fields);
      setPreview(data);
      setRows(
        data.mappings
          .filter((m) => m.status === "suggested")
          .map((m) => (m.conflict ? { ...m, approved: false, resolved: false } : { ...m, approved: true, resolved: true }))
      );
      setView("review");
      setResult(null);
    } catch {
      setError(t("error.preview"));
    } finally {
      setBusy(false);
    }
  };

  const applyAutofill = async () => {
    const approved = rows.filter((r) => r.approved && r.value);
    let filled = approved.length;
    try {
      const res = await onAutofill?.(approved.map((r) => ({ field_id: r.field_id, value: r.value })));
      if (typeof res?.filled === "number") filled = res.filled;
    } catch { /* host decides */ }
    try {
      await docApi.autofillConfirm(
        formId,
        approved.map((r) => ({
          field_id: r.field_id, value: r.value,
          normalization_key: r.normalization_key, source_document_id: r.source_document_id,
        }))
      );
    } catch { /* audit best-effort */ }
    setResult({ filled, needed: Math.max(0, (preview?.summary.total || 0) - filled) });
    setView("list");
  };

  // ---------- render gates ----------
  if (!available)
    return (
      <div className="flex-1 overflow-y-auto p-5" data-testid="documents-tab">
        <Empty Icon={Sparkles} title={t("unavailable.title")} sub={t("unavailable.sub")} />
      </div>
    );

  if (user === undefined)
    return <div className="flex-1 flex items-center justify-center" data-testid="documents-loading"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;

  if (!user)
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="documents-signin">
        {waiting ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 text-center" data-testid="signin-waiting">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto mb-3" />
            <h4 className="text-base font-bold text-white mb-1">{t("signin.waiting")}</h4>
            <p className="text-sm text-white/55 mb-4">{t("signin.waiting.body")}</p>
            <div className="flex gap-2">
              <button onClick={loadUser} data-testid="signin-check-btn"
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors">{t("signin.done")}</button>
              <button onClick={() => setWaiting(false)} data-testid="signin-cancel-btn"
                className="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/70 text-sm hover:bg-white/10 transition-colors">{t("common.cancel")}</button>
            </div>
          </div>
        ) : (
          <>
            <Empty Icon={LogIn} title={t("signin.title")} sub={t("signin.body")} />
            <PrimaryButton onClick={login} data-testid="doc-signin-btn">
              <LogIn className="w-4 h-4" /> {t("signin.button")}
            </PrimaryButton>
          </>
        )}
        <p className="text-[11px] text-white/40 text-center">{t("signin.nudge")}</p>
        <DocRequirements docApi={docApi} formId={formId} compact />
      </div>
    );

  if (!consented && docs.length === 0)
    return (
      <div className="flex-1 overflow-y-auto p-5" data-testid="documents-consent">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">{t("consent.title")}</h4>
          </div>
          <p className="text-sm text-white/60 mb-3">{t("consent.body")}</p>
          <p className="text-xs text-white/40 mb-4">{t("consent.note")}</p>
          <button onClick={() => { localStorage.setItem(consentKey(user), "1"); setConsented(true); }}
            data-testid="doc-consent-continue"
            className="w-full py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors">{t("consent.continue")}</button>
        </div>
      </div>
    );

  if (view === "review" && preview)
    return <ReviewScreen preview={preview} rows={rows} setRows={setRows} onBack={() => setView("list")} onApply={applyAutofill} />;

  // ---------- list screen ----------
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="documents-tab">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">{t("list.title")}</p>
        <button onClick={async () => { await docApi.logout(); setUser(null); setDocs([]); }}
          className="text-[11px] text-white/40 hover:text-white flex items-center gap-1" data-testid="doc-logout-btn">
          <LogOut className="w-3 h-3" /> {t("list.signout")}
        </button>
      </div>

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3" data-testid="autofill-result">
          <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t("result.filled", { n: result.filled })}</p>
          {result.needed > 0 && <p className="text-xs text-amber-300 mt-1">⚠ {t("result.needed", { n: result.needed })}</p>}
        </div>
      )}

      <DocRequirements docApi={docApi} formId={formId} docs={docs} />

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        data-testid="doc-dropzone"
        className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-colors ${dragOver ? "border-emerald-500/60 bg-emerald-500/5" : "border-white/15 hover:border-white/30"}`}
      >
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" multiple hidden
          data-testid="doc-file-input" onChange={(e) => handleFiles(e.target.files)} />
        <Upload className="w-8 h-8 text-white/40 mx-auto mb-2" />
        <p className="text-sm text-white/70 font-medium">{t("drop.title")}</p>
        <p className="text-xs text-white/40 mt-1">{t("drop.sub")}</p>
        {uploadPct !== null && (
          <div className="h-1.5 mt-3 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-emerald-500 transition-[width]" style={{ width: `${uploadPct}%` }} />
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300 text-sm" data-testid="doc-error">
          <AlertTriangle className="w-4 h-4" /> <span>{error}</span>
        </div>
      )}

      {docs.length === 0 && !busy ? (
        <Empty Icon={FileText} title={t("empty.title")} sub={t("empty.sub")} />
      ) : (
        <div className="space-y-2" data-testid="doc-list">
          {docs.map((d) => (
            <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-3" data-testid={`doc-card-${d.id}`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg"><FileText className="w-4 h-4 text-white/70" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{docLabel(t, d.document_type)}</span>
                    {d.processing_status === "processed" && d.classification_confidence > 0 &&
                      <ConfidenceBadge level={confidenceLevel(d.classification_confidence)} />}
                  </div>
                  <p className="text-[11px] text-white/40 truncate">{d.original_filename}</p>
                </div>
                <StatusPill status={d.processing_status} />
                <button onClick={() => removeDoc(d.id)} data-testid={`doc-remove-${d.id}`} className="p-1.5 hover:bg-white/10 rounded-lg text-white/40 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {d.processing_status === "processed" && d.fields?.length > 0 && (
                <div className="mt-2 pl-11 flex flex-wrap gap-1" data-testid={`doc-fields-${d.id}`}>
                  {d.fields.slice(0, 8).map((f) => (
                    <span key={f.field_name} className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300">{f.field_name.replace(/_/g, " ")}</span>
                  ))}
                </div>
              )}
              {d.processing_status === "failed" && <p className="mt-2 pl-11 text-[11px] text-red-300">{d.error}</p>}
            </div>
          ))}
        </div>
      )}

      {docs.some((d) => d.processing_status === "processed") && (
        <PrimaryButton onClick={startReview} disabled={busy} data-testid="review-autofill-btn">
          <FileCheck2 className="w-4 h-4" /> {t("list.review")} <ChevronRight className="w-4 h-4" />
        </PrimaryButton>
      )}
    </div>
  );
};
