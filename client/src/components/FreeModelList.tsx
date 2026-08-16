import { ChevronDown, Sparkles } from "lucide-react";
import { FREE_MODEL_OPTIONS } from "../../../shared/freeModels";

export default function FreeModelList() {
  return <details className="mt-3 rounded-xl border border-white/10 bg-white/[.025] px-3 py-2.5"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-xs font-bold text-slate-300"><span className="flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-[#d6ff6b]" /> Current free-model catalogue ({FREE_MODEL_OPTIONS.length})</span><ChevronDown className="h-3.5 w-3.5 text-slate-500" /></summary><ul className="mt-3 space-y-2 border-t border-white/10 pt-3 text-xs text-slate-400">{FREE_MODEL_OPTIONS.map(option => <li key={option.id} className="flex items-start justify-between gap-3"><code className="break-all text-slate-300">{option.id}</code>{option.structured && <span className="shrink-0 rounded-full bg-[#d6ff6b]/10 px-2 py-0.5 text-[10px] font-bold text-[#d6ff6b]">JSON</span>}</li>)}</ul></details>;
}
