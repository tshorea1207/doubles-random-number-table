import type { Round, Evaluation, CountMatrix, RestCounts, CumulativeState } from '../types/schedule';
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
 * 休憩回数カウント配列を全て0で初期化する
 *
 * @param playersCount - プレイヤー数
 * @returns 0で埋められた長さNの配列
 *
 * @example
 * initializeRestCounts(10) // [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
 *
 * 計算量: O(N)
 */
export function initializeRestCounts(playersCount: number): RestCounts {
  return Array(playersCount).fill(0);
}

/**
 * ラウンドに基づいて休憩回数カウントを更新する
 *
 * 重要: プレイヤー番号は1始まり、配列インデックスは0始まり
 * インデックス参照時は常に1を引く: restCounts[player - 1]
 *
 * @param round - 処理するラウンド
 * @param restCounts - 各プレイヤーの休憩回数を追跡する配列（その場で変更）
 *
 * @example
 * // restingPlayers: [9, 10] のラウンド
 * // 更新内容:
 * // - restCounts[8]++（プレイヤー9が休憩）
 * // - restCounts[9]++（プレイヤー10が休憩）
 *
 * 計算量: O(休憩者数)
 */
export function updateRestCounts(round: Round, restCounts: RestCounts): void {
  for (const player of round.restingPlayers) {
    restCounts[player - 1]++;
  }
}

/**
 * ペア、対戦、休憩の公平性に基づいてスケジュールの品質を評価する
 *
 * 評価式:
 *   totalScore = pairStdDev * w1 + oppoStdDev * w2 + restStdDev * w3
 *
 * スコアが低いほど良い。理想解: pairStdDev = 0, oppoStdDev = 0, restStdDev = 0
 * （全プレイヤーが他の全員と均等にペアを組み、均等に対戦し、均等に休憩する）
 *
 * @param rounds - 評価する全ラウンド
 * @param playersCount - プレイヤーの総数
 * @param weights - 公平性の重み（w1: ペア、w2: 対戦、w3: 休憩）
 * @returns 評価指標
 *
 * @example
 * evaluate([round1, round2, round3], 10, { w1: 1.0, w2: 0.5, w3: 2.0 })
 * // 戻り値: { pairStdDev: 0.52, oppoStdDev: 0.82, restStdDev: 0.47, totalScore: 1.87 }
 *
 * 計算量: O(rounds * courts + players²)
 */
export function evaluate(
  rounds: Round[],
  playersCount: number,
  weights: { w1: number; w2: number; w3: number }
): Evaluation {
  const pairCounts = initializeCountMatrix(playersCount);
  const oppoCounts = initializeCountMatrix(playersCount);
  const restCounts = initializeRestCounts(playersCount);

  // 全ラウンドのカウントを累積
  for (const round of rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
    updateRestCounts(round, restCounts);
  }

  // 上三角の値を抽出（対称行列なので、各ペアを1回だけカウント）
  const pairValues = extractUpperTriangleValues(pairCounts);
  const oppoValues = extractUpperTriangleValues(oppoCounts);

  // 標準偏差を計算
  const pairStdDev = calculateStandardDeviation(pairValues);
  const oppoStdDev = calculateStandardDeviation(oppoValues);
  const restStdDev = calculateStandardDeviation(restCounts);

  // 総合スコアを計算（重み付き合計）
  const totalScore = pairStdDev * weights.w1 + oppoStdDev * weights.w2 + restStdDev * weights.w3;

  return { pairStdDev, oppoStdDev, restStdDev, totalScore };
}

/**
 * 累積状態を初期化する
 *
 * @param playersCount - プレイヤー数
 * @returns 全て0で初期化された累積状態
 *
 * 計算量: O(N²)
 */
export function createCumulativeState(playersCount: number): CumulativeState {
  const n = playersCount * (playersCount - 1) / 2;
  return {
    pairCounts: initializeCountMatrix(playersCount),
    oppoCounts: initializeCountMatrix(playersCount),
    restCounts: initializeRestCounts(playersCount),
    pairSum: 0,
    pairSumSq: 0,
    pairN: n,
    oppoSum: 0,
    oppoSumSq: 0,
    oppoN: n,
    restSum: 0,
    restSumSq: 0,
    restN: playersCount,
  };
}

/**
 * ラウンドの結果を累積状態に反映する（状態を変更する）
 *
 * カウント行列と統計サマリ（sum, sumSq）の両方を更新する。
 * sumSq の増分: 値が v → v+1 になるとき、v² → (v+1)² なので差分は 2v+1
 *
 * @param state - 更新する累積状態（その場で変更）
 * @param round - 反映するラウンド
 *
 * 計算量: O(courts)
 */
export function commitRoundToState(state: CumulativeState, round: Round): void {
  for (const match of round.matches) {
    const { pairA, pairB } = match;

    // ペア回数: pairA (正規化済み: player1 < player2)
    const pa1 = pairA.player1 - 1;
    const pa2 = pairA.player2 - 1;
    const oldPairA = state.pairCounts[pa1][pa2];
    state.pairCounts[pa1][pa2]++;
    state.pairCounts[pa2][pa1]++;
    state.pairSum += 1;
    state.pairSumSq += 2 * oldPairA + 1;

    // ペア回数: pairB (正規化済み: player1 < player2)
    const pb1 = pairB.player1 - 1;
    const pb2 = pairB.player2 - 1;
    const oldPairB = state.pairCounts[pb1][pb2];
    state.pairCounts[pb1][pb2]++;
    state.pairCounts[pb2][pb1]++;
    state.pairSum += 1;
    state.pairSumSq += 2 * oldPairB + 1;

    // 対戦回数: pairA vs pairB の4組み合わせ（配列生成なしで直接展開）
    const a1 = pairA.player1;
    const a2 = pairA.player2;
    const b1 = pairB.player1;
    const b2 = pairB.player2;

    {
      const oi = Math.min(a1, b1) - 1;
      const oj = Math.max(a1, b1) - 1;
      const oldOppo = state.oppoCounts[oi][oj];
      state.oppoCounts[oi][oj]++;
      state.oppoCounts[oj][oi]++;
      state.oppoSum += 1;
      state.oppoSumSq += 2 * oldOppo + 1;
    }
    {
      const oi = Math.min(a1, b2) - 1;
      const oj = Math.max(a1, b2) - 1;
      const oldOppo = state.oppoCounts[oi][oj];
      state.oppoCounts[oi][oj]++;
      state.oppoCounts[oj][oi]++;
      state.oppoSum += 1;
      state.oppoSumSq += 2 * oldOppo + 1;
    }
    {
      const oi = Math.min(a2, b1) - 1;
      const oj = Math.max(a2, b1) - 1;
      const oldOppo = state.oppoCounts[oi][oj];
      state.oppoCounts[oi][oj]++;
      state.oppoCounts[oj][oi]++;
      state.oppoSum += 1;
      state.oppoSumSq += 2 * oldOppo + 1;
    }
    {
      const oi = Math.min(a2, b2) - 1;
      const oj = Math.max(a2, b2) - 1;
      const oldOppo = state.oppoCounts[oi][oj];
      state.oppoCounts[oi][oj]++;
      state.oppoCounts[oj][oi]++;
      state.oppoSum += 1;
      state.oppoSumSq += 2 * oldOppo + 1;
    }
  }

  // 休憩回数
  for (const player of round.restingPlayers) {
    const idx = player - 1;
    const oldRest = state.restCounts[idx];
    state.restCounts[idx]++;
    state.restSum += 1;
    state.restSumSq += 2 * oldRest + 1;
  }
}

/**
 * 候補配置のスコアを累積状態から増分計算する（状態を変更しない）
 *
 * 累積状態の現在のカウント値を読み取り、候補ラウンドを追加した場合の
 * 標準偏差を sum/sumSq から直接計算する。
 * stddev = sqrt(sumSq/n - (sum/n)²)
 *
 * @param state - 現在の累積状態（変更しない）
 * @param template - 0-basedインデックスの正規化済み配置テンプレート
 * @param courtsCount - コート数
 * @param playerMap - テンプレートインデックスを実プレイヤー番号に変換する配列
 * @param restingPlayers - 休憩者リスト（実プレイヤー番号）
 * @param weights - 評価の重み
 * @returns totalScore（小さいほど良い）
 *
 * 計算量: O(courts)
 */
export function evaluateCandidate(
  state: CumulativeState,
  template: number[],
  courtsCount: number,
  playerMap: number[],
  restingPlayers: number[],
  weights: { w1: number; w2: number; w3: number }
): number {
  let pairSum = state.pairSum;
  let pairSumSq = state.pairSumSq;
  let oppoSum = state.oppoSum;
  let oppoSumSq = state.oppoSumSq;
  let restSum = state.restSum;
  let restSumSq = state.restSumSq;

  for (let c = 0; c < courtsCount; c++) {
    const offset = c * 4;
    const p1 = playerMap[template[offset]];
    const p2 = playerMap[template[offset + 1]];
    const p3 = playerMap[template[offset + 2]];
    const p4 = playerMap[template[offset + 3]];

    // ペア: (p1, p2) - 正規化済み (p1 < p2)
    const oldPair1 = state.pairCounts[p1 - 1][p2 - 1];
    pairSum += 1;
    pairSumSq += 2 * oldPair1 + 1;

    // ペア: (p3, p4) - 正規化済み (p3 < p4)
    const oldPair2 = state.pairCounts[p3 - 1][p4 - 1];
    pairSum += 1;
    pairSumSq += 2 * oldPair2 + 1;

    // 対戦: (p1,p2) vs (p3,p4) の4組み合わせ（配列生成なしで直接展開）
    {
      const oi = p1 < p3 ? p1 - 1 : p3 - 1;
      const oj = p1 < p3 ? p3 - 1 : p1 - 1;
      oppoSum += 1;
      oppoSumSq += 2 * state.oppoCounts[oi][oj] + 1;
    }
    {
      const oi = p1 < p4 ? p1 - 1 : p4 - 1;
      const oj = p1 < p4 ? p4 - 1 : p1 - 1;
      oppoSum += 1;
      oppoSumSq += 2 * state.oppoCounts[oi][oj] + 1;
    }
    {
      const oi = p2 < p3 ? p2 - 1 : p3 - 1;
      const oj = p2 < p3 ? p3 - 1 : p2 - 1;
      oppoSum += 1;
      oppoSumSq += 2 * state.oppoCounts[oi][oj] + 1;
    }
    {
      const oi = p2 < p4 ? p2 - 1 : p4 - 1;
      const oj = p2 < p4 ? p4 - 1 : p2 - 1;
      oppoSum += 1;
      oppoSumSq += 2 * state.oppoCounts[oi][oj] + 1;
    }
  }

  // 休憩
  for (const player of restingPlayers) {
    const oldRest = state.restCounts[player - 1];
    restSum += 1;
    restSumSq += 2 * oldRest + 1;
  }

  // stddev = sqrt(sumSq/n - (sum/n)²)
  const pairStdDev = Math.sqrt(Math.max(0, pairSumSq / state.pairN - (pairSum / state.pairN) ** 2));
  const oppoStdDev = Math.sqrt(Math.max(0, oppoSumSq / state.oppoN - (oppoSum / state.oppoN) ** 2));
  const restStdDev = state.restN > 0
    ? Math.sqrt(Math.max(0, restSumSq / state.restN - (restSum / state.restN) ** 2))
    : 0;

  return pairStdDev * weights.w1 + oppoStdDev * weights.w2 + restStdDev * weights.w3;
}

/**
 * 累積状態から Evaluation オブジェクトを計算する
 *
 * @param state - 現在の累積状態
 * @param weights - 評価の重み
 * @returns 評価指標
 *
 * 計算量: O(1)
 */
export function evaluateFromState(
  state: CumulativeState,
  weights: { w1: number; w2: number; w3: number }
): Evaluation {
  const pairStdDev = Math.sqrt(Math.max(0, state.pairSumSq / state.pairN - (state.pairSum / state.pairN) ** 2));
  const oppoStdDev = Math.sqrt(Math.max(0, state.oppoSumSq / state.oppoN - (state.oppoSum / state.oppoN) ** 2));
  const restStdDev = state.restN > 0
    ? Math.sqrt(Math.max(0, state.restSumSq / state.restN - (state.restSum / state.restN) ** 2))
    : 0;
  const totalScore = pairStdDev * weights.w1 + oppoStdDev * weights.w2 + restStdDev * weights.w3;

  return { pairStdDev, oppoStdDev, restStdDev, totalScore };
}
