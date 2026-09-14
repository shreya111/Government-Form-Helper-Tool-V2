import { useNavigate } from "react-router-dom";
import { LogIn, LogOut, Loader2, FileText, ChevronDown, BarChart3 } from "lucide-react";
import { webDocApi } from "../lib/docApi";
import { useUser } from "../lib/useUser";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "./ui/dropdown-menu";

const initials = (name = "", email = "") =>
  (name.trim() ? name.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("") : email[0] || "U").toUpperCase();

const Avatar = ({ user, size = "w-8 h-8" }) =>
  user.picture ? (
    <img src={user.picture} alt={user.name} referrerPolicy="no-referrer" className={`${size} rounded-full object-cover border border-white/10`} />
  ) : (
    <div className={`${size} rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-xs font-bold text-white`}>
      {initials(user.name, user.email)}
    </div>
  );

// App-wide Emergent Google sign-in control: sign-in button, or avatar with a profile dropdown.
export const AuthButton = () => {
  const { user, setUser } = useUser();
  const navigate = useNavigate();

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/10 transition-colors outline-none" data-testid="auth-user" aria-label="Account menu">
          <Avatar user={user} />
          <span className="hidden sm:block text-sm text-white/80 max-w-[140px] truncate" data-testid="auth-user-name">
            {user.name || user.email}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-white/40" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8}
        className="w-64 bg-slate-900/95 backdrop-blur-xl border-white/10 text-white p-2 rounded-2xl shadow-2xl" data-testid="profile-menu">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar user={user} size="w-10 h-10" />
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate" data-testid="profile-name">{user.name || "Signed in"}</p>
            <p className="text-xs text-white/50 truncate" data-testid="profile-email">{user.email}</p>
          </div>
        </div>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem onSelect={() => navigate("/demo?tab=documents")} data-testid="profile-documents-link"
          className="gap-2 rounded-lg cursor-pointer text-white/80 focus:bg-white/10 focus:text-white">
          <FileText className="w-4 h-4" /> My documents
        </DropdownMenuItem>
        {user.is_admin && (
          <DropdownMenuItem onSelect={() => navigate("/admin")} data-testid="profile-admin-link"
            className="gap-2 rounded-lg cursor-pointer text-white/80 focus:bg-white/10 focus:text-white">
            <BarChart3 className="w-4 h-4" /> Footfall dashboard
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onSelect={async () => { await webDocApi.logout(); setUser(null); }} data-testid="signout-btn"
          className="gap-2 rounded-lg cursor-pointer text-white/80 focus:bg-white/10 focus:text-white">
          <LogOut className="w-4 h-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
