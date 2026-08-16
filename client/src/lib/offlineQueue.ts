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

export function readOfflineQueue(): QueuedDebate[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueuedDebate[];
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
