import { Circle, MessageSquare, FileText } from "lucide-react";
import { useT } from "./i18n";

const TABS = [
  { id: "field-help", Icon: Circle },
  { id: "documents", Icon: FileText },
  { id: "chat", Icon: MessageSquare },
];

export const PanelTabs = ({ activeTab, onChange }) => {
  const { t } = useT();
  return (
    <div className="flex bg-black/20 border-b border-white/10">
      {TABS.map(({ id, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          data-testid={`tab-${id}`}
          className={`flex-1 flex items-center justify-center gap-2 px-3 py-3 text-sm font-semibold transition-colors border-b-2 ${
            activeTab === id
              ? "border-emerald-500 text-emerald-400 bg-emerald-500/10"
              : "border-transparent text-white/40 hover:text-white/60 hover:bg-white/5"
          }`}
        >
          <Icon className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{t(`tab.${id}`)}</span>
        </button>
      ))}
    </div>
  );
};
