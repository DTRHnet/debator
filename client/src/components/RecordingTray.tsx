import { Headphones, X } from "lucide-react";
import { useEffect, useState } from "react";

export default function RecordingTray() {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<{ url?: string }>).detail;
      if (detail?.url) setUrl(detail.url);
    };
    window.addEventListener("debaterush:recording", receive);
    return () => window.removeEventListener("debaterush:recording", receive);
  }, []);

  if (!url) return null;
  return <aside className="fixed bottom-20 right-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-[#8ab4ff]/30 bg-[#0d1a2b]/95 p-3 shadow-2xl backdrop-blur-xl md:bottom-5 md:right-5" aria-label="Latest local recording"><div className="mb-2 flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-xs font-bold text-[#8ab4ff]"><Headphones className="h-3.5 w-3.5" /> LOCAL TURN RECORDING</span><button onClick={() => setUrl(null)} className="rounded-md p-1 text-slate-400 hover:bg-white/10 hover:text-white" aria-label="Dismiss local recording"><X className="h-3.5 w-3.5" /></button></div><audio className="h-8 w-full" controls src={url}>Your browser cannot play this local recording.</audio></aside>;
}
