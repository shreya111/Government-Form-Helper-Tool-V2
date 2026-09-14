import { Link } from "react-router-dom";
import { CheckCircle2, LogIn, Loader2, ArrowRight, Chrome } from "lucide-react";
import { loginWithGoogle } from "../lib/docApi";
import { useUser } from "../lib/useUser";

const LOGO = "/formwise-logo.png";

// Landing page for the Chrome-extension sign-in flow: the extension opens this in a new tab,
// the session cookie is set here, and the extension panel picks it up automatically.
export default function ExtensionSignedIn() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-center px-6" data-testid="extension-signin-page">
      <div className="w-full max-w-md bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 text-center">
        <img src={LOGO} alt="FormWise" className="w-16 h-16 object-contain mx-auto mb-4" />
        {user === undefined ? (
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin mx-auto" data-testid="extension-signin-loading" />
        ) : user ? (
          <div data-testid="extension-signin-success">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">You're signed in</h1>
            <p className="text-sm text-white/60 mb-1" data-testid="extension-signin-user">{user.name || user.email}</p>
            <p className="text-sm text-white/60 mb-6">
              Go back to your Passport Seva tab — the FormWise panel will pick this up automatically and unlock document autofill.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-white/40 mb-6">
              <Chrome className="w-4 h-4" /> You can safely close this tab.
            </div>
            <Link to="/demo?tab=documents" data-testid="extension-signin-demo-link"
              className="inline-flex items-center gap-2 text-sm text-emerald-300 hover:text-emerald-200">
              Or manage your documents on the web <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div data-testid="extension-signin-failed">
            <h1 className="text-2xl font-bold mb-2">Sign in to FormWise</h1>
            <p className="text-sm text-white/60 mb-6">Sign in with Google to upload documents and autofill forms from the Chrome extension.</p>
            <button onClick={() => loginWithGoogle("/auth/extension")} data-testid="extension-signin-btn"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 text-sm font-semibold hover:shadow-lg hover:shadow-emerald-500/25 transition-shadow">
              <LogIn className="w-4 h-4" /> Sign in with Google
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
