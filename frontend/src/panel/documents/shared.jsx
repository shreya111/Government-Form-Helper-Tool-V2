import { Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { useT } from "../i18n";

export const confidenceLevel = (c) => (c >= 0.85 ? "high" : c >= 0.6 ? "medium" : "low");

export const ConfidenceBadge = ({ level }) => {
  const { t } = useT();
  const cls = {
    high: "bg-emerald-500/20 text-emerald-300",
    medium: "bg-amber-500/20 text-amber-300",
    low: "bg-red-500/20 text-red-300",
  }[level] || "bg-red-500/20 text-red-300";
  return <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${cls}`}>{t(`conf.${level}`) }</span>;
};

export const StatusPill = ({ status }) => {
  const { t } = useT();
  if (status === "processing" || status === "uploaded")
    return <span className="flex items-center gap-1 text-xs text-blue-300"><Loader2 className="w-3 h-3 animate-spin" />{t("status.reading")}</span>;
  if (status === "processed")
    return <span className="flex items-center gap-1 text-xs text-emerald-300"><CheckCircle2 className="w-3 h-3" />{t("status.ready")}</span>;
  return <span className="flex items-center gap-1 text-xs text-red-300"><AlertTriangle className="w-3 h-3" />{t("status.failed")}</span>;
};

export const Empty = ({ Icon, title, sub }) => (
  <div className="flex flex-col items-center justify-center py-10 text-center">
    <div className="bg-white/5 p-5 rounded-2xl mb-4"><Icon className="w-11 h-11 text-white/30" /></div>
    <h4 className="text-lg font-bold text-white mb-2">{title}</h4>
    <p className="text-sm text-white/50 max-w-[260px]">{sub}</p>
  </div>
);

export const PrimaryButton = ({ children, className = "", ...props }) => (
  <button
    {...props}
    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-white text-sm font-semibold disabled:opacity-50 hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow ${className}`}
  >
    {children}
  </button>
);
