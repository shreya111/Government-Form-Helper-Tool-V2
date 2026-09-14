import { useEffect, useState } from "react";
import { CheckCircle2, Circle, ClipboardList } from "lucide-react";
import { useT, docLabel } from "../i18n";

// "Documents that help this form": form-requirement layer merged with what the user has uploaded.
export const DocRequirements = ({ docApi, formId, docs = [], compact = false }) => {
  const { t, lang } = useT();
  const [req, setReq] = useState(null);

  useEffect(() => {
    if (!docApi?.requirements) return;
    docApi.requirements(formId).then(setReq).catch(() => setReq(null));
  }, [docApi, formId]);

  if (!req?.documents?.length) return null;
  const uploadedTypes = new Set(docs.filter((d) => d.processing_status === "processed").map((d) => d.document_type));

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4" data-testid="doc-requirements">
      <div className="flex items-center gap-2 mb-3">
        <ClipboardList className="w-4 h-4 text-blue-300" />
        <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">{t("req.title")}</p>
      </div>
      <ul className="space-y-1.5">
        {req.documents.map((d) => {
          const have = uploadedTypes.has(d.document_type);
          return (
            <li key={d.document_type} className="flex items-start gap-2" data-testid={`req-${d.document_type}`}
              data-uploaded={have ? "true" : "false"}>
              {have
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                : <Circle className="w-4 h-4 text-white/25 mt-0.5 flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${have ? "text-emerald-200" : "text-white/85"}`}>{docLabel(t, d.document_type)}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${d.priority === "recommended" ? "bg-blue-500/20 text-blue-300" : "bg-white/10 text-white/50"}`}>
                    {t(d.priority === "recommended" ? "req.recommended" : "req.optional")}
                  </span>
                </div>
                {!compact && <p className="text-[11px] text-white/45">{d.purpose?.[lang] || d.purpose?.en}</p>}
              </div>
              <span className={`text-[10px] whitespace-nowrap ${have ? "text-emerald-300" : "text-white/35"}`}>
                {t(have ? "req.uploaded" : "req.missing")}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
