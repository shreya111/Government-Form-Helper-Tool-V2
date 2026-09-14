import { useEffect, useRef } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import LandingPage from "@/pages/LandingPage";
import FormSimulator from "@/pages/FormSimulator";
import { exchangeSession } from "@/lib/docApi";

// Handles the Emergent Google redirect: {origin}/demo#session_id=... — exchange once, then land on /demo.
function AuthCallback() {
  const navigate = useNavigate();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const sid = params.get("session_id");
    (async () => {
      try {
        if (sid) await exchangeSession(sid);
      } catch (e) {
        // fall through to demo; DocumentsTab will show the signed-out state
      }
      window.history.replaceState({}, "", "/demo");
      navigate("/demo", { replace: true });
    })();
  }, [navigate]);
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
