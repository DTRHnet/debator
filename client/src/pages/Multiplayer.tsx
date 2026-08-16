import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Clock3, LockKeyhole, Save, Users, Wifi, X } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { trpc } from "@/lib/trpc";
import { getMultiplayerAvailabilityState } from "@shared/multiplayer";

export default function MultiplayerPage() {
  const { isAuthenticated, user } = useAuth();
  const config = trpc.multiplayer.config.useQuery();
  const enabled = Boolean(config.data?.enabled);
  const availability = getMultiplayerAvailabilityState({ isLoading: config.isLoading, hasError: Boolean(config.error), enabled });
  const profile = trpc.multiplayer.profile.useQuery(undefined, { enabled: enabled && isAuthenticated });
  const saveProfile = trpc.multiplayer.saveProfile.useMutation({ onSuccess: () => profile.refetch() });
  const queueStatus = trpc.multiplayer.queueStatus.useQuery(undefined, { enabled: enabled && isAuthenticated, refetchInterval: 3000 });
  const enqueue = trpc.multiplayer.enqueue.useMutation({ onSuccess: () => queueStatus.refetch() });
  const cancelQueue = trpc.multiplayer.cancel.useMutation({ onSuccess: () => queueStatus.refetch() });
  const [matchCategory, setMatchCategory] = useState("");
  const [handle, setHandle] = useState("");
  const [isPublic, setIsPublic] = useState(true);
  const [preferredCategory, setPreferredCategory] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setHandle(profile.data.handle);
    setIsPublic(profile.data.isPublic);
    setPreferredCategory(profile.data.preferredCategory ?? "");
  }, [profile.data]);

  if (availability === "loading") {
    return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-300" role="status">Loading multiplayer availability…</div></div>;
  }

  if (availability === "error") {
    return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-8 text-center text-rose-100" role="alert">Multiplayer availability could not be checked. Please refresh and try again.</div></div>;
  }

  if (availability === "disabled") {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to Debate</Link>
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-8 shadow-2xl md:p-12">
          <div className="mb-6 grid h-14 w-14 place-items-center rounded-2xl bg-[#d6ff6b] text-[#08111f]"><Users className="h-7 w-7" /></div>
          <p className="mb-3 text-xs font-black uppercase tracking-[.24em] text-[#d6ff6b]">Multiplayer beta</p>
          <h1 className="font-display text-4xl font-black tracking-tight text-white md:text-5xl">Debate with another mind.</h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-slate-300">Live matching, private rooms, synchronized speaking turns, ratings, and leaderboards are being prepared as an additive next phase. Your solo practice remains available now.</p>
          <div className="mt-8 flex items-center gap-3 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><LockKeyhole className="h-5 w-5 text-[#d6ff6b]" /> Multiplayer is disabled by the server feature flag.</div>
          <Link href="/" className="mt-8 inline-flex"><Button className="bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]">Practice solo</Button></Link>
        </section>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
        <section className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center md:p-12">
          <Users className="mx-auto h-12 w-12 text-[#d6ff6b]" />
          <h1 className="mt-5 font-display text-4xl font-black text-white">Join multiplayer</h1>
          <p className="mx-auto mt-4 max-w-md leading-7 text-slate-300">Sign in with your DebateRush account so rooms, ratings, and match history stay attached to you.</p>
          <Button onClick={() => startLogin()} className="mt-8 bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]">Sign in to continue</Button>
        </section>
      </div>
    );
  }

  if (profile.isLoading) {
    return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-300" role="status">Loading your player card…</div></div>;
  }

  if (profile.error) {
    return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-8 text-center text-rose-100" role="alert">Your multiplayer profile could not be loaded. Please refresh and try again.</div></div>;
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 md:py-16">
      <div className="mb-10 flex items-start justify-between gap-4">
        <div><p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff6b]">Player identity</p><h1 className="mt-2 font-display text-4xl font-black tracking-tight text-white">Set up your player card.</h1><p className="mt-3 text-slate-300">Your profile is ready for matching when rooms arrive.</p></div>
        <div className="hidden items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300 sm:flex"><Wifi className="h-3.5 w-3.5" /> Authenticated</div>
      </div>
      <section className="rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl md:p-8">
        <div className="mb-7 flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#d6ff6b] text-[#08111f]"><Users className="h-5 w-5" /></div><div><p className="font-bold text-white">{user?.name ?? "Debater"}</p><p className="text-sm text-slate-400">Public multiplayer identity</p></div></div>
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2"><Label htmlFor="handle">Player handle</Label><Input id="handle" value={handle} onChange={event => setHandle(event.target.value)} maxLength={24} placeholder="calm-debater" className="border-white/10 bg-black/10 text-white" /><p className="text-xs text-slate-500">3–24 letters, numbers, spaces, hyphens, or underscores.</p></div>
          <div className="space-y-2"><Label htmlFor="category">Preferred category</Label><Input id="category" value={preferredCategory} onChange={event => setPreferredCategory(event.target.value)} maxLength={64} placeholder="Society (optional)" className="border-white/10 bg-black/10 text-white" /></div>
        </div>
        <div className="mt-7 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/10 p-4"><div><p className="font-bold text-white">Show me on public leaderboards</p><p className="mt-1 text-sm text-slate-400">You can change this later.</p></div><Switch checked={isPublic} onCheckedChange={setIsPublic} aria-label="Show me on public leaderboards" /></div>
        <Button disabled={!handle.trim() || saveProfile.isPending} onClick={() => saveProfile.mutate({ handle, isPublic, preferredCategory: preferredCategory.trim() || null })} className="mt-7 bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]"><Save className="mr-2 h-4 w-4" /> {saveProfile.isPending ? "Saving…" : "Save player card"}</Button>
        {saveProfile.isSuccess && <p className="mt-3 text-sm font-bold text-emerald-300">Saved. Your identity is ready for the next multiplayer phase.</p>}
        {saveProfile.error && <p className="mt-3 text-sm font-bold text-rose-300">{saveProfile.error.message}</p>}
      </section>

      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6 shadow-2xl md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div><p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff6b]">Quick Match</p><h2 className="mt-2 font-display text-2xl font-black text-white">Find a compatible opponent.</h2><p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">The server matches compatible rulesets, starts with a narrow rating window, and expands it gradually. This first increment prepares the queue and room handoff.</p></div>
          <Users className="hidden h-7 w-7 text-[#d6ff6b] sm:block" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
          <div className="space-y-2"><Label htmlFor="match-category">Category preference</Label><Input id="match-category" value={matchCategory} onChange={event => setMatchCategory(event.target.value)} maxLength={64} placeholder="Any category" className="border-white/10 bg-black/10 text-white" /></div>
          {queueStatus.data?.status === "queued" ? <Button variant="outline" onClick={() => cancelQueue.mutate()} disabled={cancelQueue.isPending} className="border-white/15 bg-transparent text-white hover:bg-white/10"><X className="mr-2 h-4 w-4" /> {cancelQueue.isPending ? "Leaving…" : "Leave queue"}</Button> : <Button onClick={() => enqueue.mutate({ ruleset: { mode: "quick_match", topicSource: matchCategory.trim() ? "category" : "random", category: matchCategory.trim() || null, timerSeconds: 60, roundCount: 1, inputMode: "either", aiAnalysis: true }, category: matchCategory.trim() || null })} disabled={enqueue.isPending} className="bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]"><Users className="mr-2 h-4 w-4" /> {enqueue.isPending ? "Finding…" : "Find opponent"}</Button>}
        </div>
        {queueStatus.data?.status === "queued" && <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[#d6ff6b]/20 bg-[#d6ff6b]/5 p-4 text-sm text-[#e4ff9d]" role="status"><Clock3 className="h-5 w-5" /> Searching for a compatible player…</div>}
        {enqueue.data?.roomId && <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200" role="status">Match found. Room <span className="font-mono">{enqueue.data.roomId}</span> is ready for the next room-control phase.</div>}
        {(enqueue.error || cancelQueue.error || queueStatus.error) && <p className="mt-4 text-sm font-bold text-rose-300">{enqueue.error?.message || cancelQueue.error?.message || queueStatus.error?.message}</p>}
      </section>
    </div>
  );
}
