import type { Round, Evaluation, CountMatrix } from '../types/schedule';
import { calculateStandardDeviation, extractUpperTriangleValues } from './statistics';

/**
 * N×N のカウント行列を全て0で初期化する
 *
 * @param playersCount - プレイヤー数
 * @returns 0で埋められた N×N 行列
 *
 * @example
 * initializeCountMatrix(8) // 8×8 のゼロ行列を返す
 *
 * 計算量: O(N²)
 */
export function initializeCountMatrix(playersCount: number): CountMatrix {
  return Array(playersCount)
    .fill(0)
    .map(() => Array(playersCount).fill(0));
}

/**
 * ラウンドに基づいてペア・対戦回数行列を更新する
 *
 * 重要: プレイヤー番号は1始まり、配列インデックスは0始まり
 * インデックス参照時は常に1を引く: pairCounts[player - 1][...]
 *
 * カウント行列は対称: matrix[i][j] = matrix[j][i]
 * 各関係について両方向を更新する必要がある
 *
 * @param round - 処理するラウンド
 * @param pairCounts - 各ペアが一緒にプレイした回数を追跡する対称行列（その場で変更）
 * @param oppoCounts - 各ペアが対戦した回数を追跡する対称行列（その場で変更）
 *
 * @example
 * // 1試合: (1,2) vs (3,4) のラウンド
 * // 更新内容:
 * // - pairCounts[0][1]++ と pairCounts[1][0]++（プレイヤー1-2がペア）
 * // - pairCounts[2][3]++ と pairCounts[3][2]++（プレイヤー3-4がペア）
 * // - oppoCounts[0][2]++, oppoCounts[0][3]++, oppoCounts[1][2]++, oppoCounts[1][3]++（4つの対戦組み合わせ）
 * // - （および対称な更新）
 *
 * 計算量: O(matches * 4²) = O(courts)
 */
export function updateCountMatrices(
  round: Round,
  pairCounts: CountMatrix,
  oppoCounts: CountMatrix
): void {
  for (const match of round.matches) {
    const { pairA, pairB } = match;

    // ペア回数を更新（対称行列）
    // pairA のプレイヤーが一緒にプレイ
    pairCounts[pairA.player1 - 1][pairA.player2 - 1]++;
    pairCounts[pairA.player2 - 1][pairA.player1 - 1]++;

    // pairB のプレイヤーが一緒にプレイ
    pairCounts[pairB.player1 - 1][pairB.player2 - 1]++;
    pairCounts[pairB.player2 - 1][pairB.player1 - 1]++;

    // 対戦回数を更新（pairA vs pairB の全組み合わせ）
    const playersA = [pairA.player1, pairA.player2];
    const playersB = [pairB.player1, pairB.player2];

    for (const pa of playersA) {
      for (const pb of playersB) {
        oppoCounts[pa - 1][pb - 1]++;
        oppoCounts[pb - 1][pa - 1]++;
      }
    }
  }
}

/**
 * ペアと対戦の公平性に基づいてスケジュールの品質を評価する
 *
 * 評価式:
 *   totalScore = pairStdDev * w1 + oppoStdDev * w2
 *
 * スコアが低いほど良い。理想解: pairStdDev = 0, oppoStdDev = 0
 * （全プレイヤーが他の全員と均等にペアを組み、均等に対戦する）
 *
 * @param rounds - 評価する全ラウンド
 * @param playersCount - プレイヤーの総数
 * @param weights - ペアと対戦の公平性の重み（w1 > w2 でペアの公平性を優先）
 * @returns 評価指標
 *
 * @example
 * evaluate([round1, round2, round3], 8, { w1: 1.0, w2: 0.5 })
 * // 戻り値: { pairStdDev: 0.52, oppoStdDev: 0.82, totalScore: 0.93 }
 *
 * 計算量: O(rounds * courts + players²)
 */
export function evaluate(
  rounds: Round[],
  playersCount: number,
  weights: { w1: number; w2: number }
): Evaluation {
  const pairCounts = initializeCountMatrix(playersCount);
  const oppoCounts = initializeCountMatrix(playersCount);

  // 全ラウンドのカウントを累積
  for (const round of rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
  }

  // 上三角の値を抽出（対称行列なので、各ペアを1回だけカウント）
  const pairValues = extractUpperTriangleValues(pairCounts);
  const oppoValues = extractUpperTriangleValues(oppoCounts);

  // 標準偏差を計算
  const pairStdDev = calculateStandardDeviation(pairValues);
  const oppoStdDev = calculateStandardDeviation(oppoValues);

  // 総合スコアを計算（重み付き合計）
  const totalScore = pairStdDev * weights.w1 + oppoStdDev * weights.w2;

  return { pairStdDev, oppoStdDev, totalScore };
}
