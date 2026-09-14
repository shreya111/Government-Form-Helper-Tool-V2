import { useState } from "react";
import { ChevronDown, CheckCircle2, ListChecks, MapPin } from "lucide-react";

export const ProgressBar = ({ progress, onJumpToField }) => {
  const [open, setOpen] = useState(false);
  if (!progress || !progress.total) return null;

  const { total, completed, missing = [] } = progress;
  const pct = Math.round((completed / total) * 100);
  const allDone = completed >= total;

  return (
    <div className="border-b border-white/10 bg-black/10" data-testid="progress-bar">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full px-5 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
        data-testid="progress-toggle"
      >
        {allDone ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
        ) : (
          <ListChecks className="w-4 h-4 text-blue-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">Required fields</span>
            <span className="text-xs font-bold text-white" data-testid="progress-count">
              {completed}/{total}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${allDone ? "bg-emerald-500" : "bg-gradient-to-r from-blue-500 to-emerald-500"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
        {!allDone && (
          <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>

      {open && !allDone && (
        <div className="px-5 pb-3 max-h-44 overflow-y-auto space-y-1" data-testid="progress-missing-list">
          {missing.map((f) => (
            <button
              key={f.id}
              onClick={() => onJumpToField?.(f.id)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              data-testid="progress-missing-item"
            >
              <MapPin className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="truncate flex-1">{f.label}</span>
              {f.section && <span className="text-white/30 truncate max-w-[110px]">{f.section}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
