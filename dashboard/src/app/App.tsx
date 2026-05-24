import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AppShell } from "./layout/AppShell";
import { AboutPage } from "./routes/AboutPage";
import { ComparePage } from "./routes/ComparePage";
import { ExplorePage } from "./routes/ExplorePage";
import { MapPage } from "./routes/MapPage";

// Handles all postMessage communication with the Wix parent frame.
// Only active when the app is embedded; window.parent === window when standalone.
function useIframeSync() {
  const location = useLocation();
  const navigate = useNavigate();

  // Send current document height on mount and whenever the document resizes.
  useEffect(() => {
    function sendHeight() {
      window.parent.postMessage(
        { type: "resize", height: document.documentElement.scrollHeight },
        "*"
      );
    }
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, []);

  // Notify parent whenever the active route changes so it can store the hash.
  useEffect(() => {
    window.parent.postMessage({ type: "hashchange", hash: window.location.hash }, "*");
  }, [location]);

  // Accept { type: "navigate", hash: "#/..." } from the parent to restore route.
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.data?.type === "navigate" && typeof e.data.hash === "string") {
        const path = e.data.hash.startsWith("#") ? e.data.hash.slice(1) : e.data.hash;
        navigate(path, { replace: true });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate]);
}

export function App() {
  useIframeSync();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/explore" replace />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  );
}
