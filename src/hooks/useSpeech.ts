import { useState, useEffect, useCallback } from "react";
import type { Round } from "../types/schedule";

/**
 * ラウンドデータから読み上げ用テキストを生成
 * 例: "ラウンド1。コート1、1、2、 3、4。コート2、5、6、 7、8。休憩、9、10。"
 */
export function buildSpeechText(round: Round): string {
  const parts: string[] = [];

  parts.push(`ラウンド${round.roundNumber}`);

  round.matches.forEach((match, idx) => {
    parts.push(`コート${idx + 1}、${match.pairA.player1}、${match.pairA.player2}、 ${match.pairB.player1}、${match.pairB.player2}`);
  });

  if (round.restingPlayers && round.restingPlayers.length > 0) {
    parts.push(`休憩、${round.restingPlayers.join("、")}`);
  }

  return parts.join("。") + "。";
}

/**
 * Web Speech API (SpeechSynthesis) のラッパー hook
 */
export function useSpeech() {
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text: string) => {
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    utterance.rate = 2.0;

    const voices = window.speechSynthesis.getVoices();
    const jaVoice = voices.find((v) => v.lang.startsWith("ja"));
    if (jaVoice) {
      utterance.voice = jaVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return { speak, stop, isSpeaking };
}
