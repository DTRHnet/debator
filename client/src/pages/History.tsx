import { Link } from "wouter";
import { CalendarDays, ChevronRight, FileClock, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import type { DebateVerdict } from "@/types/debate";

function getVerdict(raw: string | null): DebateVerdict | null {
  if (!raw) return null;
  try { return JSON.parse(raw) as DebateVerdict; } catch { return null; }
}

export default function HistoryPage() {
  const { isAuthenticated, loading } = useAuth();
  const history = trpc.debate.list.useQuery(undefined, { enabled: isAuthenticated });

  if (!loading && !isAuthenticated) {
    return <div className="container max-w-2xl py-16"><section className="rounded-[2rem] border border-white/10 bg-white/[.04] p-8 text-center"><FileClock className="mx-auto mb-4 h-10 w-10 text-[#d6ff6b]" /><h1 className="font-display text-3xl font-extrabold">Your debate archive</h1><p className="mx-auto mt-3 max-w-md text-slate-400">Sign in to keep every transcript, verdict, and score tied to your DebateRush account.</p><Button onClick={() => startLogin()} className="mt-6 bg-[#d6ff6b] font-bold text-[#08111f] hover:bg-[#e2ff91]">Sign in to view history</Button></section></div>;
  }

  return <div className="container max-w-4xl py-8 md:py-14"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="eyebrow">PRIVATE SCORE HISTORY</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Your debate trail.</h1></div><Link href="/"><Button className="bg-[#d6ff6b] font-bold text-[#08111f] hover:bg-[#e2ff91]">Start a debate <ChevronRight className="ml-1 h-4 w-4" /></Button></Link></div>
    {history.isLoading ? <div className="grid gap-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-3xl bg-white/[.06]" />)}</div> : history.isError ? <section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[.055] px-6 py-12 text-center"><FileClock className="mx-auto mb-4 h-10 w-10 text-amber-200" /><h2 className="font-display text-2xl font-bold text-amber-50">Your archive could not load</h2><p className="mt-2 text-sm text-amber-50/75">Check your connection and try again. Your saved debate data has not been changed.</p><Button onClick={() => history.refetch()} variant="outline" className="mt-5 border-amber-200/30 text-amber-50 hover:bg-amber-100/10 hover:text-white">Try again</Button></section> : history.data?.length ? <div className="grid gap-3">{history.data.map(item => { const verdict = getVerdict(item.verdictJson); return <article key={item.id} className="group rounded-3xl border border-white/10 bg-white/[.035] p-5 transition hover:border-[#d6ff6b]/35 hover:bg-white/[.06]"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div className="min-w-0"><div className="mb-2 flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold tracking-[.12em] ${item.status === "complete" ? "bg-[#d6ff6b]/15 text-[#d6ff6b]" : "bg-amber-300/10 text-amber-200"}`}>{item.status === "complete" ? "JUDGED" : item.status.toUpperCase()}</span><span className="flex items-center gap-1 text-xs text-slate-500"><CalendarDays className="h-3.5 w-3.5" />{new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span></div><h2 className="max-w-2xl font-display text-lg font-bold leading-snug text-slate-100">{item.topic}</h2>{verdict && <p className="mt-2 text-sm leading-relaxed text-slate-400">{verdict.overallSummary}</p>}</div>{verdict ? <div className="flex shrink-0 items-center gap-2"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#4f8cff]/15 text-lg font-extrabold text-[#8ab4ff]">{verdict.pro.totalScore}</span><span className="text-xs font-bold text-slate-500">vs</span><span className="grid h-12 w-12 place-items-center rounded-2xl bg-[#ff856b]/15 text-lg font-extrabold text-[#ffab9b]">{verdict.con.totalScore}</span></div> : <span className="text-xs text-slate-500">No verdict yet</span>}</div></article>; })}</div> : <section className="rounded-[2rem] border border-dashed border-white/15 bg-white/[.025] px-6 py-16 text-center"><Trophy className="mx-auto mb-4 h-10 w-10 text-slate-500" /><h2 className="font-display text-2xl font-bold">No debates saved yet</h2><p className="mt-2 text-slate-400">Your judged sessions will appear here after your first round.</p></section>}
  </div>;
}
