/**
 * スケジュール生成アルゴリズムの Strategy Pattern 型定義
 */

import type {
  Schedule,
  ScheduleParams,
  RegenerationParams,
  GenerationProgress,
  Round,
} from '../types/schedule';

/**
 * アルゴリズム識別子
 */
export type StrategyId = 'sequential-decision';

/**
 * アルゴリズム戦略のメタ情報
 */
export interface StrategyMeta {
  id: StrategyId;
  name: string;
  description: string;
  isExperimental: boolean;
}

/**
 * 進捗コールバック群
 */
export interface ProgressCallbacks {
  onProgress: (progress: GenerationProgress) => void;
  onRoundComplete?: (rounds: Round[], roundNumber: number) => void;
}

/**
 * スケジュール生成アルゴリズムの共通インターフェース
 *
 * 各アルゴリズムはこのインターフェースを実装する。
 * 内部状態（CumulativeState、pairHistory等）は実装に閉じ込める。
 */
export interface ScheduleStrategy {
  readonly meta: StrategyMeta;

  /**
   * 新規スケジュール生成（同期版、ベンチマーク/テスト用）
   */
  generateSchedule(params: ScheduleParams): Schedule;

  /**
   * 新規スケジュール生成（非同期版、UI用）
   */
  generateScheduleAsync(
    params: ScheduleParams,
    callbacks: ProgressCallbacks,
    signal?: AbortSignal,
  ): Promise<Schedule>;

  /**
   * 参加者変更後の残りラウンド再生成
   */
  generateRemainingScheduleAsync(
    params: RegenerationParams,
    callbacks: ProgressCallbacks,
    signal?: AbortSignal,
  ): Promise<Schedule>;

  /**
   * 推定計算量を返す（時間推定用）
   */
  estimateTotalEvaluations(
    playersCount: number,
    courtsCount: number,
    roundsCount: number,
  ): number;
}
