/**
 * ベンチマーク用テストデータ生成ヘルパー
 */

import type { Round } from '../../types/schedule';
import { arrangementToRoundWithRest } from '../../utils/normalization';
import { createInitialArrangement, nextPermutation } from '../../utils/permutation';
import { isNormalized } from '../../utils/normalization';

/**
 * テスト用のラウンドデータを生成
 * 正規化された配列を使用して有効なラウンドを作成
 */
export function createTestRounds(
  courtsCount: number,
  playersCount: number,
  roundsCount: number
): Round[] {
  const playingCount = courtsCount * 4;
  const restCount = playersCount - playingCount;
  const rounds: Round[] = [];

  // 初期配列を作成
  const allPlayers = createInitialArrangement(playersCount);
  const restingPlayers = restCount > 0
    ? allPlayers.slice(playingCount)
    : [];
  const playingPlayers = allPlayers.slice(0, playingCount);

  for (let r = 1; r <= roundsCount; r++) {
    // 各ラウンドで異なる配列を使用（正規化チェックを通過するもの）
    const arrangement = playingPlayers.slice();

    // 正規化された配列を見つける
    let found = false;
    let attempts = 0;
    do {
      if (isNormalized(arrangement, courtsCount)) {
        rounds.push(arrangementToRoundWithRest(arrangement.slice(), courtsCount, r, restingPlayers));
        found = true;
        break;
      }
      attempts++;
    } while (nextPermutation(arrangement) && attempts < 1000);

    // 見つからない場合は初期配列を使用
    if (!found) {
      const defaultArrangement = createInitialArrangement(playingCount);
      rounds.push(arrangementToRoundWithRest(defaultArrangement, courtsCount, r, restingPlayers));
    }
  }

  return rounds;
}

/**
 * 指定サイズの配列を生成
 */
export function createArrangement(size: number): number[] {
  return createInitialArrangement(size);
}

/**
 * ベンチマーク用の標準パラメータ
 */
export const BENCHMARK_SCENARIOS = {
  small: {
    courts: 1,
    players: 4,
    rounds: 5,
  },
  medium: {
    courts: 2,
    players: 8,
    rounds: 7,
  },
  mediumWithRest: {
    courts: 2,
    players: 10,
    rounds: 7,
  },
  large: {
    courts: 3,
    players: 12,
    rounds: 5,
  },
} as const;

/**
 * デフォルトの重み設定
 */
export const DEFAULT_WEIGHTS = {
  w1: 1.0,
  w2: 0.5,
  w3: 2.0,
} as const;
