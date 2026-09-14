import { useState } from "react";
import { FileText, LogIn, X } from "lucide-react";
import { webDocApi } from "../lib/docApi";
import { useUser } from "../lib/useUser";

const DISMISS_KEY = "fw_nudge_dismissed";

// Friendly conversion nudge for signed-out visitors of the demo.
export const SignInNudge = () => {
  const { user } = useUser();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(DISMISS_KEY) === "1");

  if (user !== null || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-r from-blue-500/15 to-emerald-500/15 border border-emerald-500/20 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4" data-testid="signin-nudge">
      <div className="bg-emerald-500/20 p-3 rounded-xl self-start">
        <FileText className="w-5 h-5 text-emerald-300" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">Sign in to save your documents</p>
        <p className="text-xs text-white/60 mt-0.5">
          Upload your Aadhaar or birth certificate once and FormWise fills this form from it — your documents stay private to your account.
        </p>
      </div>
      <button onClick={webDocApi.login} data-testid="nudge-signin-btn"
        className="flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-emerald-500 px-5 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow">
        <LogIn className="w-4 h-4" /> Sign in with Google
      </button>
      <button onClick={() => { sessionStorage.setItem(DISMISS_KEY, "1"); setDismissed(true); }} data-testid="nudge-dismiss-btn"
        aria-label="Dismiss" className="absolute top-2 right-2 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
