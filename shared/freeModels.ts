export const FREE_MODEL_OPTIONS = [
  { id: "google/gemma-4-26b-a4b-it:free", name: "Google Gemma 4 26B A4B", structured: true },
  { id: "openai/gpt-oss-20b:free", name: "OpenAI gpt-oss-20b", structured: true },
  { id: "nvidia/nemotron-nano-9b-v2:free", name: "NVIDIA Nemotron Nano 9B V2", structured: true },
  { id: "nvidia/nemotron-3-super-120b-a12b:free", name: "NVIDIA Nemotron 3 Super", structured: true },
  { id: "liquid/lfm-2.5-2.6b:free", name: "LiquidAI LFM2.5-2.6B", structured: true },
  { id: "dots-studio/dots-3-note-preview:free", name: "Dots3-Note Preview", structured: true },
] as const;

export const DEFAULT_FREE_MODEL = FREE_MODEL_OPTIONS[0].id;
export const FREE_MODEL_IDS = FREE_MODEL_OPTIONS.map(model => model.id);
