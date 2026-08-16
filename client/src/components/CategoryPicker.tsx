import { TOPIC_CATEGORIES } from "@/lib/topics";

type CategoryPickerProps = {
  category: string;
  onChange: (category: string) => void;
  disabled?: boolean;
};

export default function CategoryPicker({ category, onChange, disabled = false }: CategoryPickerProps) {
  return <>
    <div className="mt-6 md:hidden">
      <label htmlFor="topic-category" className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-slate-400">Topic category</label>
      <select id="topic-category" value={category} disabled={disabled} onChange={event => onChange(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#08111f] px-3 text-sm font-bold text-slate-100 outline-none transition focus:border-[#d6ff6b] focus:ring-2 focus:ring-[#d6ff6b]/25 disabled:cursor-not-allowed disabled:opacity-60">
        {TOPIC_CATEGORIES.map(item => <option key={item} value={item}>{item === "Random" ? "Random across all categories" : item}</option>)}
      </select>
    </div>
    <div className="mt-6 hidden gap-2 overflow-x-auto pb-1 no-scrollbar md:flex" aria-label="Topic categories">
      {TOPIC_CATEGORIES.map(item => <button key={item} type="button" aria-pressed={category === item} disabled={disabled} onClick={() => onChange(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition ${category === item ? "bg-[#d6ff6b] text-[#08111f]" : "bg-white/[.05] text-slate-400 hover:bg-white/[.1] hover:text-white"}`}>{item}</button>)}
    </div>
  </>;
}
