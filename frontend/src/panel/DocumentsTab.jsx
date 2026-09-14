import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, Trash2, LogIn, LogOut,
  ShieldCheck, Sparkles, X, ChevronRight, FileCheck2,
} from "lucide-react";

const DOC_LABELS = {
  AADHAAR: "Aadhaar", PAN: "PAN Card", BIRTH_CERTIFICATE: "Birth Certificate",
  DRIVING_LICENCE: "Driving Licence", VOTER_ID: "Voter ID", PASSPORT: "Passport",
  CLASS_10_CERTIFICATE: "Class 10 Certificate", ADDRESS_PROOF: "Address Proof",
  UTILITY_BILL: "Utility Bill", OTHER: "Other Document", UNKNOWN: "Unrecognised",
};
const CONSENT_KEY = "fw_doc_consent";

const ConfidenceBadge = ({ level }) => {
  const map = {
    high: ["bg-emerald-500/20 text-emerald-300", "High"],
    medium: ["bg-amber-500/20 text-amber-300", "Medium"],
    low: ["bg-red-500/20 text-red-300", "Low"],
  };
  const [cls, label] = map[level] || map.low;
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cls}`}>{label}</span>;
};

const StatusPill = ({ status }) => {
  if (status === "processing" || status === "uploaded")
    return <span className="flex items-center gap-1 text-xs text-blue-300"><Loader2 className="w-3 h-3 animate-spin" />Reading…</span>;
  if (status === "processed")
    return <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="w-3 h-3" />Ready</span>;
  return <span className="flex items-center gap-1 text-xs text-red-300"><AlertTriangle className="w-3 h-3" />Failed</span>;
};

const Empty = ({ Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-14 text-center">
    <div className="bg-white/5 p-5 rounded-2xl mb-4"><Icon className="w-11 h-11 text-white/30" /></div>
    <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
    <p className="text-sm text-white/50 max-w-[260px]">{sub}</p>
  </div>
);

export const DocumentsTab = ({ docApi, formFields = [], formId = "passport_fresh", onAutofill }) => {
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out
  const [consented, setConsented] = useState(() => localStorage.getItem(CONSENT_KEY) === "1");
  const [docs, setDocs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [uploadPct, setUploadPct] = useState(null);
  const [error, setError] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [view, setView] = useState("list");
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]); // review rows with approved/value
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const available = docApi?.available;

  const refresh = useCallback(async () => {
    if (!available || !user) return;
    try { setDocs(await docApi.list()); } catch { /* ignore */ }
  }, [available, user, docApi]);

  useEffect(() => {
    if (!available) { setUser(null); return; }
    docApi.getUser().then(setUser);
  }, [available, docApi]);

  useEffect(() => { refresh(); }, [refresh]);

  // poll while any document is still being read
  useEffect(() => {
    if (!docs.some((d) => d.processing_status === "processing" || d.processing_status === "uploaded")) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [docs, refresh]);

  const handleFiles = async (files) => {
    setError(null);
    for (const file of Array.from(files)) {
      setBusy(true);
      setUploadPct(0);
      try {
        await docApi.upload(file, setUploadPct);
        await refresh();
      } catch (e) {
        setError(e?.response?.data?.detail || "We couldn't upload this document. Please try again.");
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
      const data = await docApi.autofillPreview(formId, formFields);
      setPreview(data);
      setRows(
        data.mappings
          .filter((m) => m.status === "suggested")
          .map((m) => ({ ...m, approved: true, value: m.value }))
      );
      setView("review");
      setResult(null);
    } catch (e) {
      setError("Couldn't prepare autofill. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const applyAutofill = async () => {
    const approved = rows.filter((r) => r.approved && r.value);
    onAutofill?.(approved.map((r) => ({ field_id: r.field_id, value: r.value })));
    try {
      await docApi.autofillConfirm(
        formId,
        approved.map((r) => ({
          field_id: r.field_id, value: r.value,
          normalization_key: r.normalization_key, source_document_id: r.source_document_id,
        }))
      );
    } catch { /* audit best-effort */ }
    setResult({ filled: approved.length, needed: (preview?.summary.total || 0) - approved.length });
    setView("list");
  };

  // ---------- render gates ----------
  if (!available)
    return (
      <div className="flex-1 overflow-y-auto p-5" data-testid="documents-tab">
        <Empty Icon={Sparkles} title="Document Autofill" sub="Open the FormWise web demo to upload your documents and autofill this form." />
      </div>
    );

  if (user === undefined)
    return <div className="flex-1 flex items-center justify-center" data-testid="documents-loading"><Loader2 className="w-6 h-6 text-emerald-400 animate-spin" /></div>;

  if (!user)
    return (
      <div className="flex-1 overflow-y-auto p-5" data-testid="documents-signin">
        <Empty Icon={LogIn} title="Sign in to continue" sub="Sign in with Google so FormWise can securely process your documents and remember them only for you." />
        <button onClick={docApi.login} data-testid="doc-signin-btn"
          className="mt-2 w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow">
          <LogIn className="w-4 h-4" /> Sign in with Google
        </button>
      </div>
    );

  if (!consented && docs.length === 0)
    return (
      <div className="flex-1 overflow-y-auto p-5" data-testid="documents-consent">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-white">Your documents contain personal information</h4>
          </div>
          <p className="text-sm text-white/60 mb-3">
            FormWise uses uploaded documents only to identify information relevant to this form. You control what gets used, and your documents are temporary unless you choose to save them.
          </p>
          <p className="text-xs text-white/40 mb-4">Do not upload documents you do not want processed.</p>
          <div className="flex gap-2">
            <button onClick={() => { localStorage.setItem(CONSENT_KEY, "1"); setConsented(true); }}
              data-testid="doc-consent-continue"
              className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-400 transition-colors">Continue</button>
          </div>
        </div>
      </div>
    );

  // ---------- review screen ----------
  if (view === "review" && preview)
    return (
      <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="documents-review">
        <button onClick={() => setView("list")} className="text-xs text-white/50 hover:text-white flex items-center gap-1" data-testid="review-back">
          <X className="w-3 h-3" /> Back to documents
        </button>
        <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-white/10 rounded-2xl p-4">
          <p className="text-sm font-bold text-white">Ready to autofill</p>
          <p className="text-xs text-white/60 mt-1" data-testid="review-summary">
            FormWise found information for {preview.summary.suggested} of {preview.summary.total} fields.
            {preview.summary.missing > 0 && ` ${preview.summary.missing} need your input.`}
          </p>
        </div>

        {rows.map((r, idx) => (
          <div key={r.field_id} className="bg-white/5 border border-white/10 rounded-xl p-3" data-testid={`review-row-${r.field_id}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-white/70">{r.label}</span>
              <div className="flex items-center gap-2">
                <ConfidenceBadge level={r.confidence_level} />
                <input type="checkbox" checked={r.approved} data-testid={`review-approve-${r.field_id}`}
                  onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, approved: e.target.checked } : x))}
                  className="w-4 h-4 accent-emerald-500" />
              </div>
            </div>
            <input value={r.value || ""} data-testid={`review-value-${r.field_id}`}
              onChange={(e) => setRows((rs) => rs.map((x, i) => i === idx ? { ...x, value: e.target.value } : x))}
              className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
            <p className="text-[11px] text-white/40 mt-1">Source: {DOC_LABELS[r.source_document_type] || r.source_document_type}</p>
            {r.conflict && (
              <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20" data-testid={`review-conflict-${r.field_id}`}>
                <p className="text-[11px] text-amber-300 flex items-center gap-1 mb-1"><AlertTriangle className="w-3 h-3" /> Different values found — please verify</p>
                <div className="flex flex-wrap gap-1">
                  {r.alternatives.map((a, i) => (
                    <button key={i} onClick={() => setRows((rs) => rs.map((x, j) => j === idx ? { ...x, value: a.value } : x))}
                      className="text-[11px] px-2 py-1 rounded bg-white/10 text-white/80 hover:bg-white/20">
                      {a.value} · {DOC_LABELS[a.source_document_type] || a.source_document_type}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}

        <button onClick={applyAutofill} disabled={!rows.some((r) => r.approved && r.value)} data-testid="review-apply-btn"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow">
          <Sparkles className="w-4 h-4" /> Autofill {rows.filter((r) => r.approved && r.value).length} approved fields
        </button>
        <p className="text-[11px] text-white/40 text-center">These fields will be populated using information you approved.</p>
      </div>
    );

  // ---------- list screen ----------
  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="documents-tab">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-white/50 uppercase tracking-wider">Your documents</p>
        <button onClick={docApi.logout && (async () => { await docApi.logout(); setUser(null); })}
          className="text-[11px] text-white/40 hover:text-white flex items-center gap-1" data-testid="doc-logout-btn">
          <LogOut className="w-3 h-3" /> Sign out
        </button>
      </div>

      {result && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3" data-testid="autofill-result">
          <p className="text-sm text-emerald-300 flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {result.filled} fields populated</p>
          {result.needed > 0 && <p className="text-xs text-amber-300 mt-1">⚠ {result.needed} fields still need your attention</p>}
        </div>
      )}

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
        <p className="text-sm text-white/70 font-medium">Drag & drop or click to upload</p>
        <p className="text-xs text-white/40 mt-1">PDF, JPG or PNG</p>
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
        <Empty Icon={FileText} title="No documents yet" sub="Upload your supporting documents and FormWise can help fill the form using information found in them." />
      ) : (
        <div className="space-y-2" data-testid="doc-list">
          {docs.map((d) => (
            <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-3" data-testid={`doc-card-${d.id}`}>
              <div className="flex items-center gap-3">
                <div className="bg-white/10 p-2 rounded-lg"><FileText className="w-4 h-4 text-white/70" /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{DOC_LABELS[d.document_type] || "Document"}</span>
                    {d.processing_status === "processed" && d.classification_confidence > 0 &&
                      <ConfidenceBadge level={d.classification_confidence >= 0.85 ? "high" : d.classification_confidence >= 0.6 ? "medium" : "low"} />}
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
        <button onClick={startReview} disabled={busy} data-testid="review-autofill-btn"
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow">
          <FileCheck2 className="w-4 h-4" /> Review &amp; Autofill <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
