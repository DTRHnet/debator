import { useCallback, useEffect, useRef } from "react";
import { turnAnnouncementText, type DebateSide } from "@/lib/turnAnnouncement";

export function useTurnAnnouncer() {
  const replayTimerRef = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (replayTimerRef.current !== null) window.clearTimeout(replayTimerRef.current);
    replayTimerRef.current = null;
    window.speechSynthesis?.cancel();
  }, []);

  const announce = useCallback((side: DebateSide, round: number) => {
    if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") return false;
    cancel();
    const utterance = new SpeechSynthesisUtterance(turnAnnouncementText(side, round));
    utterance.rate = 0.94;
    utterance.pitch = 1;
    let started = false;
    utterance.onstart = () => { started = true; };
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    replayTimerRef.current = window.setTimeout(() => {
      if (!started && !window.speechSynthesis.speaking && !window.speechSynthesis.pending) window.speechSynthesis.speak(utterance);
    }, 350);
    return true;
  }, [cancel]);

  useEffect(() => cancel, [cancel]);
  return { announce, cancel };
}
