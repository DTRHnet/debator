import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, CheckCircle2, ChevronRight, CircleDotDashed, Clipboard, Clock3, Coffee, Crown, Headphones, Mic, Pause, Play, RefreshCw, Settings2, Sparkles, Timer, Trophy, Volume2, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { useSpeechCapture } from "@/hooks/useSpeechCapture";
import { queueOfflineDebate, readOfflineQueue, removeQueuedDebate, type QueuedDebate } from "@/lib/offlineQueue";
import { appendRecentTopic, chooseTopic, TOPIC_CATEGORIES, type DebateTopic } from "@/lib/topics";
import { trpc } from "@/lib/trpc";
import type { DebateVerdict } from "@/types/debate";
import { toast } from "sonner";

type Stage = "setup" | "round" | "judging" | "results";
type Side = "pro" | "con";
type RoundState = { round: number; side: Side; transcript: string };

const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const RECENT_TOPIC_IDS_KEY = "debaterush-recent-topic-ids";

function pickTopic(category: string, avoidIds: string[] | string = []) {
  const suppliedIds = Array.isArray(avoidIds) ? avoidIds : [avoidIds];
  return chooseTopic(category, suppliedIds);
}

function ScoreCard({ side, score }: { side: Side; score: DebateVerdict["pro"] }) {
  const isPro = side === "pro";
  const color = isPro ? "text-[#8ab4ff] bg-[#4f8cff]/15 border-[#4f8cff]/20" : "text-[#ffab9b] bg-[#ff856b]/15 border-[#ff856b]/20";
  return <section className={`rounded-3xl border p-5 ${color}`}><div className="flex items-start justify-between"><div><p className="text-xs font-extrabold tracking-[.16em] uppercase opacity-75">{side} position</p><h3 className="mt-1 font-display text-xl font-extrabold">{score.totalScore}<span className="text-sm opacity-65"> / 100</span></h3></div><span className="rounded-xl bg-[#08111f]/45 px-2.5 py-1 text-xs font-bold">{side === "pro" ? "PRO" : "CON"}</span></div><div className="mt-5 grid grid-cols-2 gap-2 text-xs"><span>Clarity <b className="float-right">{score.clarity}</b></span><span>Argument <b className="float-right">{score.argumentStrength}</b></span><span>Structure <b className="float-right">{score.structure}</b></span><span>Delivery <b className="float-right">{score.delivery}</b></span></div><div className="mt-5 border-t border-current/15 pt-4"><p className="text-xs font-bold uppercase tracking-wider opacity-70">Keep doing</p><ul className="mt-2 space-y-1.5 text-sm leading-snug">{score.strengths.map(item => <li key={item}>• {item}</li>)}</ul><p className="mt-4 text-xs font-bold uppercase tracking-wider opacity-70">Next focus</p><ul className="mt-2 space-y-1.5 text-sm leading-snug">{score.improvements.map(item => <li key={item}>• {item}</li>)}</ul></div></section>;
}

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const settingsQuery = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const judge = trpc.debate.judge.useMutation();
  const saveOffline = trpc.debate.saveOffline.useMutation();
  const [stage, setStage] = useState<Stage>("setup");
  const [category, setCategory] = useState("All");
  const [topic, setTopic] = useState<DebateTopic>(() => pickTopic("All"));
  const [recentTopicIds, setRecentTopicIds] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState("");
  const [useCustomTopic, setUseCustomTopic] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [roundCount, setRoundCount] = useState(1);
  const [round, setRound] = useState(1);
  const [side, setSide] = useState<Side>("pro");
  const [remaining, setRemaining] = useState(60);
  const [isTurnLive, setIsTurnLive] = useState(false);
  const [turnDraft, setTurnDraft] = useState("");
  const [rounds, setRounds] = useState<RoundState[]>([]);
  const [verdict, setVerdict] = useState<DebateVerdict | null>(null);
  const [resultMessage, setResultMessage] = useState("");
  const currentSessionRef = useRef<string | null>(null);
  const speech = useSpeechCapture(setTurnDraft);

  useEffect(() => {
    if (settingsQuery.data && stage === "setup") {
      setTimerSeconds(settingsQuery.data.timerSeconds);
      setRoundCount(settingsQuery.data.roundCount);
      setRemaining(settingsQuery.data.timerSeconds);
    }
  }, [settingsQuery.data, stage]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_TOPIC_IDS_KEY) ?? "[]");
      if (Array.isArray(stored)) setRecentTopicIds(stored.filter((id): id is string => typeof id === "string").slice(-8));
    } catch {
      setRecentTopicIds([]);
    }
  }, []);

  useEffect(() => {
    setRecentTopicIds(current => {
      const updated = appendRecentTopic(current, topic.id);
      try { localStorage.setItem(RECENT_TOPIC_IDS_KEY, JSON.stringify(updated)); } catch { /* local rotation is optional */ }
      return updated;
    });
  }, [topic.id]);

  const selectTopic = useCallback((nextCategory: string) => {
    const nextTopic = chooseTopic(nextCategory, [...recentTopicIds, topic.id]);
    const updatedRecentIds = appendRecentTopic([...recentTopicIds, topic.id], nextTopic.id);
    setTopic(nextTopic);
    setRecentTopicIds(updatedRecentIds);
    try { localStorage.setItem(RECENT_TOPIC_IDS_KEY, JSON.stringify(updatedRecentIds)); } catch { /* selection remains available */ }
  }, [recentTopicIds, topic.id]);

  const activeTopic = useMemo(() => ({ text: useCustomTopic ? customTopic.trim() : topic.text, source: useCustomTopic ? "custom" as const : "random" as const }), [customTopic, topic.text, useCustomTopic]);
  const proTranscript = useMemo(() => rounds.filter(item => item.side === "pro").map(item => `Round ${item.round}: ${item.transcript}`).join("\n\n"), [rounds]);
  const conTranscript = useMemo(() => rounds.filter(item => item.side === "con").map(item => `Round ${item.round}: ${item.transcript}`).join("\n\n"), [rounds]);

  const syncQueuedDebates = useCallback(async () => {
    if (!isAuthenticated || !navigator.onLine) return;
    for (const queued of readOfflineQueue()) {
      try {
        await saveOffline.mutateAsync({ ...queued, status: "pending" });
        removeQueuedDebate(queued.id);
      } catch { break; }
    }
  }, [isAuthenticated, saveOffline]);

  useEffect(() => {
    void syncQueuedDebates();
    window.addEventListener("online", syncQueuedDebates);
    return () => window.removeEventListener("online", syncQueuedDebates);
  }, [syncQueuedDebates]);

  const startSession = () => {
    if (!activeTopic.text || activeTopic.text.length < 3) { toast.error("Pick a topic or write your own first."); return; }
    currentSessionRef.current = crypto.randomUUID();
    setRound(1); setSide("pro"); setRemaining(timerSeconds); setRounds([]); setTurnDraft(""); setVerdict(null); setResultMessage(""); setStage("round");
  };

  const startTurn = async () => {
    setIsTurnLive(true);
    await speech.start(turnDraft);
  };

  const evaluateOrQueue = useCallback(async (finalRounds: RoundState[]) => {
    const transcriptFor = (position: Side) => finalRounds.filter(item => item.side === position).map(item => `Round ${item.round}: ${item.transcript}`).join("\n\n");
    const queued: QueuedDebate = {
      id: currentSessionRef.current ?? crypto.randomUUID(), topic: activeTopic.text, topicSource: activeTopic.source,
      timerSeconds, roundCount, proTranscript: transcriptFor("pro"), conTranscript: transcriptFor("con"), queuedAt: Date.now(),
    };
    if (!navigator.onLine) {
      queueOfflineDebate(queued); setResultMessage("Saved on this device. Reconnect while signed in to add this debate to your account history."); setStage("results"); return;
    }
    if (!isAuthenticated) {
      queueOfflineDebate(queued); setResultMessage("Your debate is saved on this device. Sign in and add an OpenRouter key to receive a server-side verdict."); setStage("results"); return;
    }
    setStage("judging");
    try {
      const result = await judge.mutateAsync(queued);
      if (result.status === "complete") {
        setVerdict(result.verdict); setResultMessage("Your account history has been updated with this verdict.");
      } else {
        setResultMessage(result.message);
      }
    } catch (error) {
      queueOfflineDebate(queued);
      setResultMessage(error instanceof Error ? `We saved your debate locally. ${error.message}` : "We saved your debate locally. AI evaluation can be retried after reconnecting.");
    } finally { setStage("results"); }
  }, [activeTopic, isAuthenticated, judge, roundCount, timerSeconds]);

  const finishTurn = useCallback(() => {
    const captured = speech.stop();
    setIsTurnLive(false);
    const transcript = (captured || turnDraft).trim();
    const nextRounds = [...rounds, { round, side, transcript }];
    setRounds(nextRounds); setTurnDraft("");
    if (side === "pro") { setSide("con"); setRemaining(timerSeconds); return; }
    if (round < roundCount) { setRound(value => value + 1); setSide("pro"); setRemaining(timerSeconds); return; }
    void evaluateOrQueue(nextRounds);
  }, [evaluateOrQueue, round, roundCount, rounds, side, speech, timerSeconds, turnDraft]);

  useEffect(() => {
    if (!isTurnLive || remaining <= 0) return;
    const timer = window.setInterval(() => setRemaining(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isTurnLive, remaining]);

  useEffect(() => {
    if (isTurnLive && remaining === 0) finishTurn();
  }, [finishTurn, isTurnLive, remaining]);

  const reset = () => { speech.stop(); setIsTurnLive(false); setStage("setup"); setRounds([]); setTurnDraft(""); setRemaining(timerSeconds); };
  const shareResult = async () => {
    const message = verdict ? `DebateRush verdict: ${verdict.winner === "draw" ? "draw" : `${verdict.winner.toUpperCase()} wins`} on “${activeTopic.text}”. Pro ${verdict.pro.totalScore} – Con ${verdict.con.totalScore}.` : `I just completed a DebateRush round: “${activeTopic.text}”.`;
    try { await navigator.clipboard.writeText(message); toast.success("Result copied to your clipboard."); } catch { toast.error("Could not copy the result."); }
  };

  if (stage === "setup") return <div className="container max-w-6xl py-7 md:py-12"><section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_82%_16%,rgba(79,140,255,.22),transparent_25%),radial-gradient(circle_at_12%_80%,rgba(214,255,107,.11),transparent_24%),#0d1a2b] px-6 py-9 md:px-12 md:py-16"><div className="absolute right-[-8rem] top-[-6rem] h-72 w-72 rounded-full border border-[#d6ff6b]/20" /><div className="relative max-w-3xl"><p className="eyebrow"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-[#d6ff6b] align-middle shadow-[0_0_16px_#d6ff6b]" /> STRUCTURED DEBATE PRACTICE</p><h1 className="mt-5 font-display text-5xl font-extrabold leading-[.93] tracking-tight md:text-7xl">Think fast.<br />Speak <span className="text-[#d6ff6b]">sharper.</span></h1><p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 md:text-lg">Choose a question, argue both sides under pressure, then get a focused AI verdict when your account is ready. No endless feed. Just better thinking.</p><div className="mt-8 flex flex-wrap gap-3"><span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-300"><Clock3 className="h-3.5 w-3.5 text-[#d6ff6b]" /> {timerSeconds}s per turn</span><span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-300"><Crown className="h-3.5 w-3.5 text-[#d6ff6b]" /> {roundCount} round{roundCount > 1 ? "s" : ""} per side</span><span className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-300"><Headphones className="h-3.5 w-3.5 text-[#d6ff6b]" /> Mic or typed argument</span></div></div></section><section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]"><div className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6 md:p-8"><div className="flex items-center justify-between gap-4"><div><p className="eyebrow">01 / THE MOTION</p><h2 className="mt-2 font-display text-2xl font-bold">Choose your question</h2></div><button onClick={() => { setUseCustomTopic(false); setTopic(pickTopic(category, topic.id)); }} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[.035] text-[#d6ff6b] transition hover:rotate-90 hover:bg-white/[.1]" aria-label="Shuffle topic"><RefreshCw className="h-5 w-5" /></button></div><div className="mt-6 flex gap-2 overflow-x-auto pb-1 no-scrollbar">{TOPIC_CATEGORIES.map(item => <button key={item} aria-pressed={category === item && !useCustomTopic} onClick={() => { setCategory(item); setUseCustomTopic(false); setTopic(pickTopic(item, topic.id)); }} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${category === item && !useCustomTopic ? "bg-[#d6ff6b] text-[#08111f]" : "bg-white/[.05] text-slate-400 hover:bg-white/[.1] hover:text-white"}`}>{item}</button>)}</div><button aria-pressed={!useCustomTopic} onClick={() => setUseCustomTopic(false)} className={`mt-6 w-full rounded-2xl border p-5 text-left transition ${!useCustomTopic ? "border-[#d6ff6b]/55 bg-[#d6ff6b]/[.06]" : "border-white/10 hover:bg-white/[.04]"}`}><span className="text-xs font-bold tracking-[.14em] text-[#d6ff6b]">RANDOM MOTION · {topic.category.toUpperCase()}</span><p className="mt-2 font-display text-xl font-bold leading-snug text-slate-100">{topic.text}</p></button><button aria-pressed={useCustomTopic} onClick={() => setUseCustomTopic(true)} className={`mt-3 w-full rounded-2xl border p-4 text-left transition ${useCustomTopic ? "border-[#8ab4ff]/60 bg-[#4f8cff]/[.06]" : "border-white/10 hover:bg-white/[.04]"}`}><span className="flex items-center gap-2 text-sm font-bold text-slate-200"><WandSparkles className="h-4 w-4 text-[#8ab4ff]" /> Bring your own motion</span>{useCustomTopic && <Input autoFocus value={customTopic} onClick={event => event.stopPropagation()} onChange={event => setCustomTopic(event.target.value)} placeholder="e.g. Should cities offer free public transit?" className="mt-3 border-white/10 bg-[#08111f] text-white placeholder:text-slate-600" />}</button></div><aside className="rounded-[2rem] border border-white/10 bg-[#0d1a2b] p-6 md:p-8"><p className="eyebrow">02 / FORMAT</p><h2 className="mt-2 font-display text-2xl font-bold">Set the pace</h2><div className="mt-7"><Label className="text-slate-400">Time per speaking turn</Label><div className="mt-2 grid grid-cols-4 gap-2">{[30, 45, 60, 90].map(value => <button key={value} aria-pressed={timerSeconds === value} onClick={() => { setTimerSeconds(value); setRemaining(value); }} className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${timerSeconds === value ? "border-[#d6ff6b] bg-[#d6ff6b] text-[#08111f]" : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.08]"}`}>{value}s</button>)}</div></div><div className="mt-6"><Label className="text-slate-400">Rounds for each side</Label><div className="mt-2 grid grid-cols-3 gap-2">{[1, 2, 3].map(value => <button key={value} aria-pressed={roundCount === value} onClick={() => setRoundCount(value)} className={`rounded-xl border px-2 py-2.5 text-sm font-bold transition ${roundCount === value ? "border-[#d6ff6b] bg-[#d6ff6b] text-[#08111f]" : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.08]"}`}>{value} {value === 1 ? "round" : "rounds"}</button>)}</div></div><Button onClick={startSession} className="mt-8 h-12 w-full bg-[#d6ff6b] text-base font-extrabold text-[#08111f] hover:bg-[#e2ff91]">Start debate <ArrowRight className="ml-2 h-5 w-5" /></Button><p className="mt-4 text-center text-xs leading-relaxed text-slate-500">{!loading && !isAuthenticated ? "Practice works without an account. Sign in to save history and request AI verdicts." : "Your default timer and round settings can be changed anytime."}</p>{isAuthenticated && <Link href="/settings" className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-[#d6ff6b] hover:underline"><Settings2 className="h-3.5 w-3.5" /> Update account defaults</Link>}</aside></section><section className="mt-5 grid gap-3 md:grid-cols-3">{[["01", "Choose", "Draw a random motion or bring a topic that matters to you."], ["02", "Argue both sides", "Make a concise case for Pro, then pressure-test it from Con."], ["03", "Reflect", "Save the transcripts, review the verdict, and take the next round." ]].map(([n, title, copy]) => <div key={n} className="rounded-3xl border border-white/10 bg-white/[.025] p-5"><span className="font-display text-sm font-extrabold text-[#d6ff6b]">{n}</span><h3 className="mt-4 font-display text-xl font-bold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-slate-400">{copy}</p></div>)}</section></div>;

  if (stage === "round") return <div className="container max-w-5xl py-6 md:py-10"><div className="mb-5 flex items-center justify-between gap-4"><button onClick={reset} className="text-sm font-bold text-slate-400 hover:text-white">← End practice</button><span className="rounded-full border border-white/10 bg-white/[.04] px-3 py-1.5 text-xs font-bold text-slate-300">Round {round} of {roundCount}</span></div><section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#0d1a2b]"><div className="border-b border-white/10 px-6 py-5 md:px-8"><p className="eyebrow">THE MOTION</p><h1 className="mt-2 max-w-3xl font-display text-xl font-bold leading-snug md:text-2xl">{activeTopic.text}</h1></div><div className="grid lg:grid-cols-[.86fr_1.14fr]"><aside className="border-b border-white/10 p-6 lg:border-b-0 lg:border-r lg:p-8"><div className={`rounded-3xl border p-6 text-center ${side === "pro" ? "border-[#4f8cff]/30 bg-[#4f8cff]/10" : "border-[#ff856b]/30 bg-[#ff856b]/10"}`}><p className={`text-xs font-extrabold tracking-[.18em] ${side === "pro" ? "text-[#8ab4ff]" : "text-[#ffab9b]"}`}>NOW SPEAKING</p><h2 className="mt-2 font-display text-4xl font-extrabold uppercase">{side}</h2><div className="mt-7 font-display text-7xl font-extrabold tracking-tighter tabular-nums">{timeLabel(remaining)}</div><p className="mt-2 text-sm text-slate-400">{isTurnLive ? "Your clock is live" : "Clock begins when you record"}</p></div><div className="mt-5 space-y-3">{Array.from({ length: roundCount * 2 }).map((_, index) => { const itemRound = Math.floor(index / 2) + 1; const itemSide: Side = index % 2 === 0 ? "pro" : "con"; const done = rounds.some(item => item.round === itemRound && item.side === itemSide); const isActive = itemRound === round && itemSide === side; return <div key={`${itemRound}-${itemSide}`} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${isActive ? "bg-white/[.09] text-white" : "text-slate-500"}`}><span className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-extrabold ${done ? "bg-[#d6ff6b] text-[#08111f]" : isActive ? "border border-[#d6ff6b] text-[#d6ff6b]" : "border border-white/15"}`}>{done ? <CheckCircle2 className="h-3.5 w-3.5" /> : index + 1}</span><span className="font-bold uppercase">R{itemRound} · {itemSide}</span>{isActive && <CircleDotDashed className="ml-auto h-4 w-4 animate-spin text-[#d6ff6b]" />}</div>; })}</div></aside><div className="p-6 md:p-8"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="eyebrow">LIVE TRANSCRIPT</p><p className="mt-1 text-sm text-slate-400">{speech.isSpeechRecognitionAvailable ? "Speech recognition will write as you speak. Review and edit any missed words." : "Your browser can record audio, but live transcription is unavailable. Type your argument below."}</p></div>{speech.isCapturing && <span className="flex items-center gap-2 rounded-full bg-red-400/10 px-3 py-1.5 text-xs font-bold text-red-300"><span className="h-2 w-2 animate-pulse rounded-full bg-red-400" /> RECORDING</span>}</div><Textarea value={turnDraft} onChange={event => setTurnDraft(event.target.value)} placeholder={`Make the ${side.toUpperCase()} case…`} className="mt-5 min-h-64 resize-none border-white/10 bg-[#08111f] p-5 text-base leading-relaxed text-slate-100 placeholder:text-slate-600 focus-visible:ring-[#d6ff6b]" disabled={stage !== "round"} />{speech.error && <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-300/[.06] px-3 py-2 text-sm text-amber-100">{speech.error}</p>}<div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between"><Button variant="outline" onClick={() => setTurnDraft("")} disabled={isTurnLive} className="border-white/10 text-slate-300 hover:bg-white/[.08] hover:text-white">Clear transcript</Button>{isTurnLive ? <Button onClick={finishTurn} className="bg-[#d6ff6b] font-extrabold text-[#08111f] hover:bg-[#e2ff91]"><Pause className="mr-2 h-4 w-4" />Finish {side.toUpperCase()} turn</Button> : <Button onClick={startTurn} className="bg-[#d6ff6b] font-extrabold text-[#08111f] hover:bg-[#e2ff91]"><Mic className="mr-2 h-4 w-4" />Start {side.toUpperCase()} turn</Button>}</div><p className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Volume2 className="h-3.5 w-3.5" /> Microphone permission is requested only when you start a turn. Typed arguments are always supported.</p></div></div></section></div>;

  if (stage === "judging") return <div className="container max-w-2xl py-24 text-center"><div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-[#d6ff6b] text-[#08111f] shadow-[0_0_48px_rgba(214,255,107,.23)]"><Sparkles className="h-9 w-9 animate-pulse" /></div><p className="eyebrow mt-8">AI ADJUDICATION</p><h1 className="mt-3 font-display text-4xl font-extrabold">Reviewing the clash.</h1><p className="mx-auto mt-4 max-w-md text-slate-400">The judge is comparing clarity, argument strength, structure, and delivery across both sides.</p><div className="mx-auto mt-8 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10"><div className="h-full w-2/3 animate-pulse rounded-full bg-[#d6ff6b]" /></div></div>;

  return <div className="container max-w-5xl py-7 md:py-12"><div className="mx-auto max-w-3xl text-center"><p className="eyebrow">ROUND COMPLETE</p><h1 className="mt-3 font-display text-4xl font-extrabold tracking-tight md:text-6xl">{verdict ? verdict.winner === "draw" ? "A hard-fought draw." : `${verdict.winner.toUpperCase()} takes it.` : "Argument captured."}</h1><p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400">{verdict?.overallSummary || resultMessage}</p></div>{verdict ? <div className="mt-8 grid gap-4 md:grid-cols-2"><ScoreCard side="pro" score={verdict.pro} /><ScoreCard side="con" score={verdict.con} /></div> : <section className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-amber-300/20 bg-amber-300/[.055] p-6 text-left"><div className="flex gap-3"><Coffee className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" /><div><h2 className="font-display text-xl font-bold text-amber-100">Your debate is safe.</h2><p className="mt-2 text-sm leading-relaxed text-amber-50/75">{resultMessage || "Add your OpenRouter key in Settings and finish another round to receive a structured AI verdict."}</p></div></div></section>}<div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row"><Button onClick={reset} className="bg-[#d6ff6b] font-extrabold text-[#08111f] hover:bg-[#e2ff91]"><RefreshCw className="mr-2 h-4 w-4" />Another round</Button><Button variant="outline" onClick={shareResult} className="border-white/10 text-slate-200 hover:bg-white/[.08] hover:text-white"><Clipboard className="mr-2 h-4 w-4" />Copy result</Button>{isAuthenticated ? <Link href="/history"><Button variant="outline" className="border-white/10 text-slate-200 hover:bg-white/[.08] hover:text-white"><Trophy className="mr-2 h-4 w-4" />View history</Button></Link> : <Button variant="outline" onClick={() => startLogin()} className="border-white/10 text-slate-200 hover:bg-white/[.08] hover:text-white">Sign in to save</Button>}</div></div>;
}
