import { useCallback, useEffect, useRef, useState } from "react";

type RecognitionEventLike = Event & { results: SpeechRecognitionResultList };
type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => RecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  }
}

export function useSpeechCapture(onUpdate: (transcript: string) => void) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const transcriptRef = useRef("");
  const onUpdateRef = useRef(onUpdate);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSpeechRecognitionAvailable, setIsSpeechRecognitionAvailable] = useState(false);
  const [recordingUrl, setRecordingUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    setIsSpeechRecognitionAvailable(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.stop();
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
    };
  }, [recordingUrl]);

  const start = useCallback(async (existingTranscript = "") => {
    setError(null);
    transcriptRef.current = existingTranscript;
    onUpdateRef.current(existingTranscript);
    try {
      recognitionRef.current?.stop();
      recognitionRef.current = null;
      if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
      recorderRef.current = null;
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
      await new Promise(resolve => window.setTimeout(resolve, 120));
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      if (recordingUrl) URL.revokeObjectURL(recordingUrl);
      setRecordingUrl(null);
      if (typeof MediaRecorder !== "undefined") {
        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(stream);
        recorderRef.current = recorder;
        recorder.ondataavailable = event => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onstop = () => {
          if (chunks.length) {
            const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            const url = URL.createObjectURL(blob);
            setRecordingUrl(url);
            window.dispatchEvent(new CustomEvent("debaterush:recording", { detail: { url } }));
          }
        };
        recorder.start();
      }

      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (Recognition) {
        const recognition = new Recognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = navigator.language || "en-US";
        recognition.onresult = event => {
          let stable = "";
          let interim = "";
          for (let i = 0; i < event.results.length; i += 1) {
            const result = event.results[i];
            const text = result[0]?.transcript ?? "";
            if (result.isFinal) stable += `${text} `;
            else interim += `${text} `;
          }
          transcriptRef.current = `${stable}${interim}`.trim();
          onUpdateRef.current(transcriptRef.current);
        };
        recognition.onerror = event => {
          if (event.error !== "aborted") setError("Live transcription paused. You can still type your argument below.");
        };
        recognition.onend = () => {
          if (recognitionRef.current === recognition) recognitionRef.current = null;
        };
        try {
          recognition.start();
        } catch {
          window.setTimeout(() => {
            try { recognition.start(); } catch { setError("Live transcription is unavailable for this turn. You can still type your argument below."); }
          }, 180);
        }
        recognitionRef.current = recognition;
      }
      setIsCapturing(true);
    } catch (captureError) {
      setError(captureError instanceof Error ? "Microphone access was not granted. Type your argument to continue." : "Microphone access is unavailable. Type your argument to continue.");
      setIsCapturing(false);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state !== "inactive") recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    setIsCapturing(false);
    return transcriptRef.current;
  }, []);

  return { start, stop, isCapturing, isSpeechRecognitionAvailable, recordingUrl, error };
}
