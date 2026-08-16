import { Link, useLocation } from "wouter";
import { BookOpenText, Gauge, History, LogIn, Settings, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useEffect, useState } from "react";
import RecordingTray from "./RecordingTray";

const links = [
  { href: "/", label: "Debate", icon: Gauge },
  { href: "/history", label: "History", icon: History },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const updateStatus = () => setOnline(navigator.onLine);
    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);
    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#08111f] text-[#e8eef7] selection:bg-[#d6ff6b] selection:text-[#08111f]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08111f]/90 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3">
          <Link href="/" className="group flex items-center gap-2.5" aria-label="DebateRush home">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d6ff6b] text-[#08111f] shadow-[0_0_24px_rgba(214,255,107,.28)] transition-transform group-hover:rotate-6">
              <BookOpenText className="h-5 w-5" strokeWidth={2.6} />
            </span>
            <span className="font-display text-lg font-extrabold tracking-tight">Debate<span className="text-[#d6ff6b]">Rush</span></span>
          </Link>
          <div className="flex items-center gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold sm:flex ${online ? "bg-emerald-400/10 text-emerald-300" : "bg-amber-300/10 text-amber-200"}`}>
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "ONLINE" : "OFFLINE"}
            </span>
            {isAuthenticated ? (
              <span className="hidden max-w-32 truncate text-sm text-slate-300 sm:block">{user?.name || "Account"}</span>
            ) : (
              <Button onClick={() => startLogin()} size="sm" className="bg-[#d6ff6b] font-bold text-[#08111f] hover:bg-[#e2ff91]">
                <LogIn className="mr-1.5 h-4 w-4" /> Sign in
              </Button>
            )}
          </div>
        </div>
      </header>
      <main className="pb-24 md:pb-10">{children}</main>
      <RecordingTray />
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0d1a2b]/95 px-3 pb-[max(.65rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-between">
          {links.map(link => {
            const Icon = link.icon;
            const active = location === link.href;
            return (
              <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex min-w-16 flex-col items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-bold transition ${active ? "text-[#d6ff6b]" : "text-slate-400"}`}>
                <Icon className="h-4.5 w-4.5" />
                {link.label}
              </Link>
            );
          })}
        </div>
      </nav>
      <aside className="fixed bottom-5 left-5 hidden rounded-full border border-white/10 bg-white/[.04] p-1.5 text-xs text-slate-300 backdrop-blur md:flex">
        {links.map(link => {
          const Icon = link.icon;
          const active = location === link.href;
          return <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-2 rounded-full px-3 py-2 font-bold transition ${active ? "bg-[#d6ff6b] text-[#08111f]" : "hover:bg-white/10"}`}><Icon className="h-3.5 w-3.5" />{link.label}</Link>;
        })}
      </aside>
    </div>
  );
}
