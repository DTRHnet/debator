import { createDebateSessionId, isSessionId } from "./sessionId";

export type QueuedDebate = {
  id: string;
  topic: string;
  topicSource: "random" | "custom";
  timerSeconds: number;
  roundCount: number;
  proTranscript: string;
  conTranscript: string;
  queuedAt: number;
};

const QUEUE_KEY = "debaterush-offline-queue";

function isQueuedDebate(value: unknown): value is Omit<QueuedDebate, "id"> & { id?: unknown } {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return typeof item.topic === "string" && (item.topicSource === "random" || item.topicSource === "custom")
    && typeof item.timerSeconds === "number" && typeof item.roundCount === "number"
    && typeof item.proTranscript === "string" && typeof item.conTranscript === "string" && typeof item.queuedAt === "number";
}

export function normalizeOfflineQueue(value: unknown): QueuedDebate[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isQueuedDebate).map(item => ({
    ...item,
    id: isSessionId(item.id) ? item.id : createDebateSessionId(),
  }));
}

export function readOfflineQueue(): QueuedDebate[] {
  try {
    return normalizeOfflineQueue(JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function queueOfflineDebate(debate: QueuedDebate) {
  const current = readOfflineQueue().filter(item => item.id !== debate.id);
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...current, debate].slice(-25)));
}

export function removeQueuedDebate(id: string) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(readOfflineQueue().filter(item => item.id !== id)));
}
