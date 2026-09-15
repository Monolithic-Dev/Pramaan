import { useCallback } from "react";

// Browser-native TTS for the spoken confirmation read-back (PRD.md §6.7) —
// no backend call, works offline once the page has loaded.
export function useSpeechSynthesis(lang: string) {
  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      window.speechSynthesis.speak(utterance);
    },
    [lang],
  );

  return { speak, isSupported: "speechSynthesis" in window };
}
