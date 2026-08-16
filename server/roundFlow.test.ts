import { describe, expect, it } from "vitest";
import { createDebateSessionId, isSessionId } from "../client/src/lib/sessionId";
import { turnAnnouncementText } from "../client/src/lib/turnAnnouncement";
import { advanceDebateTurn } from "../client/src/lib/turnTransition";
import { normalizeOfflineQueue } from "../client/src/lib/offlineQueue";

describe("consecutive debate turns", () => {
  it("creates server-acceptable session identifiers even without native randomUUID", () => {
    const id = createDebateSessionId();
    expect(isSessionId(id)).toBe(true);
  });

  it("creates distinct, speaker-specific turn announcements", () => {
    expect(turnAnnouncementText("pro", 1)).toBe("Round 1. Pro speaker, you have the floor.");
    expect(turnAnnouncementText("con", 1)).toBe("Round 1. Con speaker, you have the floor.");
  });

  it("moves from Pro directly to an announced Con turn before requesting a verdict", () => {
    expect(advanceDebateTurn("pro", 1, 1)).toEqual({ kind: "next", side: "con", round: 1 });
    expect(advanceDebateTurn("con", 1, 2)).toEqual({ kind: "next", side: "pro", round: 2 });
    expect(advanceDebateTurn("con", 2, 2)).toEqual({ kind: "judge" });
  });

  it("normalizes a legacy offline session identifier before it can be synchronized", () => {
    const queue = normalizeOfflineQueue([{ id: "legacy-device-id", topic: "Should libraries be free?", topicSource: "random", timerSeconds: 60, roundCount: 1, proTranscript: "Yes", conTranscript: "Funding matters", queuedAt: 1 }]);
    expect(queue).toHaveLength(1);
    expect(isSessionId(queue[0]?.id)).toBe(true);
  });
});
