import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, ShieldCheck, TimerReset } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function SettingsPage() {
  const { isAuthenticated, loading } = useAuth();
  const settings = trpc.settings.get.useQuery(undefined, { enabled: isAuthenticated });
  const save = trpc.settings.save.useMutation();
  const [timerSeconds, setTimerSeconds] = useState(60);
  const [roundCount, setRoundCount] = useState(1);
  const [model, setModel] = useState("google/gemma-3-27b-it:free");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [clearKey, setClearKey] = useState(false);

  useEffect(() => {
    if (settings.data) {
      setTimerSeconds(settings.data.timerSeconds);
      setRoundCount(settings.data.roundCount);
      setModel(settings.data.preferredModel);
    }
  }, [settings.data]);

  if (!loading && !isAuthenticated) {
    return <div className="container max-w-2xl py-16"><section className="rounded-[2rem] border border-white/10 bg-white/[.04] p-8 text-center"><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-[#d6ff6b]" /><h1 className="font-display text-3xl font-extrabold">Personalize your rounds</h1><p className="mx-auto mt-3 max-w-md text-slate-400">Sign in to save your timer, round count, and optional OpenRouter key securely to your account.</p><Button onClick={() => startLogin()} className="mt-6 bg-[#d6ff6b] font-bold text-[#08111f] hover:bg-[#e2ff91]">Sign in to open settings</Button></section></div>;
  }

  if (settings.isError) {
    return <div className="container max-w-2xl py-16"><section className="rounded-[2rem] border border-amber-300/20 bg-amber-300/[.055] p-8 text-center"><ShieldCheck className="mx-auto mb-4 h-10 w-10 text-amber-200" /><h1 className="font-display text-3xl font-extrabold text-amber-50">Settings are temporarily unavailable</h1><p className="mx-auto mt-3 max-w-md text-amber-50/75">Your saved preferences have not changed. Restore a connection, then load the page again.</p><Button onClick={() => settings.refetch()} variant="outline" className="mt-6 border-amber-200/30 text-amber-50 hover:bg-amber-100/10 hover:text-white">Try again</Button></section></div>;
  }

  const submit = async () => {
    try {
      const result = await save.mutateAsync({ timerSeconds, roundCount, preferredModel: model, openRouterKey: apiKey || undefined, clearOpenRouterKey: clearKey });
      setApiKey(""); setClearKey(false);
      await settings.refetch();
      toast.success(result.hasOpenRouterKey ? "Settings saved. AI judging is ready." : "Settings saved.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save settings."); }
  };

  return <div className="container max-w-3xl py-8 md:py-14"><div className="mb-8"><p className="eyebrow">ACCOUNT PREFERENCES</p><h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight md:text-5xl">Set your rhythm.</h1><p className="mt-3 max-w-xl text-slate-400">Tune the default pace for every debate, then add an optional personal key when you are ready for live AI adjudication.</p></div><div className="grid gap-5"><section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6 md:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#4f8cff]/15 text-[#8ab4ff]"><TimerReset className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-bold">Round defaults</h2><p className="text-sm text-slate-400">Applied whenever you start a fresh session.</p></div></div><div className="grid gap-6 sm:grid-cols-2"><div><Label htmlFor="timer" className="text-slate-300">Speaking time</Label><div className="mt-2 flex gap-2">{[30, 45, 60, 90].map(value => <button key={value} aria-pressed={timerSeconds === value} onClick={() => setTimerSeconds(value)} className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition ${timerSeconds === value ? "border-[#d6ff6b] bg-[#d6ff6b] text-[#08111f]" : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.08]"}`}>{value}s</button>)}</div></div><div><Label htmlFor="rounds" className="text-slate-300">Rounds per side</Label><div className="mt-2 flex gap-2">{[1, 2, 3].map(value => <button key={value} aria-pressed={roundCount === value} onClick={() => setRoundCount(value)} className={`flex-1 rounded-xl border px-2 py-2 text-sm font-bold transition ${roundCount === value ? "border-[#d6ff6b] bg-[#d6ff6b] text-[#08111f]" : "border-white/10 bg-white/[.03] text-slate-300 hover:bg-white/[.08]"}`}>{value}</button>)}</div></div></div></section><section className="rounded-[2rem] border border-white/10 bg-white/[.035] p-6 md:p-7"><div className="mb-6 flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#d6ff6b]/15 text-[#d6ff6b]"><KeyRound className="h-5 w-5" /></span><div><h2 className="font-display text-xl font-bold">AI judge</h2><p className="text-sm text-slate-400">Optional. Your key is encrypted server-side before storage.</p></div></div><div className="space-y-5"><div><Label htmlFor="model" className="text-slate-300">OpenRouter free model</Label><Input id="model" value={model} onChange={event => setModel(event.target.value)} className="mt-2 border-white/10 bg-[#08111f] text-white placeholder:text-slate-600" /><p className="mt-2 text-xs text-slate-500">Use a current free-model slug ending in <code>:free</code>.</p></div><div><div className="flex items-center justify-between gap-4"><Label htmlFor="api-key" className="text-slate-300">OpenRouter API key {settings.data?.hasOpenRouterKey && <span className="ml-1 text-xs font-normal text-[#d6ff6b]">(saved ••••{settings.data.keyLastFour})</span>}</Label><a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-xs font-bold text-[#d6ff6b] hover:underline">Create a key</a></div><div className="relative mt-2"><Input id="api-key" type={showKey ? "text" : "password"} value={apiKey} onChange={event => { setApiKey(event.target.value); setClearKey(false); }} placeholder={settings.data?.hasOpenRouterKey ? "Leave empty to retain saved key" : "sk-or-v1-…"} className="border-white/10 bg-[#08111f] pr-11 text-white placeholder:text-slate-600" /><button type="button" onClick={() => setShowKey(value => !value)} className="absolute inset-y-0 right-0 grid w-10 place-items-center text-slate-500 hover:text-white" aria-label="Toggle key visibility">{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></div>{settings.data?.hasOpenRouterKey && <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[.025] px-4 py-3"><span className="text-sm text-slate-300">Remove stored key</span><Switch checked={clearKey} onCheckedChange={setClearKey} /></div>}<p className="text-xs leading-relaxed text-slate-500">Your key is sent over a secure connection, encrypted by the server, and used only for the server-side judging request. Free-model availability and rate limits are determined by OpenRouter.</p></div></section><div className="flex justify-end"><Button onClick={submit} disabled={save.isPending || settings.isLoading} className="min-w-36 bg-[#d6ff6b] font-bold text-[#08111f] hover:bg-[#e2ff91]">{save.isPending ? "Saving…" : <><Check className="mr-2 h-4 w-4" /> Save settings</>}</Button></div></div></div>;
}
