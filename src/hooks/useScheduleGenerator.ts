import { useState, useCallback, useRef } from 'react';
import type { Schedule, ScheduleParams, GenerationProgress, RegenerationParams } from '../types/schedule';
import type { StrategyId } from '../strategies/types';
import { getStrategy, DEFAULT_STRATEGY_ID } from '../strategies/registry';

/**
 * 同期的スケジュール生成（互換ラッパー）
 *
 * useBenchmarkCalibration.ts および scheduleGenerator.bench.ts から参照されるため、
 * 既存のインポートパスを維持する。
 */
export function generateSchedule(params: ScheduleParams): Schedule {
  const strategy = getStrategy(DEFAULT_STRATEGY_ID);
  return strategy.generateSchedule(params);
}

/**
 * アルゴリズム非依存のスケジュール生成 React フック
 *
 * @param strategyId - 使用するアルゴリズムのID（デフォルト: 'greedy'）
 * @returns スケジュール状態、進捗、生成関数を含むフックインターフェース
 *
 * @example
 * const { schedule, isGenerating, progress, error, generate } = useScheduleGenerator();
 *
 * // 生成をトリガー
 * generate({ courtsCount: 2, playersCount: 8, roundsCount: 7, weights: { w1: 1.0, w2: 0.5, w3: 2.0 }, fixedPairs: [] });
 *
 * // 進捗を表示
 * if (isGenerating && progress) {
 *   return <Progress value={progress.percentage} />;
 * }
 */
export function useScheduleGenerator(strategyId: StrategyId = DEFAULT_STRATEGY_ID) {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [partialSchedule, setPartialSchedule] = useState<Schedule | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const generate = useCallback((params: ScheduleParams) => {
    // 前回の生成を中断
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setProgress(null);
    setSchedule(null);
    setPartialSchedule(null);

    const strategy = getStrategy(strategyId);

    // 進捗更新付きで非同期生成を実行
    strategy.generateScheduleAsync(
      params,
      {
        onProgress: (progressUpdate) => {
          setProgress(progressUpdate);
        },
        onRoundComplete: (confirmedRounds) => {
          const allPlayers = Array.from({ length: params.playersCount }, (_, i) => i + 1);
          setPartialSchedule({
            courts: params.courtsCount,
            players: params.playersCount,
            rounds: confirmedRounds,
            evaluation: { pairStdDev: 0, oppoStdDev: 0, restStdDev: 0, totalScore: 0 },
            fixedPairs: params.fixedPairs,
            activePlayers: allPlayers,
          });
        },
      },
      controller.signal
    )
      .then((result) => {
        setSchedule(result);
        setPartialSchedule(null);
        setIsGenerating(false);
        setProgress(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // キャンセル時: 途中結果があればそれを表示
          setIsGenerating(false);
          setProgress(null);
          return;
        }
        setError(err instanceof Error ? err.message : '生成に失敗しました');
        setIsGenerating(false);
        setProgress(null);
        setPartialSchedule(null);
      });
  }, [strategyId]);

  // 参加者変更後の残りラウンド再生成
  const regenerate = useCallback((params: RegenerationParams) => {
    // 前回の生成を中断
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsGenerating(true);
    setError(null);
    setProgress(null);

    const strategy = getStrategy(strategyId);

    strategy.generateRemainingScheduleAsync(
      params,
      {
        onProgress: (progressUpdate) => {
          setProgress(progressUpdate);
        },
        onRoundComplete: (confirmedRounds) => {
          setPartialSchedule({
            courts: params.courtsCount,
            players: Math.max(...params.activePlayers),
            rounds: confirmedRounds,
            evaluation: { pairStdDev: 0, oppoStdDev: 0, restStdDev: 0, totalScore: 0 },
            fixedPairs: params.fixedPairs,
            activePlayers: params.activePlayers,
          });
        },
      },
      controller.signal
    )
      .then((result) => {
        setSchedule(result);
        setPartialSchedule(null);
        setIsGenerating(false);
        setProgress(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // キャンセル時: 途中結果があればそれを表示
          setIsGenerating(false);
          setProgress(null);
          return;
        }
        setError(err instanceof Error ? err.message : '再生成に失敗しました');
        setIsGenerating(false);
        setProgress(null);
        setPartialSchedule(null);
      });
  }, [strategyId]);

  const cancel = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  return { schedule, isGenerating, progress, error, generate, regenerate, partialSchedule, cancel };
}
