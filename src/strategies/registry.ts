/**
 * ストラテジーレジストリ
 *
 * 利用可能なスケジュール生成アルゴリズムの登録と取得を管理する。
 */

import type { ScheduleStrategy, StrategyId, StrategyMeta } from "./types";
import { SequentialDecisionStrategy } from "./sequential-decision";

const strategies: Map<StrategyId, ScheduleStrategy> = new Map();

// ストラテジーを登録
strategies.set("sequential-decision", new SequentialDecisionStrategy());

/**
 * デフォルトのストラテジーID
 */
export const DEFAULT_STRATEGY_ID: StrategyId = "sequential-decision";

/**
 * 指定IDのストラテジーを取得する
 */
export function getStrategy(id: StrategyId): ScheduleStrategy {
  const strategy = strategies.get(id);
  if (!strategy) {
    throw new Error(`Unknown strategy: ${id}`);
  }
  return strategy;
}

/**
 * 利用可能なストラテジーのメタ情報一覧を取得する
 */
export function getAvailableStrategies(): StrategyMeta[] {
  return Array.from(strategies.values()).map((s) => s.meta);
}

/**
 * 新しいストラテジーを登録する
 */
export function registerStrategy(strategy: ScheduleStrategy): void {
  strategies.set(strategy.meta.id, strategy);
}
