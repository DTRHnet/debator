import { useEffect, useRef, useState } from "react";
import { Link, useRoute } from "wouter";
import { ArrowLeft, Check, LogOut, Send, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { getMultiplayerAvailabilityState } from "@shared/multiplayer";

export default function MultiplayerRoomPage() {
  const [, params] = useRoute("/multiplayer/room/:roomId");
  const roomId = params?.roomId ?? "";
  const config = trpc.multiplayer.config.useQuery();
  const availability = getMultiplayerAvailabilityState({ isLoading: config.isLoading, hasError: Boolean(config.error), enabled: Boolean(config.data?.enabled) });
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "live" | "reconnecting" | "fallback">("connecting");
  const socketRef = useRef<WebSocket | null>(null);
  const room = trpc.multiplayer.room.useQuery({ roomId }, { enabled: Boolean(roomId) && availability === "enabled", refetchInterval: realtimeStatus === "live" ? 10000 : 2000 });
  const competitiveResult = trpc.multiplayer.result.useQuery({ roomId }, { enabled: Boolean(roomId) && availability === "enabled" && room.data?.state === "completed" });
  const ready = trpc.multiplayer.ready.useMutation({ onSuccess: () => room.refetch() });
  const leave = trpc.multiplayer.leaveRoom.useMutation();
  const submit = trpc.multiplayer.submitTurn.useMutation({ onSuccess: () => { setTranscript(""); room.refetch(); } });
  const judge = trpc.multiplayer.judge.useMutation({ onSuccess: () => room.refetch() });
  const [transcript, setTranscript] = useState("");
  const snapshot = room.data;

  useEffect(() => {
    if (!roomId || availability !== "enabled" || typeof window === "undefined") return;
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let lastEventId = 0;
    const connect = () => {
      if (disposed) return;
      setRealtimeStatus(lastEventId ? "reconnecting" : "connecting");
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/multiplayer/ws`);
      socketRef.current = socket;
      socket.onopen = () => {
        setRealtimeStatus("live");
        socket.send(JSON.stringify({ type: "join", roomId, lastEventId }));
      };
      socket.onmessage = event => {
        try {
          const frame = JSON.parse(event.data) as { type: string; events?: Array<{ eventId?: number }> };
          if (frame.type === "room_snapshot") {
            for (const item of frame.events ?? []) if (typeof item.eventId === "number") lastEventId = Math.max(lastEventId, item.eventId);
            void room.refetch();
          } else if (frame.type === "room_event") {
            const item = (frame as { event?: { eventId?: number } }).event;
            if (typeof item?.eventId === "number") lastEventId = Math.max(lastEventId, item.eventId);
            void room.refetch();
          } else if (frame.type === "presence") {
            void room.refetch();
          }
        } catch {
          setRealtimeStatus("fallback");
        }
      };
      socket.onerror = () => setRealtimeStatus("fallback");
      socket.onclose = () => {
        socketRef.current = null;
        if (!disposed) {
          setRealtimeStatus("reconnecting");
          retryTimer = setTimeout(connect, 1500);
        }
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [availability, roomId]);

  if (availability === "loading") return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-300" role="status">Loading authoritative room state…</div></div>;
  if (availability === "error") return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-8 text-center text-rose-100" role="alert">Multiplayer availability could not be checked.</div></div>;
  if (availability === "disabled") return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-300" role="status">Multiplayer is currently disabled.</div></div>;
  if (room.isLoading) return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-white/10 bg-white/[.04] p-8 text-center text-slate-300" role="status">Loading room state…</div></div>;
  if (room.error) return <div className="container mx-auto max-w-3xl px-4 py-20"><div className="rounded-3xl border border-rose-400/20 bg-rose-400/10 p-8 text-center text-rose-100" role="alert">{room.error.message}</div></div>;
  if (!snapshot) return null;

  const activePlayer = snapshot.players.find(player => player.side === snapshot.activeSide);
  const readyCount = snapshot.players.filter(player => player.ready).length;
  const needsReady = snapshot.state === "waiting" || snapshot.state === "ready";
  const canSubmit = snapshot.state === "speaking" && Boolean(snapshot.activeSide) && Boolean(transcript.trim());
  const canDraft = snapshot.state === "speaking";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-10 md:py-16">
      <Link href="/multiplayer" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white"><ArrowLeft className="h-4 w-4" /> Back to multiplayer</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.24em] text-[#d6ff6b]">Room {snapshot.roomId}</p><h1 className="mt-2 font-display text-4xl font-black text-white">{snapshot.topic}</h1></div><div className="flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><Wifi className="h-3.5 w-3.5" /> {realtimeStatus === "live" ? "Live updates" : realtimeStatus === "reconnecting" ? "Reconnecting" : "Polling fallback"} · {snapshot.state}</div></div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">{snapshot.players.map(player => <div key={player.userId} className="rounded-2xl border border-white/10 bg-white/[.04] p-4"><div className="flex items-center justify-between"><span className="font-bold text-white">{player.handle}</span><span className="text-xs font-black uppercase tracking-wider text-[#d6ff6b]">{player.side}</span></div><p className="mt-2 text-sm text-slate-400">{player.connected ? "Connected" : "Reconnecting"} · {player.ready ? "Ready" : "Not ready"}</p></div>)}</div>
      <section className="mt-6 rounded-3xl border border-white/10 bg-white/[.04] p-6 md:p-8">
        <p className="text-sm font-bold text-slate-300">Round {snapshot.round} · {readyCount}/{snapshot.players.length} ready</p>
        <h2 className="mt-2 font-display text-2xl font-black text-white">{needsReady ? "Lock in when you are ready." : activePlayer ? `${activePlayer.handle} is speaking.` : "Waiting for the server."}</h2>
        {needsReady && <Button onClick={() => ready.mutate({ roomId })} disabled={ready.isPending} className="mt-6 bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]"><Check className="mr-2 h-4 w-4" /> {ready.isPending ? "Confirming…" : "I’m ready"}</Button>}
        {snapshot.state === "speaking" && <div className="mt-6 space-y-3"><Textarea value={transcript} onChange={event => setTranscript(event.target.value)} disabled={!canDraft} placeholder="Type your argument here if microphone capture is unavailable…" className="min-h-36 border-white/10 bg-black/10 text-white" maxLength={20000} /><Button onClick={() => submit.mutate({ roomId, round: snapshot.round, side: snapshot.activeSide!, transcript, idempotencyKey: crypto.randomUUID() })} disabled={!canSubmit || submit.isPending} className="bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]"><Send className="mr-2 h-4 w-4" /> {submit.isPending ? "Submitting…" : "Submit turn"}</Button></div>}
        {(snapshot.state === "round_complete" || snapshot.state === "judging") && <div className="mt-6 rounded-2xl border border-[#d6ff6b]/20 bg-[#d6ff6b]/5 p-4"><p className="text-sm text-slate-300">Both sides have submitted. The server can now ask the configured free OpenRouter judge for a structured result.</p><Button onClick={() => judge.mutate({ roomId, finalizationKey: crypto.randomUUID() })} disabled={judge.isPending} className="mt-4 bg-[#d6ff6b] font-black text-[#08111f] hover:bg-[#e4ff9d]">{judge.isPending ? "Judging…" : "Get match result"}</Button>{judge.error && <p className="mt-3 text-sm font-bold text-rose-300">{judge.error.message}</p>}</div>}
        {(ready.error || submit.error || judge.error || leave.error) && <p className="mt-4 text-sm font-bold text-rose-300">{ready.error?.message || submit.error?.message || judge.error?.message || leave.error?.message}</p>}
        {snapshot.state === "completed" && <div className="mt-8 rounded-2xl border border-[#d6ff6b]/20 bg-[#d6ff6b]/5 p-5"><p className="text-xs font-black uppercase tracking-wider text-[#d6ff6b]">Final result</p>{competitiveResult.isLoading ? <p className="mt-2 text-sm text-slate-400">Loading the immutable result…</p> : competitiveResult.data ? <><p className="mt-2 font-display text-2xl font-black text-white">{competitiveResult.data.result.winnerSide === "draw" ? "Draw" : `${competitiveResult.data.result.winnerSide.toUpperCase()} wins`}</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{competitiveResult.data.ratings.map((rating: { userId: number; priorRating: number; newRating: number; delta: number }) => <div key={rating.userId} className="rounded-xl border border-white/10 bg-black/10 p-3 text-sm text-slate-300"><span className="font-bold text-white">Player {rating.userId}</span><span className="ml-2 font-mono">{rating.priorRating} → {rating.newRating} ({rating.delta >= 0 ? "+" : ""}{rating.delta})</span></div>)}</div></> : <p className="mt-2 text-sm text-slate-400">The server is still preparing the result.</p>}</div>}
        <Button variant="outline" onClick={() => leave.mutate({ roomId })} disabled={leave.isPending} className="mt-8 border-white/15 bg-transparent text-white hover:bg-white/10"><LogOut className="mr-2 h-4 w-4" /> Leave room</Button>
      </section>
    </div>
  );
}
