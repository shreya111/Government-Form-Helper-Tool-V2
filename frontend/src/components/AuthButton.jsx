import { useEffect, useState } from "react";
import { LogIn, LogOut, Loader2 } from "lucide-react";
import { webDocApi } from "../lib/docApi";

const initials = (name = "", email = "") =>
  (name.trim() ? name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") : email[0] || "U").toUpperCase();

// App-wide Emergent Google sign-in control. Shows the signed-in user or a sign-in button.
export const AuthButton = () => {
  const [user, setUser] = useState(undefined); // undefined=loading, null=signed out

  useEffect(() => {
    webDocApi.getUser().then(setUser);
  }, []);

  if (user === undefined)
    return <Loader2 className="w-5 h-5 text-white/40 animate-spin" data-testid="auth-loading" />;

  if (!user)
    return (
      <button
        onClick={webDocApi.login}
        data-testid="signin-btn"
        className="flex items-center gap-2 bg-white/5 border border-white/10 hover:bg-white/10 px-4 py-2.5 rounded-full text-sm font-semibold text-white/90 transition-colors"
      >
        <LogIn className="w-4 h-4" />
        <span>Sign in</span>
      </button>
    );

  return (
    <div className="flex items-center gap-2" data-testid="auth-user">
      {user.picture ? (
        <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" className="w-8 h-8 rounded-full object-cover border border-white/10" />
      ) : (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white">
          {initials(user.name, user.email)}
        </div>
      )}
      <span className="hidden sm:block text-sm text-white/80 max-w-[140px] truncate" data-testid="auth-user-name">
        {user.name || user.email}
      </span>
      <button
        onClick={async () => { await webDocApi.logout(); setUser(null); }}
        data-testid="signout-btn"
        aria-label="Sign out"
        className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
      >
        <LogOut className="w-4 h-4" />
      </button>
    </div>
  );
};
