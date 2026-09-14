import { FileUp } from "lucide-react";
import { useT, docLabel } from "../i18n";

// "Upload Aadhaar to fill 5 more fields" — aggregated from the last autofill preview.
export const UploadHints = ({ hints = [], compact = false }) => {
  const { t } = useT();
  if (!hints.length) return null;
  return (
    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3" data-testid="upload-hints">
      <p className="text-[11px] font-semibold text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-1">
        <FileUp className="w-3 h-3" /> {t("hint.title")}
      </p>
      <ul className="space-y-1">
        {hints.slice(0, compact ? 2 : 4).map((h) => (
          <li key={h.document_type} className="text-sm text-white/80" data-testid={`upload-hint-${h.document_type}`}>
            {t(h.field_count === 1 ? "hint.docOne" : "hint.doc", { doc: docLabel(t, h.document_type), n: h.field_count })}
            {!compact && <span className="block text-[11px] text-white/40 truncate">{h.labels.join(" · ")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
};
