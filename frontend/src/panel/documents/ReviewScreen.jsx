import { X, Sparkles, AlertTriangle } from "lucide-react";
import { useT, docLabel } from "../i18n";
import { ConfidenceBadge, PrimaryButton } from "./shared";
import { ConflictCard } from "./ConflictCard";
import { UploadHints } from "./UploadHints";

// Review & approve screen: conflict cards first (must be resolved), then regular suggested rows.
export const ReviewScreen = ({ preview, rows, setRows, onBack, onApply }) => {
  const { t } = useT();
  const update = (fieldId, patch) => setRows((rs) => rs.map((r) => (r.field_id === fieldId ? { ...r, ...patch } : r)));
  const conflicts = rows.filter((r) => r.conflict);
  const plain = rows.filter((r) => !r.conflict);
  const approvedCount = rows.filter((r) => r.approved && r.value).length;

  return (
    <div className="flex-1 overflow-y-auto p-5 space-y-4" data-testid="documents-review">
      <button onClick={onBack} className="text-xs text-white/50 hover:text-white flex items-center gap-1" data-testid="review-back">
        <X className="w-3 h-3" /> {t("review.back")}
      </button>
      <div className="bg-gradient-to-r from-blue-500/10 to-emerald-500/10 border border-white/10 rounded-2xl p-4">
        <p className="text-sm font-bold text-white">{t("review.ready")}</p>
        <p className="text-xs text-white/60 mt-1" data-testid="review-summary">
          {t("review.summary", { suggested: preview.summary.suggested, total: preview.summary.total })}
          {preview.summary.missing > 0 && ` ${t("review.missing", { missing: preview.summary.missing })}`}
        </p>
      </div>

      {conflicts.length > 0 && (
        <div className="space-y-2" data-testid="conflict-section">
          <div className="flex items-start gap-2 px-1">
            <AlertTriangle className="w-4 h-4 text-amber-300 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-200">{t("conflict.title")}</p>
              <p className="text-[11px] text-white/55">{t("conflict.body", { n: conflicts.length })}</p>
            </div>
          </div>
          {conflicts.map((r) => (
            <ConflictCard key={r.field_id} row={r}
              onPick={(c) => update(r.field_id, { value: c.value, source_document_id: c.source_document_id, source_document_type: c.source_document_type, resolved: true, approved: true })}
              onValueChange={(v) => update(r.field_id, { value: v })}
              onApprove={(a) => update(r.field_id, { approved: a })} />
          ))}
        </div>
      )}

      {plain.map((r) => (
        <div key={r.field_id} className="bg-white/5 border border-white/10 rounded-xl p-3" data-testid={`review-row-${r.field_id}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/70">{r.label}</span>
            <div className="flex items-center gap-2">
              <ConfidenceBadge level={r.confidence_level} />
              <input type="checkbox" checked={r.approved} data-testid={`review-approve-${r.field_id}`}
                onChange={(e) => update(r.field_id, { approved: e.target.checked })} className="w-4 h-4 accent-emerald-500" />
            </div>
          </div>
          <input value={r.value || ""} data-testid={`review-value-${r.field_id}`}
            onChange={(e) => update(r.field_id, { value: e.target.value })}
            className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          <p className="text-[11px] text-white/40 mt-1">{t("review.source", { doc: docLabel(t, r.source_document_type) })}</p>
        </div>
      ))}

      <UploadHints hints={preview.summary.upload_hints} />

      <PrimaryButton onClick={onApply} disabled={approvedCount === 0} data-testid="review-apply-btn">
        <Sparkles className="w-4 h-4" /> {t("review.apply", { n: approvedCount })}
      </PrimaryButton>
      <p className="text-[11px] text-white/40 text-center">{t("review.note")}</p>
    </div>
  );
};
