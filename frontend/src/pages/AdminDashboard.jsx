import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ArrowLeft, Users, LogIn, Upload, Sparkles, ShieldAlert, Loader2, MessageSquare, HelpCircle } from "lucide-react";
import { AuthButton } from "../components/AuthButton";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LOGO = "/formwise-logo.png";
const RANGES = [7, 14, 30];

const StatCard = ({ Icon, label, value, sub, testId }) => (
  <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid={testId}>
    <div className="flex items-center gap-2 text-white/50 text-xs uppercase tracking-wider mb-3"><Icon className="w-4 h-4" /> {label}</div>
    <p className="text-3xl font-bold text-white">{value}</p>
    {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
  </div>
);

// Stacked daily bars: web (blue) + extension (emerald).
const DailyChart = ({ series, keyWeb, keyExt, title, testId }) => {
  const max = Math.max(1, ...series.map((d) => d[keyWeb] + d[keyExt]));
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid={testId}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-white">{title}</p>
        <div className="flex items-center gap-3 text-[11px] text-white/50">
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-blue-400 inline-block" /> Web</span>
          <span className="flex items-center gap-1"><i className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Extension</span>
        </div>
      </div>
      <div className="flex items-end gap-1 h-36">
        {series.map((d) => {
          const total = d[keyWeb] + d[keyExt];
          return (
            <div key={d.day} className="flex-1 flex flex-col justify-end h-full group relative" title={`${d.day}: web ${d[keyWeb]}, extension ${d[keyExt]}`}>
              <div className="w-full bg-emerald-400 rounded-t-sm" style={{ height: `${(d[keyExt] / max) * 100}%` }} />
              <div className="w-full bg-blue-400" style={{ height: `${(d[keyWeb] / max) * 100}%` }} />
              {total > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-white/60">{total}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-white/30 mt-2">
        <span>{series[0]?.day.slice(5)}</span><span>{series[series.length - 1]?.day.slice(5)}</span>
      </div>
    </div>
  );
};

const SimpleChart = ({ series, k, title, color, testId }) => {
  const max = Math.max(1, ...series.map((d) => d[k]));
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-5" data-testid={testId}>
      <p className="text-sm font-semibold text-white mb-4">{title}</p>
      <div className="flex items-end gap-1 h-24">
        {series.map((d) => (
          <div key={d.day} className="flex-1 flex flex-col justify-end h-full relative" title={`${d.day}: ${d[k]}`}>
            <div className={`w-full ${color} rounded-t-sm`} style={{ height: `${(d[k] / max) * 100}%` }} />
            {d[k] > 0 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[10px] text-white/60">{d[k]}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const [days, setDays] = useState(14);
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ok | forbidden | unauth | error

  useEffect(() => {
    setStatus("loading");
    axios.get(`${API}/admin/summary`, { params: { days }, withCredentials: true })
      .then((r) => { setData(r.data); setStatus("ok"); })
      .catch((e) => setStatus(e?.response?.status === 403 ? "forbidden" : e?.response?.status === 401 ? "unauth" : "error"));
  }, [days]);

  const t = data?.totals;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white" data-testid="admin-dashboard">
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-white/60 hover:text-white" data-testid="admin-back-link"><ArrowLeft className="w-5 h-5" /><span className="text-sm hidden sm:inline">Back</span></Link>
            <img src={LOGO} alt="FormWise" className="w-10 h-10 object-contain hidden sm:block" />
            <div>
              <h1 className="text-base sm:text-lg font-bold">Footfall Dashboard</h1>
              <p className="text-xs text-white/50 hidden sm:block">Private — admins only</p>
            </div>
          </div>
          <AuthButton />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {status === "loading" && <div className="flex justify-center py-20" data-testid="admin-loading"><Loader2 className="w-8 h-8 text-emerald-400 animate-spin" /></div>}

        {(status === "forbidden" || status === "unauth") && (
          <div className="max-w-md mx-auto bg-white/5 border border-white/10 rounded-3xl p-8 text-center mt-10" data-testid="admin-denied">
            <ShieldAlert className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">{status === "unauth" ? "Sign in required" : "Not authorised"}</h2>
            <p className="text-sm text-white/60">{status === "unauth" ? "Sign in with an admin Google account to view the dashboard." : "This account is not in the admin list (ADMIN_EMAILS)."}</p>
          </div>
        )}

        {status === "error" && <p className="text-center text-red-300" data-testid="admin-error">Couldn't load the dashboard. Please try again.</p>}

        {status === "ok" && data && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-white/60">Last <span className="text-white font-semibold">{data.days}</span> days · all counts, no personal data</p>
              <div className="flex bg-black/30 rounded-full p-0.5 border border-white/10" data-testid="admin-range">
                {RANGES.map((r) => (
                  <button key={r} onClick={() => setDays(r)} data-testid={`admin-range-${r}`}
                    className={`px-3 py-1 rounded-full text-xs font-bold ${days === r ? "bg-emerald-500 text-white" : "text-white/50 hover:text-white"}`}>{r}d</button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard Icon={Users} label="Sign-ups" value={t.signups} sub={`${t.users} users total`} testId="stat-signups" />
              <StatCard Icon={LogIn} label="Sign-ins" value={t.signins} testId="stat-signins" />
              <StatCard Icon={Upload} label="Uploads" value={t.uploads} sub={`${t.uploads_web} web · ${t.uploads_extension} extension`} testId="stat-uploads" />
              <StatCard Icon={Sparkles} label="Autofills" value={t.autofills} sub={`${t.autofills_web} web · ${t.autofills_extension} extension`} testId="stat-autofills" />
            </div>

            <div className="grid lg:grid-cols-2 gap-4">
              <DailyChart series={data.series} keyWeb="uploads_web" keyExt="uploads_extension" title="Document uploads per day" testId="chart-uploads" />
              <DailyChart series={data.series} keyWeb="autofills_web" keyExt="autofills_extension" title="Autofills per day" testId="chart-autofills" />
              <SimpleChart series={data.series} k="signups" title="Sign-ups per day" color="bg-violet-400" testId="chart-signups" />
              <SimpleChart series={data.series} k="signins" title="Sign-ins per day" color="bg-sky-400" testId="chart-signins" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <StatCard Icon={HelpCircle} label="Field help requests" value={t.form_help_requests} testId="stat-form-help" />
              <StatCard Icon={MessageSquare} label="Chat messages" value={t.chat_messages} testId="stat-chat" />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
