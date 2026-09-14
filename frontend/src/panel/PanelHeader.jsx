import { X } from "lucide-react";
import { useT } from "./i18n";

const LangToggle = () => {
  const { lang, setLang, t } = useT();
  return (
    <div className="flex items-center bg-black/30 rounded-full p-0.5 border border-white/10" role="group" aria-label={t("lang.switch")} data-testid="lang-toggle">
      {[["en", "EN"], ["hi", "हिं"]].map(([code, label]) => (
        <button key={code} onClick={() => setLang(code)} data-testid={`lang-${code}`} aria-pressed={lang === code}
          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-colors ${
            lang === code ? "bg-emerald-500 text-white" : "text-white/50 hover:text-white"}`}>
          {label}
        </button>
      ))}
    </div>
  );
};

export const PanelHeader = ({ logoSrc, onClose }) => {
  const { t } = useT();
  return (
    <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-white/10">
      <div className="flex items-center gap-3">
        <img src={logoSrc} alt="FormWise Logo" className="w-11 h-11 object-contain" />
        <div>
          <h3 className="text-sm font-bold text-white">FormWise</h3>
          <p className="text-xs text-white/50">{t("header.subtitle")}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <LangToggle />
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          data-testid="close-panel-btn"
          aria-label="Close panel"
        >
          <X className="w-5 h-5 text-white/60" />
        </button>
      </div>
    </div>
  );
};
