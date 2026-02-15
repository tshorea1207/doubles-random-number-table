/**
 * 貪欲逐次構築法（Greedy Sequential Construction）ストラテジー
 *
 * アルゴリズム:
 * 1. 最初のラウンドを標準的な正規化形式に固定（固定ペアがある場合は探索）
 * 2. 後続の各ラウンドについて:
 *    - 全ての正規化配列を評価（固定ペア制約を適用）
 *    - 累積スコアが最低のものを選択
 * 3. 最終評価付きの完全なスケジュールを返す
 */

import type { ScheduleStrategy, StrategyMeta, ProgressCallbacks } from '../types';
import type { Schedule, ScheduleParams, RegenerationParams, Round, FixedPair, CumulativeState } from '../../types/schedule';
import { createInitialArrangement, generateRestingCandidates } from '../../utils/permutation';
import { arrangementToRoundWithRest } from '../../utils/normalization';
import { initializeRestCounts, createCumulativeState, commitRoundToState, evaluateCandidate, evaluateFromState, buildCumulativeStateForActivePlayers } from '../../utils/evaluation';
import { satisfiesFixedPairs } from '../../utils/fixedPairs';
import { getNormalizedArrangements } from '../../utils/normalizedArrangements';
import { estimateNormalizedCount, templateToArrangement } from './greedyUtils';

export class GreedyStrategy implements ScheduleStrategy {
  readonly meta: StrategyMeta = {
    id: 'greedy',
    name: '貪欲逐次構築法',
    description: '全ての正規化配列を評価し、累積スコアが最小となる組み合わせを選択する決定的アルゴリズム',
    isExperimental: false,
  };

  estimateTotalEvaluations(
    playersCount: number,
    courtsCount: number,
    roundsCount: number,
  ): number {
    return estimateNormalizedCount(playersCount, courtsCount) * (roundsCount - 1);
  }

  generateSchedule(params: ScheduleParams): Schedule {
    const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

    const rounds: Round[] = [];
    const allPlayers = createInitialArrangement(playersCount);
    const cumulativeState = createCumulativeState(playersCount);

    const firstRound = this.createFirstRound(allPlayers, courtsCount, fixedPairs);
    rounds.push(firstRound);
    commitRoundToState(cumulativeState, firstRound);

    for (let r = 2; r <= roundsCount; r++) {
      const previousRestingPlayers = rounds[rounds.length - 1].restingPlayers;
      const bestRound = this.findBestNextRound(cumulativeState, r, allPlayers, courtsCount, weights, fixedPairs, previousRestingPlayers);
      rounds.push(bestRound);
      commitRoundToState(cumulativeState, bestRound);
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

  async generateScheduleAsync(
    params: ScheduleParams,
    callbacks: ProgressCallbacks,
    signal?: AbortSignal,
  ): Promise<Schedule> {
    const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

    const rounds: Round[] = [];
    const allPlayers = createInitialArrangement(playersCount);
    const cumulativeState = createCumulativeState(playersCount);

    const normalizedCount = estimateNormalizedCount(playersCount, courtsCount);
    const totalEvaluations = normalizedCount * (roundsCount - 1);
    let currentEvaluations = 0;

    const firstRound = this.createFirstRound(allPlayers, courtsCount, fixedPairs);
    rounds.push(firstRound);
    commitRoundToState(cumulativeState, firstRound);
    callbacks.onRoundComplete?.([...rounds], 1);

    callbacks.onProgress({
      currentEvaluations: 0,
      totalEvaluations,
      percentage: 0,
      currentRound: 1,
      totalRounds: roundsCount
    });

    for (let r = 2; r <= roundsCount; r++) {
      await new Promise(resolve => setTimeout(resolve, 0));
      if (signal?.aborted) {
        throw new DOMException('Generation cancelled', 'AbortError');
      }

      const previousRestingPlayers = rounds[rounds.length - 1].restingPlayers;
      const bestRound = await this.findBestNextRoundAsync(
        cumulativeState,
        r,
        allPlayers,
        courtsCount,
        weights,
        fixedPairs,
        previousRestingPlayers,
        (roundEvaluations: number) => {
          const prevRoundEvaluations = normalizedCount * (r - 2);
          currentEvaluations = prevRoundEvaluations + roundEvaluations;
          const percentage = Math.round((currentEvaluations / totalEvaluations) * 100);

          callbacks.onProgress({
            currentEvaluations,
            totalEvaluations,
            percentage,
            currentRound: r,
            totalRounds: roundsCount
          });
        },
        signal
      );

      rounds.push(bestRound);
      commitRoundToState(cumulativeState, bestRound);
      callbacks.onRoundComplete?.([...rounds], r);
    }

    const evaluation = evaluateFromState(cumulativeState, weights);

    callbacks.onProgress({
      currentEvaluations: totalEvaluations,
      totalEvaluations,
      percentage: 100,
      currentRound: roundsCount,
      totalRounds: roundsCount
    });

    return {
      courts: courtsCount,
      players: playersCount,
      rounds,
      evaluation,
      fixedPairs,
      activePlayers: allPlayers,
    };
  }

  async generateRemainingScheduleAsync(
    params: RegenerationParams,
    callbacks: ProgressCallbacks,
    signal?: AbortSignal,
  ): Promise<Schedule> {
    const { courtsCount, completedRounds, activePlayers, remainingRoundsCount, weights, fixedPairs } = params;

    if (activePlayers.length < courtsCount * 4) {
      throw new Error(`参加者数（${activePlayers.length}人）がコート数（${courtsCount}面）に必要な${courtsCount * 4}人を下回っています`);
    }

    const maxPlayerNumber = Math.max(...activePlayers);
    const allRounds: Round[] = [...completedRounds];

    const cumulativeState = buildCumulativeStateForActivePlayers(
      completedRounds, activePlayers, maxPlayerNumber
    );

    const totalRounds = completedRounds.length + remainingRoundsCount;

    // 消化済みラウンドが使用しているroundNumberを除外した空き番号リストを生成
    const usedRoundNumbers = new Set(completedRounds.map(r => r.roundNumber));
    const freeRoundNumbers: number[] = [];
    for (let n = 1; n <= totalRounds; n++) {
      if (!usedRoundNumbers.has(n)) {
        freeRoundNumbers.push(n);
      }
    }

    const normalizedCount = estimateNormalizedCount(activePlayers.length, courtsCount);
    const totalEvaluations = normalizedCount * remainingRoundsCount;
    let currentEvaluations = 0;

    callbacks.onProgress({
      currentEvaluations: 0,
      totalEvaluations,
      percentage: 0,
      currentRound: freeRoundNumbers[0],
      totalRounds,
    });

    for (let i = 0; i < remainingRoundsCount; i++) {
      const roundNumber = freeRoundNumbers[i];

      await new Promise(resolve => setTimeout(resolve, 0));
      if (signal?.aborted) {
        throw new DOMException('Generation cancelled', 'AbortError');
      }

      const previousRestingPlayers = allRounds[allRounds.length - 1].restingPlayers;
      const bestRound = await this.findBestNextRoundAsync(
        cumulativeState,
        roundNumber,
        activePlayers,
        courtsCount,
        weights,
        fixedPairs,
        previousRestingPlayers,
        (roundEvaluations: number) => {
          const prevEvals = normalizedCount * i;
          currentEvaluations = prevEvals + roundEvaluations;
          const percentage = Math.round((currentEvaluations / totalEvaluations) * 100);

          callbacks.onProgress({
            currentEvaluations,
            totalEvaluations,
            percentage,
            currentRound: roundNumber,
            totalRounds,
          });
        },
        signal
      );

      allRounds.push(bestRound);
      commitRoundToState(cumulativeState, bestRound);
      callbacks.onRoundComplete?.([...allRounds], roundNumber);
    }

    const evaluation = evaluateFromState(cumulativeState, weights);

    // 消化済みラウンドと新規ラウンドをroundNumber順にソート
    allRounds.sort((a, b) => a.roundNumber - b.roundNumber);

    callbacks.onProgress({
      currentEvaluations: totalEvaluations,
      totalEvaluations,
      percentage: 100,
      currentRound: totalRounds,
      totalRounds,
    });

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

  private createFirstRound(
    allPlayers: number[],
    courtsCount: number,
    fixedPairs: FixedPair[]
  ): Round {
    const playersCount = allPlayers.length;
    const playingCount = courtsCount * 4;
    const restCount = playersCount - playingCount;

    if (restCount <= 0 && fixedPairs.length === 0) {
      return arrangementToRoundWithRest(allPlayers.slice(), courtsCount, 1, []);
    }

    const initialRestCounts = initializeRestCounts(playersCount);

    for (const restingPlayers of generateRestingCandidates([...allPlayers].reverse(), restCount, initialRestCounts, undefined, fixedPairs)) {
      const playingPlayers = allPlayers.filter(p => !restingPlayers.includes(p)).sort((a, b) => a - b);

      const templates = getNormalizedArrangements(courtsCount, playingPlayers.length);
      for (const template of templates) {
        if (satisfiesFixedPairs(template, courtsCount, fixedPairs, playingPlayers)) {
          const arrangement = templateToArrangement(template, playingPlayers);
          return arrangementToRoundWithRest(arrangement, courtsCount, 1, restingPlayers);
        }
      }
    }

    throw new Error('固定ペアを満たす配置が見つかりません');
  }

  private findBestNextRound(
    cumulativeState: CumulativeState,
    roundNumber: number,
    allPlayers: number[],
    courtsCount: number,
    weights: { w1: number; w2: number; w3: number },
    fixedPairs: FixedPair[],
    previousRestingPlayers: number[]
  ): Round {
    const playingCount = courtsCount * 4;
    const restCount = allPlayers.length - playingCount;

    let bestTemplate: number[] | null = null;
    let bestPlayerMap: number[] | null = null;
    let bestRestingPlayers: number[] | null = null;
    let bestScore = Infinity;

    for (const restingPlayers of generateRestingCandidates(allPlayers, restCount, cumulativeState.restCounts, previousRestingPlayers, fixedPairs)) {
      const playingPlayers = allPlayers.filter(p => !restingPlayers.includes(p)).sort((a, b) => a - b);

      const templates = getNormalizedArrangements(courtsCount, playingPlayers.length);
      for (const template of templates) {
        if (satisfiesFixedPairs(template, courtsCount, fixedPairs, playingPlayers)) {
          const score = evaluateCandidate(
            cumulativeState,
            template,
            courtsCount,
            playingPlayers,
            restingPlayers,
            weights
          );

          if (score < bestScore) {
            bestScore = score;
            bestTemplate = template.slice();
            bestPlayerMap = playingPlayers;
            bestRestingPlayers = [...restingPlayers];
          }
        }
      }
    }

    if (!bestTemplate || !bestPlayerMap) {
      throw new Error('固定ペアを満たす配置が見つかりません');
    }

    const bestArrangement = templateToArrangement(bestTemplate, bestPlayerMap);
    return arrangementToRoundWithRest(bestArrangement, courtsCount, roundNumber, bestRestingPlayers!);
  }

  private async findBestNextRoundAsync(
    cumulativeState: CumulativeState,
    roundNumber: number,
    allPlayers: number[],
    courtsCount: number,
    weights: { w1: number; w2: number; w3: number },
    fixedPairs: FixedPair[],
    previousRestingPlayers: number[],
    onProgress: (evaluationCount: number) => void,
    signal?: AbortSignal
  ): Promise<Round> {
    const playingCount = courtsCount * 4;
    const restCount = allPlayers.length - playingCount;

    let bestTemplate: number[] | null = null;
    let bestPlayerMap: number[] | null = null;
    let bestRestingPlayers: number[] | null = null;
    let bestScore = Infinity;
    let evaluationCount = 0;

    const BATCH_SIZE = 100;

    for (const restingPlayers of generateRestingCandidates(allPlayers, restCount, cumulativeState.restCounts, previousRestingPlayers, fixedPairs)) {
      const playingPlayers = allPlayers.filter(p => !restingPlayers.includes(p)).sort((a, b) => a - b);

      const templates = getNormalizedArrangements(courtsCount, playingPlayers.length);
      for (const template of templates) {
        if (satisfiesFixedPairs(template, courtsCount, fixedPairs, playingPlayers)) {
          evaluationCount++;

          const score = evaluateCandidate(
            cumulativeState,
            template,
            courtsCount,
            playingPlayers,
            restingPlayers,
            weights
          );

          if (score < bestScore) {
            bestScore = score;
            bestTemplate = template.slice();
            bestPlayerMap = playingPlayers;
            bestRestingPlayers = [...restingPlayers];
          }

          if (evaluationCount % BATCH_SIZE === 0) {
            onProgress(evaluationCount);
            await new Promise(resolve => setTimeout(resolve, 0));
            if (signal?.aborted) {
              throw new DOMException('Generation cancelled', 'AbortError');
            }
          }
        }
      }
    }

    if (evaluationCount % BATCH_SIZE !== 0) {
      onProgress(evaluationCount);
    }

    if (!bestTemplate || !bestPlayerMap) {
      throw new Error('固定ペアを満たす配置が見つかりません');
    }

    const bestArrangement = templateToArrangement(bestTemplate, bestPlayerMap);
    return arrangementToRoundWithRest(bestArrangement, courtsCount, roundNumber, bestRestingPlayers!);
  }
}
