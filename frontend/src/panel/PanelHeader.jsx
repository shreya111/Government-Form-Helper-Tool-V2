import { X } from "lucide-react";

export const PanelHeader = ({ logoSrc, onClose }) => (
  <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-5 py-4 flex items-center justify-between border-b border-white/10">
    <div className="flex items-center gap-3">
      <img src={logoSrc} alt="FormWise Logo" className="w-11 h-11 object-contain" />
      <div>
        <h3 className="text-sm font-bold text-white">FormWise</h3>
        <p className="text-xs text-white/50">AI-Powered Assistance</p>
      </div>
    </div>
    <button
      onClick={onClose}
      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
      data-testid="close-panel-btn"
      aria-label="Close panel"
    >
      <X className="w-5 h-5 text-white/60" />
    </button>
  </div>
);
