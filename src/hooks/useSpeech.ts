import { useState, useEffect, useCallback } from "react";
import type { Round } from "../types/schedule";

/**
 * ラウンドデータから読み上げ用テキストを生成
 * 例: "ラウンド1。コート1、1番2番 対 3番4番。コート2、5番6番 対 7番8番。休憩、9番10番。"
 */
export function buildSpeechText(round: Round): string {
  const parts: string[] = [];

  parts.push(`ラウンド${round.roundNumber}`);

  round.matches.forEach((match, idx) => {
    parts.push(`コート${idx + 1}、${match.pairA.player1}番${match.pairA.player2}番 対 ${match.pairB.player1}番${match.pairB.player2}番`);
  });

  if (round.restingPlayers && round.restingPlayers.length > 0) {
    parts.push(`休憩、${round.restingPlayers.map((p) => `${p}番`).join("")}`);
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
    utterance.rate = 0.9;

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
