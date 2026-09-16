import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AppShell } from "./layout/AppShell";
import { AboutPage } from "./routes/AboutPage";
import { ComparePage } from "./routes/ComparePage";
import { ExplorePage } from "./routes/ExplorePage";
import { MapPage } from "./routes/MapPage";

const TRUSTED_PARENT_SUFFIXES = [
  ".plancatalyst.org",
  ".wix.com",
  ".wixsite.com",
  ".wixstudio.com",
  ".filesusr.com",
] as const;
const TRUSTED_ROUTES = new Set(["/map", "/explore", "/compare", "/about"]);

function trustedParentOrigin(): string | null {
  if (window.parent === window || !document.referrer) return null;
  try {
    const url = new URL(document.referrer);
    if (url.protocol !== "https:") return null;
    const trusted = TRUSTED_PARENT_SUFFIXES.some(
      (suffix) => url.hostname === suffix.slice(1) || url.hostname.endsWith(suffix),
    );
    return trusted ? url.origin : null;
  } catch {
    return null;
  }
}

// Handles all postMessage communication with the Wix parent frame.
// Only active when the app is embedded; window.parent === window when standalone.
function useIframeSync() {
  const location = useLocation();
  const navigate = useNavigate();
  const parentOrigin = trustedParentOrigin();

  // Send current document height on mount and whenever the document resizes.
  useEffect(() => {
    if (parentOrigin === null) return;
    const targetOrigin: string = parentOrigin;
    function sendHeight() {
      window.parent.postMessage(
        { type: "resize", height: document.documentElement.scrollHeight },
        targetOrigin,
      );
    }
    sendHeight();
    const observer = new ResizeObserver(sendHeight);
    observer.observe(document.documentElement);
    return () => observer.disconnect();
  }, [parentOrigin]);

  // Notify parent whenever the active route changes so it can store the hash.
  useEffect(() => {
    if (parentOrigin === null) return;
    const targetOrigin: string = parentOrigin;
    window.parent.postMessage({ type: "hashchange", hash: window.location.hash }, targetOrigin);
  }, [location, parentOrigin]);

  // Accept { type: "navigate", hash: "#/..." } from the parent to restore route.
  useEffect(() => {
    if (parentOrigin === null) return;
    const targetOrigin: string = parentOrigin;
    function handleMessage(e: MessageEvent) {
      if (e.source !== window.parent || e.origin !== targetOrigin) return;
      if (e.data?.type === "navigate" && typeof e.data.hash === "string") {
        const path = e.data.hash.startsWith("#") ? e.data.hash.slice(1) : e.data.hash;
        const route = path.split(/[?#]/, 1)[0];
        if (TRUSTED_ROUTES.has(route)) navigate(route, { replace: true });
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [navigate, parentOrigin]);
}

export function App() {
  useIframeSync();

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Navigate to="/map" replace />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/about" element={<AboutPage />} />
      </Routes>
    </AppShell>
  );
}
