import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { useT, docLabel } from "../i18n";
import { ConfidenceBadge, confidenceLevel } from "./shared";

// Dedupe alternatives by value; keep the strongest confidence and list every document that agrees.
export const distinctCandidates = (alternatives = []) => {
  const map = new Map();
  alternatives.forEach((a) => {
    const key = String(a.value).trim().toLowerCase();
    const cur = map.get(key);
    if (!cur) map.set(key, { ...a, sources: [a.source_document_type] });
    else {
      cur.sources.push(a.source_document_type);
      if (a.confidence > cur.confidence) Object.assign(cur, { confidence: a.confidence, source_document_id: a.source_document_id });
    }
  });
  return Array.from(map.values()).sort((a, b) => b.confidence - a.confidence);
};

// Dedicated mismatch card: two or more documents disagree; the user must pick before the field is included.
export const ConflictCard = ({ row, onPick, onValueChange, onApprove }) => {
  const { t } = useT();
  const candidates = distinctCandidates(row.alternatives);
  const chosen = row.resolved ? String(row.value).trim().toLowerCase() : null;

  return (
    <div className={`rounded-xl p-3 border ${row.resolved ? "bg-emerald-500/5 border-emerald-500/20" : "bg-amber-500/10 border-amber-500/30"}`}
      data-testid={`conflict-card-${row.field_id}`} data-resolved={row.resolved ? "true" : "false"}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-white/80">{row.label}</span>
        {row.resolved ? (
          <span className="flex items-center gap-1 text-[11px] text-emerald-300" data-testid={`conflict-resolved-${row.field_id}`}>
            <CheckCircle2 className="w-3 h-3" /> {t("conflict.resolved")}
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-amber-300"><AlertTriangle className="w-3 h-3" /> {t("review.mismatch")}</span>
        )}
      </div>

      <div className="space-y-1.5">
        {candidates.map((c, i) => {
          const active = chosen === String(c.value).trim().toLowerCase();
          return (
            <button key={i} onClick={() => onPick(c)} data-testid={`conflict-option-${row.field_id}-${i}`}
              className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-left transition-colors ${
                active ? "bg-emerald-500/20 border-emerald-500/50" : "bg-black/20 border-white/10 hover:border-white/30"}`}>
              <div className="min-w-0">
                <p className="text-sm text-white font-medium truncate">{c.value}</p>
                <p className="text-[10px] text-white/45 truncate">{c.sources.map((s) => docLabel(t, s)).join(" · ")}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <ConfidenceBadge level={confidenceLevel(c.confidence)} />
                <span className={`text-[11px] font-semibold ${active ? "text-emerald-300" : "text-blue-300"}`}>
                  {active ? "✓" : t("conflict.use")}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {row.resolved ? (
        <div className="mt-2 flex items-center gap-2">
          <input value={row.value || ""} onChange={(e) => onValueChange(e.target.value)} data-testid={`review-value-${row.field_id}`}
            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
          <input type="checkbox" checked={row.approved} onChange={(e) => onApprove(e.target.checked)}
            data-testid={`review-approve-${row.field_id}`} className="w-4 h-4 accent-emerald-500" />
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-amber-200/70">{t("conflict.pick")}</p>
      )}
    </div>
  );
};
