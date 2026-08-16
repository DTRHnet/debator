import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const register = () => {
        void navigator.serviceWorker.register("/sw.js").then(registration => {
          const assets = performance.getEntriesByType("resource")
            .map(entry => entry.name)
            .filter(url => new URL(url).origin === window.location.origin);
          registration.active?.postMessage({ type: "CACHE_ASSETS", assets });
          registration.installing?.postMessage({ type: "CACHE_ASSETS", assets });
          registration.waiting?.postMessage({ type: "CACHE_ASSETS", assets });
        });
      };
      window.addEventListener("load", register, { once: true });
    }
  }, []);
  return null;
}
