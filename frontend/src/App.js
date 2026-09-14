import { useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import FormSimulator from "@/pages/FormSimulator";
import ExtensionSignedIn from "@/pages/ExtensionSignedIn";
import { exchangeSession } from "@/lib/docApi";

// Handles the Emergent Google redirect: {origin}/demo#session_id=... (web) or
// {origin}/auth/extension#session_id=... (opened from the Chrome extension). Exchange once, then land.
function AuthCallback() {
  const navigate = useNavigate();
  const location = useLocation();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const sid = params.get("session_id");
    const dest = location.pathname === "/auth/extension" ? "/auth/extension" : "/demo";
    (async () => {
      try {
        if (sid) await exchangeSession(sid);
      } catch (e) {
        // fall through; the destination shows the signed-out state
      }
      window.history.replaceState({}, "", dest);
      navigate(dest, { replace: true });
    })();
  }, [navigate, location.pathname]);
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0f172a", color: "#fff" }}>
      Signing you in…
    </div>
  );
}

function AppRouter() {
  const location = useLocation(); // read hash from here, not window.location.hash (not reactive)
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/demo" element={<FormSimulator />} />
      <Route path="/auth/extension" element={<ExtensionSignedIn />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </div>
  );
}

export default App;
