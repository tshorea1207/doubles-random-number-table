/**
 * 逐次決定法のユーティリティ関数
 */

import type { CountMatrix, FixedPair } from '../../types/schedule';

/**
 * 配列からランダムに1要素を選択する
 */
export function randomPick(arr: number[]): number {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 配列をその場でシャッフルする（Fisher-Yates）
 */
export function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * 休憩者を1パターン決定する
 *
 * 休憩回数が最少のプレイヤーから優先的に必要人数を選択する。
 * 同じ休憩回数のプレイヤーが複数いる場合はランダムに選ぶ。
 * 固定ペアがある場合、ペアをアトミック単位として扱い分断を防止する。
 *
 * @param allPlayers - 全プレイヤー番号
 * @param restCount - 休憩させる人数
 * @param restCounts - 各プレイヤーの現在の休憩回数（0-based index）
 * @param previousRestingPlayers - 前ラウンドの休憩者（連続休憩回避用、省略可）
 * @param fixedPairs - 固定ペアの配列（固定ペア分断防止用、省略可）
 * @returns 休憩者のプレイヤー番号配列（昇順）
 */
export function selectRestingPlayers(
  allPlayers: number[],
  restCount: number,
  restCounts: number[],
  previousRestingPlayers?: number[],
  fixedPairs?: FixedPair[]
): number[] {
  if (restCount === 0) return [];

  const prevRestSet = new Set(previousRestingPlayers ?? []);
  const activeFixedPairs = (fixedPairs ?? []).filter(
    fp => allPlayers.includes(fp.player1) && allPlayers.includes(fp.player2)
  );

  // 固定ペアなし: 既存ロジック
  if (activeFixedPairs.length === 0) {
    const sorted = [...allPlayers].sort((a, b) => {
      const diff = restCounts[a - 1] - restCounts[b - 1];
      if (diff !== 0) return diff;
      const aPrev = prevRestSet.has(a) ? 1 : 0;
      const bPrev = prevRestSet.has(b) ? 1 : 0;
      if (aPrev !== bPrev) return aPrev - bPrev;
      return Math.random() - 0.5;
    });
    return sorted.slice(0, restCount).sort((a, b) => a - b);
  }

  // 固定ペアあり: アトミック単位（ペア=2枠、ソロ=1枠）で選択
  const fixedPairMembers = new Set<number>();
  for (const fp of activeFixedPairs) {
    fixedPairMembers.add(fp.player1);
    fixedPairMembers.add(fp.player2);
  }
  const soloPlayers = allPlayers.filter(p => !fixedPairMembers.has(p));

  // 各単位のスコアを計算（低い = 休憩優先）
  type RestUnit = { players: number[]; score: number };
  const units: RestUnit[] = [];

  for (const fp of activeFixedPairs) {
    const combinedRest = restCounts[fp.player1 - 1] + restCounts[fp.player2 - 1];
    const prevPenalty = (prevRestSet.has(fp.player1) || prevRestSet.has(fp.player2)) ? 1000 : 0;
    units.push({
      players: [fp.player1, fp.player2],
      score: combinedRest + prevPenalty + Math.random() * 0.1,
    });
  }

  for (const p of soloPlayers) {
    const prevPenalty = prevRestSet.has(p) ? 1000 : 0;
    units.push({
      players: [p],
      // ソロは1人分なのでペアと比較可能にするため2倍
      score: restCounts[p - 1] * 2 + prevPenalty + Math.random() * 0.1,
    });
  }

  units.sort((a, b) => a.score - b.score);

  // 貪欲法で restCount 枠を埋める
  const selected: number[] = [];
  for (const unit of units) {
    if (selected.length + unit.players.length <= restCount) {
      selected.push(...unit.players);
    }
    if (selected.length === restCount) break;
  }

  // restCount を満たせない場合（例: 全員が固定ペア & 奇数restCount）
  // → 固定ペア制約を無視してフォールバック
  if (selected.length < restCount) {
    const sorted = [...allPlayers].sort((a, b) => {
      const diff = restCounts[a - 1] - restCounts[b - 1];
      if (diff !== 0) return diff;
      const aPrev = prevRestSet.has(a) ? 1 : 0;
      const bPrev = prevRestSet.has(b) ? 1 : 0;
      if (aPrev !== bPrev) return aPrev - bPrev;
      return Math.random() - 0.5;
    });
    return sorted.slice(0, restCount).sort((a, b) => a - b);
  }

  return selected.sort((a, b) => a - b);
}

/**
 * 候補からスコア最小のプレイヤーを選択する（タイブレークはランダム）
 */
function pickMinScore(candidates: number[], scoreFn: (p: number) => number): number {
  let minScore = Infinity;
  const best: number[] = [];
  for (const p of candidates) {
    const score = scoreFn(p);
    if (score < minScore) {
      minScore = score;
      best.length = 0;
      best.push(p);
    } else if (score === minScore) {
      best.push(p);
    }
  }
  return best[Math.floor(Math.random() * best.length)];
}

/**
 * available 配列から指定プレイヤーを除去する
 */
function removeFromAvailable(available: number[], player: number): void {
  available.splice(available.indexOf(player), 1);
}

// === Phase 1: ハード制約 + バックトラック ===

/**
 * 1コートの4人をDFSバックトラックで割り当てる（ハード制約）
 *
 * p4で詰まったらp3を変更、p3で詰まったらp2を変更…と系統的に探索する。
 * ハード制約が充足不可能な場合は null を返す。
 *
 * @param available - 利用可能なプレイヤー番号（成功時のみ変更される）
 * @param pairHistory - ペア履歴行列
 * @param opponentHistory - 対戦履歴行列
 * @returns 成功時: [p1, p2, p3, p4]、失敗時: null
 */
export function tryAssignCourtWithBacktracking(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
): [number, number, number, number] | null {
  if (available.length < 4) return null;

  const shuffled = shuffle([...available]);

  for (const p1 of shuffled) {
    const p2Candidates = shuffled.filter(p =>
      p !== p1 && pairHistory[p1 - 1][p - 1] === 0
    );

    for (const p2 of p2Candidates) {
      const p3Candidates = shuffled.filter(p =>
        p !== p1 && p !== p2 &&
        opponentHistory[p1 - 1][p - 1] === 0 &&
        opponentHistory[p2 - 1][p - 1] === 0
      );

      for (const p3 of p3Candidates) {
        const p4Candidates = shuffled.filter(p =>
          p !== p1 && p !== p2 && p !== p3 &&
          opponentHistory[p1 - 1][p - 1] === 0 &&
          opponentHistory[p2 - 1][p - 1] === 0 &&
          pairHistory[p3 - 1][p - 1] === 0
        );

        if (p4Candidates.length > 0) {
          const p4 = p4Candidates[0];
          removeFromAvailable(available, p1);
          removeFromAvailable(available, p2);
          removeFromAvailable(available, p3);
          removeFromAvailable(available, p4);
          return [p1, p2, p3, p4];
        }
      }
    }
  }

  return null;
}

// === Phase 1: ペア＋対戦ハード制約バックトラック ===

/**
 * 固定ペアを考慮したDFSバックトラック割り当て（ハード制約）
 *
 * 固定ペアが available に両方いる場合、それを p1, p2 として使用し、
 * p3, p4 をバックトラックで探索する。
 * 固定ペアがない場合は通常のバックトラック版にフォールバックする。
 */
export function tryAssignCourtWithBacktrackingFixedPairs(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
  fixedPairs: FixedPair[],
): [number, number, number, number] | null {
  const availableSet = new Set(available);
  const applicableFixed = fixedPairs.filter(
    fp => availableSet.has(fp.player1) && availableSet.has(fp.player2)
  );

  if (applicableFixed.length > 0) {
    const shuffledFixed = shuffle([...applicableFixed]);
    for (const fp of shuffledFixed) {
      const p1 = fp.player1;
      const p2 = fp.player2;
      const remaining = shuffle(available.filter(p => p !== p1 && p !== p2));

      for (const p3 of remaining) {
        if (opponentHistory[p1 - 1][p3 - 1] !== 0 || opponentHistory[p2 - 1][p3 - 1] !== 0) continue;

        const p4Candidates = remaining.filter(p =>
          p !== p3 &&
          opponentHistory[p1 - 1][p - 1] === 0 &&
          opponentHistory[p2 - 1][p - 1] === 0 &&
          pairHistory[p3 - 1][p - 1] === 0
        );

        if (p4Candidates.length > 0) {
          const p4 = p4Candidates[0];
          removeFromAvailable(available, p1);
          removeFromAvailable(available, p2);
          removeFromAvailable(available, p3);
          removeFromAvailable(available, p4);
          return [p1, p2, p3, p4];
        }
      }
    }
    return null;
  }

  return tryAssignCourtWithBacktracking(available, pairHistory, opponentHistory);
}

// === Phase 1.5: 対戦制約のみバックトラック ===

/**
 * 1コートの4人をDFSバックトラックで割り当てる（対戦制約のみ）
 *
 * Phase 1.5: ペア制約を緩和し、対戦のみのハード制約で探索する。
 * ペア回数の少ない相手をソフト優先する。
 *
 * @param available - 利用可能なプレイヤー番号（成功時のみ変更される）
 * @param pairHistory - ペア履歴行列（ソフト制約として参照）
 * @param opponentHistory - 対戦履歴行列（ハード制約）
 * @returns 成功時: [p1, p2, p3, p4]、失敗時: null
 */
export function tryAssignCourtOpponentOnly(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
): [number, number, number, number] | null {
  if (available.length < 4) return null;

  const shuffled = shuffle([...available]);

  for (const p1 of shuffled) {
    // p2: ペア制約なし、ペア回数昇順でソフト優先
    const p2Candidates = shuffled
      .filter(p => p !== p1)
      .sort((a, b) => pairHistory[p1 - 1][a - 1] - pairHistory[p1 - 1][b - 1]);

    for (const p2 of p2Candidates) {
      const p3Candidates = shuffled.filter(p =>
        p !== p1 && p !== p2 &&
        opponentHistory[p1 - 1][p - 1] === 0 &&
        opponentHistory[p2 - 1][p - 1] === 0
      );

      for (const p3 of p3Candidates) {
        const p4Candidates = shuffled.filter(p =>
          p !== p1 && p !== p2 && p !== p3 &&
          opponentHistory[p1 - 1][p - 1] === 0 &&
          opponentHistory[p2 - 1][p - 1] === 0
        );

        if (p4Candidates.length > 0) {
          // p4候補の中でp3とのペア回数が最小のものを選択
          const p4 = p4Candidates.reduce((best, p) =>
            pairHistory[p3 - 1][p - 1] < pairHistory[p3 - 1][best - 1] ? p : best
          );
          removeFromAvailable(available, p1);
          removeFromAvailable(available, p2);
          removeFromAvailable(available, p3);
          removeFromAvailable(available, p4);
          return [p1, p2, p3, p4];
        }
      }
    }
  }

  return null;
}

// === Phase 1.5: 対戦制約のみバックトラック ===

/**
 * 固定ペアを考慮した対戦制約のみバックトラック（Phase 1.5）
 */
export function tryAssignCourtOpponentOnlyFixedPairs(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
  fixedPairs: FixedPair[],
): [number, number, number, number] | null {
  const availableSet = new Set(available);
  const applicableFixed = fixedPairs.filter(
    fp => availableSet.has(fp.player1) && availableSet.has(fp.player2)
  );

  if (applicableFixed.length > 0) {
    const shuffledFixed = shuffle([...applicableFixed]);
    for (const fp of shuffledFixed) {
      const p1 = fp.player1;
      const p2 = fp.player2;
      const remaining = shuffle(available.filter(p => p !== p1 && p !== p2));

      for (const p3 of remaining) {
        if (opponentHistory[p1 - 1][p3 - 1] !== 0 || opponentHistory[p2 - 1][p3 - 1] !== 0) continue;

        const p4Candidates = remaining.filter(p =>
          p !== p3 &&
          opponentHistory[p1 - 1][p - 1] === 0 &&
          opponentHistory[p2 - 1][p - 1] === 0
        );

        if (p4Candidates.length > 0) {
          const p4 = p4Candidates.reduce((best, p) =>
            pairHistory[p3 - 1][p - 1] < pairHistory[p3 - 1][best - 1] ? p : best
          );
          removeFromAvailable(available, p1);
          removeFromAvailable(available, p2);
          removeFromAvailable(available, p3);
          removeFromAvailable(available, p4);
          return [p1, p2, p3, p4];
        }
      }
    }
    return null;
  }

  return tryAssignCourtOpponentOnly(available, pairHistory, opponentHistory);
}

// === Phase 2: スコアリングベースのフォールバック（常に成功） ===

/**
 * 連続対戦ペナルティを計算するヘルパー
 */
function consecutiveOpponentPenalty(
  player: number,
  opponents: number[],
  previousOpponents?: Map<number, Set<number>>,
): number {
  if (!previousOpponents) return 0;
  const PENALTY = 100;
  let penalty = 0;
  const prevSet = previousOpponents.get(player);
  if (prevSet) {
    for (const opp of opponents) {
      if (prevSet.has(opp)) penalty += PENALTY;
    }
  }
  return penalty;
}

/**
 * 1コートの4人をスコアリングで割り当てる（常に成功）
 *
 * ハード制約の代わりに、履歴カウントが最小のプレイヤーを優先的に選択する。
 * 制約が充足不可能な状況でも必ず結果を返す。
 * 連続対戦にはペナルティを加算して回避する。
 *
 * @param available - 利用可能なプレイヤー番号（この関数内で変更される）
 * @param pairHistory - ペア履歴行列
 * @param opponentHistory - 対戦履歴行列
 * @param previousOpponents - 前ラウンドの対戦相手マップ（連続対戦回避用）
 * @returns [p1, p2, p3, p4]（常に成功）
 */
export function assignCourtWithScoring(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
  previousOpponents?: Map<number, Set<number>>,
): [number, number, number, number] {
  const p1 = randomPick(available);
  removeFromAvailable(available, p1);

  const p2 = pickMinScore(available, p => pairHistory[p1 - 1][p - 1]);
  removeFromAvailable(available, p2);

  const p3 = pickMinScore(available, p =>
    opponentHistory[p1 - 1][p - 1] + opponentHistory[p2 - 1][p - 1]
    + consecutiveOpponentPenalty(p, [p1, p2], previousOpponents)
  );
  removeFromAvailable(available, p3);

  const p4 = pickMinScore(available, p =>
    opponentHistory[p1 - 1][p - 1] + opponentHistory[p2 - 1][p - 1] + pairHistory[p3 - 1][p - 1]
    + consecutiveOpponentPenalty(p, [p1, p2], previousOpponents)
  );
  removeFromAvailable(available, p4);

  return [p1, p2, p3, p4];
}

/**
 * 固定ペアを考慮したスコアリング割り当て（常に成功）
 */
export function assignCourtWithScoringFixedPairs(
  available: number[],
  pairHistory: CountMatrix,
  opponentHistory: CountMatrix,
  fixedPairs: FixedPair[],
  previousOpponents?: Map<number, Set<number>>,
): [number, number, number, number] {
  const availableSet = new Set(available);
  const applicableFixed = fixedPairs.filter(
    fp => availableSet.has(fp.player1) && availableSet.has(fp.player2)
  );

  if (applicableFixed.length > 0) {
    const fp = applicableFixed[Math.floor(Math.random() * applicableFixed.length)];
    const p1 = fp.player1;
    const p2 = fp.player2;
    removeFromAvailable(available, p1);
    removeFromAvailable(available, p2);

    const p3 = pickMinScore(available, p =>
      opponentHistory[p1 - 1][p - 1] + opponentHistory[p2 - 1][p - 1]
      + consecutiveOpponentPenalty(p, [p1, p2], previousOpponents)
    );
    removeFromAvailable(available, p3);

    const p4 = pickMinScore(available, p =>
      opponentHistory[p1 - 1][p - 1] + opponentHistory[p2 - 1][p - 1] + pairHistory[p3 - 1][p - 1]
      + consecutiveOpponentPenalty(p, [p1, p2], previousOpponents)
    );
    removeFromAvailable(available, p4);

    return [p1, p2, p3, p4];
  }

  return assignCourtWithScoring(available, pairHistory, opponentHistory, previousOpponents);
}

/**
 * コート割り当て結果からMatch配列を構築し正規化する
 *
 * @param courtAssignments - 各コートの [p1, p2, p3, p4] 配列
 * @returns 正規化されたMatch配列
 */
export function buildNormalizedMatches(
  courtAssignments: [number, number, number, number][]
): { pairA: { player1: number; player2: number }; pairB: { player1: number; player2: number } }[] {
  const matches = courtAssignments.map(([p1, p2, p3, p4]) => {
    // ペア内ソート
    const pair1 = p1 < p2 ? { player1: p1, player2: p2 } : { player1: p2, player2: p1 };
    const pair2 = p3 < p4 ? { player1: p3, player2: p4 } : { player1: p4, player2: p3 };

    // ペア間ソート: min(pairA) < min(pairB)
    const minPair1 = Math.min(pair1.player1, pair1.player2);
    const minPair2 = Math.min(pair2.player1, pair2.player2);
    if (minPair1 < minPair2) {
      return { pairA: pair1, pairB: pair2 };
    } else {
      return { pairA: pair2, pairB: pair1 };
    }
  });

  // コート割り当てをランダム化（評価品質に影響なし）
  shuffle(matches);

  return matches;
}
