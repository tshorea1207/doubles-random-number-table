/**
 * 貪欲逐次構築法固有のユーティリティ関数
 */

import { estimateArrangementCount } from '../../utils/normalizedArrangements';

/**
 * 二項係数 C(n, k) を計算する
 */
export function binomial(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.floor(result);
}

/**
 * 与えられたパラメータに対する正規化された配列の数を推定する
 *
 * 休憩者なしの場合:
 *   式: n! / (2^(3*courts) * courts!)
 *
 * 休憩者ありの場合:
 *   式: C(n, restCount) * playingCount! / divisor
 *
 * 例: 2コート、8人（休憩なし）
 * 8! / (2^6 * 2!) = 40320 / (64 * 2) = 40320 / 128 = 315
 *
 * 例: 2コート、10人（2人休憩）
 * C(10, 2) * 315 = 45 * 315 = 14,175
 */
export function estimateNormalizedCount(playersCount: number, courtsCount: number): number {
  const playingCount = courtsCount * 4;
  const restCount = playersCount - playingCount;

  const normalizedPerSelection = estimateArrangementCount(courtsCount, playingCount);

  if (restCount <= 0) {
    return normalizedPerSelection;
  }

  const restingCombinations = binomial(playersCount, restCount);
  return restingCombinations * normalizedPerSelection;
}

/**
 * テンプレートを実プレイヤー番号の配置に変換する
 *
 * @param template - 0-basedインデックスのテンプレート
 * @param playerMap - 実プレイヤー番号の配列
 * @returns 実プレイヤー番号の配置配列
 */
export function templateToArrangement(template: number[], playerMap: number[]): number[] {
  const result = new Array(template.length);
  for (let i = 0; i < template.length; i++) {
    result[i] = playerMap[template[i]];
  }
  return result;
}
