import type { Round, Match } from '../types/schedule';

/**
 * 配列が正規化ルールを満たしているか確認する
 *
 * 正規化ルールにより、等価な配列を排除して探索空間を削減する:
 * 1. 各ペア内: player1 < player2
 * 2. 同一コート内のペア間: min(pairA) < min(pairB)
 * 3. コート間: min(court[i]) < min(court[i+1])
 *
 * 2コート8人の場合: 8! = 40,320 通りの配列が 315 通りに削減される
 *
 * @param arrangement - プレイヤー番号の配列（1始まり）、形式: [p1,p2,p3,p4, p5,p6,p7,p8, ...]
 *                      4人ごとのグループが1つのコートを表す（2人ずつのペアが2組）
 * @param courtsCount - 配列に含まれるコート数
 * @returns 配列が正規化されている場合は true、そうでなければ false
 *
 * @example
 * // 有効（正規化済み）:
 * isNormalized([1,2,3,4, 5,6,7,8], 2) // true
 * // コート1: (1,2):(3,4)、コート2: (5,6):(7,8)
 *
 * // 無効（ペアがソートされていない）:
 * isNormalized([2,1,3,4, 5,6,7,8], 2) // false
 * // ルール1違反: player1 は player2 より小さくなければならない
 *
 * // 無効（ペア間がソートされていない）:
 * isNormalized([3,4,1,2, 5,6,7,8], 2) // false
 * // ルール2違反: min(3,4)=3 は min(1,2)=1 より小さくなければならない
 *
 * // 無効（コート間がソートされていない）:
 * isNormalized([5,6,7,8, 1,2,3,4], 2) // false
 * // ルール3違反: min(court1)=5 は min(court2)=1 より小さくなければならない
 *
 * 計算量: O(courtsCount)
 */
export function isNormalized(arrangement: number[], courtsCount: number): boolean {
  const playersPerCourt = 4;

  // 各コートをチェック
  for (let courtIdx = 0; courtIdx < courtsCount; courtIdx++) {
    const offset = courtIdx * playersPerCourt;
    const court = arrangement.slice(offset, offset + playersPerCourt);

    // ルール1: 各ペア内で player1 < player2
    if (court[0] >= court[1]) return false; // ペアA
    if (court[2] >= court[3]) return false; // ペアB

    // ルール2: 同一コート内のペア間で min(pairA) < min(pairB)
    const minPairA = Math.min(court[0], court[1]);
    const minPairB = Math.min(court[2], court[3]);
    if (minPairA >= minPairB) return false;
  }

  // ルール3: コート間で min(court[i]) < min(court[i+1])
  if (courtsCount > 1) {
    for (let i = 0; i < courtsCount - 1; i++) {
      const offset1 = i * playersPerCourt;
      const offset2 = (i + 1) * playersPerCourt;

      const minCourt1 = Math.min(...arrangement.slice(offset1, offset1 + playersPerCourt));
      const minCourt2 = Math.min(...arrangement.slice(offset2, offset2 + playersPerCourt));

      if (minCourt1 >= minCourt2) return false;
    }
  }

  return true;
}

/**
 * 配列を Round オブジェクトに変換する
 *
 * @param arrangement - [p1,p2,p3,p4, p5,p6,p7,p8, ...] 形式のプレイヤー番号配列
 * @param courtsCount - コート数
 * @param roundNumber - ラウンド番号（1始まり）
 * @returns マッチを含む Round オブジェクト
 *
 * @example
 * arrangementToRound([1,2,3,4, 5,6,7,8], 2, 1)
 * // 戻り値:
 * // {
 * //   roundNumber: 1,
 * //   matches: [
 * //     { pairA: {player1: 1, player2: 2}, pairB: {player1: 3, player2: 4} },
 * //     { pairA: {player1: 5, player2: 6}, pairB: {player1: 7, player2: 8} }
 * //   ]
 * // }
 *
 * 計算量: O(courtsCount)
 */
export function arrangementToRound(
  arrangement: number[],
  courtsCount: number,
  roundNumber: number
): Round {
  const matches: Match[] = [];

  for (let courtIdx = 0; courtIdx < courtsCount; courtIdx++) {
    const offset = courtIdx * 4;
    const [p1, p2, p3, p4] = arrangement.slice(offset, offset + 4);

    matches.push({
      pairA: { player1: p1, player2: p2 },
      pairB: { player1: p3, player2: p4 },
    });
  }

  return { roundNumber, matches, restingPlayers: [] };
}

/**
 * 配列と休憩者を Round オブジェクトに変換する
 *
 * @param arrangement - [p1,p2,p3,p4, p5,p6,p7,p8, ...] 形式のプレイヤー番号配列
 * @param courtsCount - コート数
 * @param roundNumber - ラウンド番号（1始まり）
 * @param restingPlayers - 休憩するプレイヤー番号の配列
 * @returns マッチと休憩者を含む Round オブジェクト
 *
 * @example
 * arrangementToRoundWithRest([1,2,3,4, 5,6,7,8], 2, 1, [9, 10])
 * // 戻り値:
 * // {
 * //   roundNumber: 1,
 * //   matches: [
 * //     { pairA: {player1: 1, player2: 2}, pairB: {player1: 3, player2: 4} },
 * //     { pairA: {player1: 5, player2: 6}, pairB: {player1: 7, player2: 8} }
 * //   ],
 * //   restingPlayers: [9, 10]
 * // }
 *
 * 計算量: O(courtsCount)
 */
export function arrangementToRoundWithRest(
  arrangement: number[],
  courtsCount: number,
  roundNumber: number,
  restingPlayers: number[]
): Round {
  const matches: Match[] = [];

  for (let courtIdx = 0; courtIdx < courtsCount; courtIdx++) {
    const offset = courtIdx * 4;
    const [p1, p2, p3, p4] = arrangement.slice(offset, offset + 4);

    matches.push({
      pairA: { player1: p1, player2: p2 },
      pairB: { player1: p3, player2: p4 },
    });
  }

  return { roundNumber, matches, restingPlayers: restingPlayers.slice().sort((a, b) => a - b) };
}
