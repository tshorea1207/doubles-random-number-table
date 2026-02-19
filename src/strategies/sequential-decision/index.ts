/**
 * 逐次決定法（Sequential Decision Method）ストラテジー
 *
 * アルゴリズム:
 * 1. 各ラウンドで、コートごとにプレイヤーを1人ずつ制約付きでランダム選択
 * 2. 制約（未ペア・未対戦）を満たせない場合はラウンド全体をリトライ
 * 3. 高速（O(R × C × N)）だが、解の品質は貪欲法に劣る可能性がある
 */

import type { ScheduleStrategy, StrategyMeta, ProgressCallbacks } from "../types";
import type { Schedule, ScheduleParams, RegenerationParams, Round, Match, CountMatrix, FixedPair } from "../../types/schedule";
import { createInitialArrangement } from "../../utils/permutation";
import { arrangementToRoundWithRest } from "../../utils/normalization";
import {
  initializeCountMatrix,
  initializeRestCounts,
  updateCountMatrices,
  updateRestCounts,
  createCumulativeState,
  commitRoundToState,
  evaluateFromState,
  buildCumulativeStateForActivePlayers,
  extractPreviousOpponents,
} from "../../utils/evaluation";
import {
  shuffle,
  selectRestingPlayers,
  tryAssignCourtWithBacktracking,
  tryAssignCourtWithBacktrackingFixedPairs,
  tryAssignCourtOpponentOnly,
  tryAssignCourtOpponentOnlyFixedPairs,
  assignCourtWithScoring,
  assignCourtWithScoringFixedPairs,
  buildNormalizedMatches,
} from "./sequentialUtils";

const MAX_RETRY_HARD = 100; // Phase1   ハードペア制約
const MAX_RETRY_OPPO = 100; // Phase1.5 ハード対戦制約
const MAX_RETRY_SOFT = 100; // Phase2   ソフト制約
const PAIR_MAX_PENALTY = 100; // 最大ペア制約
const OPPO_MAX_PENALTY = 100; // 最大対戦制約
const CONSECUTIVE_OPPONENT_PENALTY = 100; // 連続対戦ペナルティ

export class SequentialDecisionStrategy implements ScheduleStrategy {
  readonly meta: StrategyMeta = {
    id: "sequential-decision",
    name: "逐次決定法",
    description: "ランダム選択と制約チェックによる高速スケジュール生成",
    isExperimental: true,
  };

  estimateTotalEvaluations(_playersCount: number, _courtsCount: number, roundsCount: number): number {
    return roundsCount;
  }

  generateSchedule(params: ScheduleParams): Schedule {
    const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

    const allPlayers = createInitialArrangement(playersCount);
    const pairHistory = initializeCountMatrix(playersCount);
    const opponentHistory = initializeCountMatrix(playersCount);
    const restCounts = initializeRestCounts(playersCount);
    const rounds: Round[] = [];

    // ラウンド1: 固定配置
    const firstRound = this.createFirstRound(allPlayers, courtsCount);
    rounds.push(firstRound);
    updateCountMatrices(firstRound, pairHistory, opponentHistory);
    updateRestCounts(firstRound, restCounts);

    // ラウンド2以降: ランダム逐次決定
    for (let r = 2; r <= roundsCount; r++) {
      const previousRound = rounds[rounds.length - 1];
      const round = this.generateRound(r, allPlayers, courtsCount, pairHistory, opponentHistory, restCounts, fixedPairs, previousRound);
      rounds.push(round);
      updateCountMatrices(round, pairHistory, opponentHistory);
      updateRestCounts(round, restCounts);
    }

    const cumulativeState = createCumulativeState(playersCount);
    for (const round of rounds) {
      commitRoundToState(cumulativeState, round);
    }
    const evaluation = evaluateFromState(cumulativeState, weights);

    return {
      courts: courtsCount,
      players: playersCount,
      rounds,
      evaluation,
      fixedPairs,
      activePlayers: allPlayers,
    };
  }

  async generateScheduleAsync(params: ScheduleParams, callbacks: ProgressCallbacks, signal?: AbortSignal): Promise<Schedule> {
    const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

    const allPlayers = createInitialArrangement(playersCount);
    const pairHistory = initializeCountMatrix(playersCount);
    const opponentHistory = initializeCountMatrix(playersCount);
    const restCounts = initializeRestCounts(playersCount);
    const rounds: Round[] = [];

    callbacks.onProgress({
      currentEvaluations: 0,
      totalEvaluations: roundsCount,
      percentage: 0,
      currentRound: 1,
      totalRounds: roundsCount,
    });

    // ラウンド1: 固定配置
    const firstRound = this.createFirstRound(allPlayers, courtsCount);
    rounds.push(firstRound);
    updateCountMatrices(firstRound, pairHistory, opponentHistory);
    updateRestCounts(firstRound, restCounts);
    callbacks.onRoundComplete?.([...rounds], 1);
    callbacks.onProgress({
      currentEvaluations: 1,
      totalEvaluations: roundsCount,
      percentage: Math.round((1 / roundsCount) * 100),
      currentRound: 1,
      totalRounds: roundsCount,
    });

    // ラウンド2以降: ランダム逐次決定
    for (let r = 2; r <= roundsCount; r++) {
      if (signal?.aborted) {
        throw new DOMException("Generation cancelled", "AbortError");
      }

      const previousRound = rounds[rounds.length - 1];
      const round = this.generateRound(r, allPlayers, courtsCount, pairHistory, opponentHistory, restCounts, fixedPairs, previousRound);
      rounds.push(round);
      updateCountMatrices(round, pairHistory, opponentHistory);
      updateRestCounts(round, restCounts);

      callbacks.onRoundComplete?.([...rounds], r);
      callbacks.onProgress({
        currentEvaluations: r,
        totalEvaluations: roundsCount,
        percentage: Math.round((r / roundsCount) * 100),
        currentRound: r,
        totalRounds: roundsCount,
      });

      // UIスレッドに制御を返す
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    const cumulativeState = createCumulativeState(playersCount);
    for (const round of rounds) {
      commitRoundToState(cumulativeState, round);
    }
    const evaluation = evaluateFromState(cumulativeState, weights);

    return {
      courts: courtsCount,
      players: playersCount,
      rounds,
      evaluation,
      fixedPairs,
      activePlayers: allPlayers,
    };
  }

  async generateRemainingScheduleAsync(params: RegenerationParams, callbacks: ProgressCallbacks, signal?: AbortSignal): Promise<Schedule> {
    const { courtsCount, completedRounds, activePlayers, remainingRoundsCount, weights, fixedPairs } = params;

    if (activePlayers.length < courtsCount * 4) {
      throw new Error(`参加者数（${activePlayers.length}人）がコート数（${courtsCount}面）に必要な${courtsCount * 4}人を下回っています`);
    }

    const maxPlayerNumber = Math.max(...activePlayers);
    const allRounds: Round[] = [...completedRounds];

    // 完了済みラウンドから履歴を再構築
    const pairHistory = initializeCountMatrix(maxPlayerNumber);
    const opponentHistory = initializeCountMatrix(maxPlayerNumber);
    const restCounts = initializeRestCounts(maxPlayerNumber);

    for (const round of completedRounds) {
      updateCountMatrices(round, pairHistory, opponentHistory);
      updateRestCounts(round, restCounts);
    }

    const totalRounds = completedRounds.length + remainingRoundsCount;

    // 消化済みラウンドが使用しているroundNumberを除外した空き番号リストを生成
    const usedRoundNumbers = new Set(completedRounds.map((r) => r.roundNumber));
    const freeRoundNumbers: number[] = [];
    for (let n = 1; n <= totalRounds; n++) {
      if (!usedRoundNumbers.has(n)) {
        freeRoundNumbers.push(n);
      }
    }

    callbacks.onProgress({
      currentEvaluations: 0,
      totalEvaluations: remainingRoundsCount,
      percentage: 0,
      currentRound: freeRoundNumbers[0],
      totalRounds,
    });

    for (let i = 0; i < remainingRoundsCount; i++) {
      const roundNumber = freeRoundNumbers[i];

      if (signal?.aborted) {
        throw new DOMException("Generation cancelled", "AbortError");
      }

      const previousRound = allRounds[allRounds.length - 1];
      const round = this.generateRound(
        roundNumber,
        activePlayers,
        courtsCount,
        pairHistory,
        opponentHistory,
        restCounts,
        fixedPairs,
        previousRound,
      );
      allRounds.push(round);
      updateCountMatrices(round, pairHistory, opponentHistory);
      updateRestCounts(round, restCounts);

      callbacks.onRoundComplete?.([...allRounds], roundNumber);
      callbacks.onProgress({
        currentEvaluations: i + 1,
        totalEvaluations: remainingRoundsCount,
        percentage: Math.round(((i + 1) / remainingRoundsCount) * 100),
        currentRound: roundNumber,
        totalRounds,
      });

      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    // 消化済みラウンドと新規ラウンドをroundNumber順にソート
    allRounds.sort((a, b) => a.roundNumber - b.roundNumber);

    // 最終評価はアクティブプレイヤーのみで計算
    const cumulativeState = buildCumulativeStateForActivePlayers(allRounds, activePlayers, maxPlayerNumber);
    const evaluation = evaluateFromState(cumulativeState, weights);

    return {
      courts: courtsCount,
      players: maxPlayerNumber,
      rounds: allRounds,
      evaluation,
      fixedPairs,
      activePlayers,
    };
  }

  // === private メソッド ===

  /**
   * ラウンド1を固定配置で生成する
   *
   * プレイヤーを昇順に並べて正規化形式のラウンドを返す。
   * 例: 8人2コート → (1,2 : 3,4) (5,6 : 7,8)
   */
  private createFirstRound(allPlayers: number[], courtsCount: number): Round {
    const playingCount = courtsCount * 4;
    const playingPlayers = allPlayers.slice(0, playingCount);
    const restingPlayers = allPlayers.slice(playingCount);
    return arrangementToRoundWithRest(playingPlayers, courtsCount, 1, restingPlayers);
  }

  /**
   * 1ラウンドを生成する（2フェーズ: バックトラック → スコアリングフォールバック）
   */
  private generateRound(
    roundNumber: number,
    allPlayers: number[],
    courtsCount: number,
    pairHistory: CountMatrix,
    opponentHistory: CountMatrix,
    restCounts: number[],
    fixedPairs: FixedPair[],
    previousRound: Round,
  ): Round {
    const playingCount = courtsCount * 4;
    const restCount = allPlayers.length - playingCount;
    const previousOpponents = extractPreviousOpponents(previousRound);

    const restingPlayers = selectRestingPlayers(allPlayers, restCount, restCounts, previousRound.restingPlayers, fixedPairs);
    const playingPlayers = allPlayers.filter((p) => !restingPlayers.includes(p));
    const sortedResting = restingPlayers.slice().sort((a, b) => a - b);

    const hasFixedPairs = fixedPairs.length > 0;

    // === Phase 1: ハード制約 + バックトラック ===
    for (let retry = 0; retry < MAX_RETRY_HARD; retry++) {
      const available = shuffle([...playingPlayers]);
      const courtAssignments: [number, number, number, number][] = [];
      let failed = false;

      for (let k = 0; k < courtsCount; k++) {
        const result = hasFixedPairs
          ? tryAssignCourtWithBacktrackingFixedPairs(available, pairHistory, opponentHistory, fixedPairs)
          : tryAssignCourtWithBacktracking(available, pairHistory, opponentHistory);

        if (result === null) {
          failed = true;
          break;
        }
        courtAssignments.push(result);
      }

      if (!failed) {
        const matches: Match[] = buildNormalizedMatches(courtAssignments);
        return { roundNumber, matches, restingPlayers: sortedResting };
      }
    }

    // === Phase 1.5: 対戦制約のみバックトラック（ペア制約緩和） ===
    for (let retry = 0; retry < MAX_RETRY_OPPO; retry++) {
      const available = shuffle([...playingPlayers]);
      const courtAssignments: [number, number, number, number][] = [];
      let failed = false;

      for (let k = 0; k < courtsCount; k++) {
        const result = hasFixedPairs
          ? tryAssignCourtOpponentOnlyFixedPairs(available, pairHistory, opponentHistory, fixedPairs)
          : tryAssignCourtOpponentOnly(available, pairHistory, opponentHistory);

        if (result === null) {
          failed = true;
          break;
        }
        courtAssignments.push(result);
      }

      if (!failed) {
        const matches: Match[] = buildNormalizedMatches(courtAssignments);
        return { roundNumber, matches, restingPlayers: sortedResting };
      }
    }

    // === Phase 2: スコアリングベースのフォールバック（常に成功） ===
    let bestMatches: Match[] | null = null;
    let bestScore = Infinity;

    for (let retry = 0; retry < MAX_RETRY_SOFT; retry++) {
      const available = shuffle([...playingPlayers]);
      const courtAssignments: [number, number, number, number][] = [];

      for (let k = 0; k < courtsCount; k++) {
        const result = hasFixedPairs
          ? assignCourtWithScoringFixedPairs(available, pairHistory, opponentHistory, fixedPairs, previousOpponents)
          : assignCourtWithScoring(available, pairHistory, opponentHistory, previousOpponents);
        courtAssignments.push(result);
      }

      const matches: Match[] = buildNormalizedMatches(courtAssignments);
      const score = this.quickEvaluate(courtAssignments, pairHistory, opponentHistory, previousOpponents);
      if (score < bestScore) {
        bestScore = score;
        bestMatches = matches;
      }
    }

    return { roundNumber, matches: bestMatches!, restingPlayers: sortedResting };
  }

  /**
   * スコアリングフォールバック用の軽量評価
   *
   * 候補の割り当てに対して、既存の履歴カウントの合計を返す。
   * pairMax（ペア回数最大値）→ oppoMax（対戦回数最大値）→ カウント合計
   * の3段階辞書式順序で評価する。
   * 連続対戦にはペナルティを加算する。
   */
  private quickEvaluate(
    courtAssignments: [number, number, number, number][],
    pairHistory: CountMatrix,
    opponentHistory: CountMatrix,
    previousOpponents: Map<number, Set<number>>,
  ): number {
    let score = 0;
    let pairMax = 0;
    let oppoMax = 0;
    for (const [p1, p2, p3, p4] of courtAssignments) {
      const newPair1 = pairHistory[p1 - 1][p2 - 1] + 1;
      const newPair2 = pairHistory[p3 - 1][p4 - 1] + 1;
      if (newPair1 > pairMax) pairMax = newPair1;
      if (newPair2 > pairMax) pairMax = newPair2;

      // 対戦回数の最大値を追跡
      const newOppo13 = opponentHistory[p1 - 1][p3 - 1] + 1;
      const newOppo14 = opponentHistory[p1 - 1][p4 - 1] + 1;
      const newOppo23 = opponentHistory[p2 - 1][p3 - 1] + 1;
      const newOppo24 = opponentHistory[p2 - 1][p4 - 1] + 1;
      if (newOppo13 > oppoMax) oppoMax = newOppo13;
      if (newOppo14 > oppoMax) oppoMax = newOppo14;
      if (newOppo23 > oppoMax) oppoMax = newOppo23;
      if (newOppo24 > oppoMax) oppoMax = newOppo24;

      score += pairHistory[p1 - 1][p2 - 1];
      score += pairHistory[p3 - 1][p4 - 1];
      score += opponentHistory[p1 - 1][p3 - 1];
      score += opponentHistory[p1 - 1][p4 - 1];
      score += opponentHistory[p2 - 1][p3 - 1];
      score += opponentHistory[p2 - 1][p4 - 1];

      // 連続対戦ペナルティ
      if (previousOpponents.get(p1)?.has(p3)) score += CONSECUTIVE_OPPONENT_PENALTY;
      if (previousOpponents.get(p1)?.has(p4)) score += CONSECUTIVE_OPPONENT_PENALTY;
      if (previousOpponents.get(p2)?.has(p3)) score += CONSECUTIVE_OPPONENT_PENALTY;
      if (previousOpponents.get(p2)?.has(p4)) score += CONSECUTIVE_OPPONENT_PENALTY;
    }
    return pairMax * PAIR_MAX_PENALTY + oppoMax * OPPO_MAX_PENALTY + score;
  }
}
