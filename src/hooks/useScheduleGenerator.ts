import { useState, useCallback } from 'react';
import type { Schedule, ScheduleParams, Round } from '../types/schedule';
import { createInitialArrangement, nextPermutation } from '../utils/permutation';
import { isNormalized, arrangementToRound } from '../utils/normalization';
import { evaluate } from '../utils/evaluation';

/**
 * Creates the first round using the canonical normalized arrangement
 *
 * For N players, the first round is always [1, 2, 3, ..., N]
 * Example for 2 courts, 8 players: Court 1: (1,2):(3,4), Court 2: (5,6):(7,8)
 *
 * @param playersCount - Total number of players
 * @param courtsCount - Number of courts
 * @returns First round in canonical form
 */
function createFirstRound(playersCount: number, courtsCount: number): Round {
  const arrangement = createInitialArrangement(playersCount);
  return arrangementToRound(arrangement, courtsCount, 1);
}

/**
 * Finds the best next round using greedy algorithm
 *
 * Algorithm:
 * 1. Generate all permutations of [1, 2, ..., N]
 * 2. Filter to only normalized arrangements (e.g., 315 out of 40,320 for 2 courts, 8 players)
 * 3. For each normalized arrangement:
 *    - Create temporary round
 *    - Evaluate cumulative score with all previous rounds
 *    - Track arrangement with lowest score
 * 4. Return the best arrangement as a Round
 *
 * @param currentRounds - All rounds generated so far
 * @param playersCount - Total number of players
 * @param courtsCount - Number of courts
 * @param weights - Evaluation weights
 * @returns Round with lowest cumulative evaluation score
 *
 * Time complexity: O(normalized_arrangements * rounds * players²)
 * For 2 courts, 8 players: O(315 * rounds * 64)
 */
function findBestNextRound(
  currentRounds: Round[],
  playersCount: number,
  courtsCount: number,
  weights: { w1: number; w2: number }
): Round {
  const arrangement = createInitialArrangement(playersCount);
  let bestArrangement: number[] | null = null;
  let bestScore = Infinity;

  // Iterate through all permutations
  do {
    // Only evaluate normalized arrangements (skip duplicates)
    if (isNormalized(arrangement, courtsCount)) {
      // Create candidate round
      const candidateRound = arrangementToRound(
        arrangement.slice(), // Copy to avoid mutation
        courtsCount,
        currentRounds.length + 1
      );

      // Evaluate with this round added
      const candidateRounds = [...currentRounds, candidateRound];
      const evaluation = evaluate(candidateRounds, playersCount, weights);

      // Keep track of best
      if (evaluation.totalScore < bestScore) {
        bestScore = evaluation.totalScore;
        bestArrangement = arrangement.slice(); // Must copy, not reference
      }
    }
  } while (nextPermutation(arrangement));

  // Convert best arrangement to Round
  // TypeScript: bestArrangement is guaranteed to be non-null here
  return arrangementToRound(bestArrangement!, courtsCount, currentRounds.length + 1);
}

/**
 * Generates an optimized doubles schedule using greedy sequential construction
 *
 * Algorithm:
 * 1. Fix first round to canonical normalized form
 * 2. For each subsequent round:
 *    - Evaluate all normalized arrangements
 *    - Select the one with lowest cumulative score
 * 3. Return complete schedule with final evaluation
 *
 * Note: This is a greedy algorithm and does not guarantee global optimum,
 * but typically produces good solutions in reasonable time.
 *
 * @param params - Schedule generation parameters
 * @returns Complete schedule with evaluation metrics
 *
 * @example
 * generateSchedule({
 *   courtsCount: 2,
 *   playersCount: 8,
 *   roundsCount: 7,
 *   weights: { w1: 1.0, w2: 0.5 }
 * })
 * // Returns schedule with ~315 * 6 = 1,890 evaluations
 * // Generation time: < 1 second
 *
 * Time complexity: O(rounds * normalized_arrangements * rounds * players²)
 * For 2 courts, 8 players, 7 rounds: O(7 * 315 * 7 * 64) ≈ 1 million operations
 */
export function generateSchedule(params: ScheduleParams): Schedule {
  const { courtsCount, playersCount, roundsCount, weights } = params;

  const rounds: Round[] = [];

  // Step 1: Create first round (normalized base case)
  const firstRound = createFirstRound(playersCount, courtsCount);
  rounds.push(firstRound);

  // Step 2: Generate subsequent rounds using greedy approach
  for (let r = 2; r <= roundsCount; r++) {
    const bestRound = findBestNextRound(rounds, playersCount, courtsCount, weights);
    rounds.push(bestRound);
  }

  // Step 3: Calculate final evaluation
  const evaluation = evaluate(rounds, playersCount, weights);

  return {
    courts: courtsCount,
    players: playersCount,
    rounds,
    evaluation,
  };
}

/**
 * React hook for schedule generation with loading and error states
 *
 * @returns Hook interface with schedule state and generate function
 *
 * @example
 * const { schedule, isGenerating, error, generate } = useScheduleGenerator();
 *
 * // Trigger generation
 * generate({ courtsCount: 2, playersCount: 8, roundsCount: 7, weights: { w1: 1.0, w2: 0.5 } });
 *
 * // Display results
 * if (isGenerating) return <Loading />;
 * if (error) return <Error message={error} />;
 * if (schedule) return <ScheduleTable schedule={schedule} />;
 */
export function useScheduleGenerator() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback((params: ScheduleParams) => {
    setIsGenerating(true);
    setError(null);

    try {
      // Run generation in next tick to avoid blocking UI
      setTimeout(() => {
        try {
          const result = generateSchedule(params);
          setSchedule(result);
          setIsGenerating(false);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Generation failed');
          setIsGenerating(false);
        }
      }, 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
      setIsGenerating(false);
    }
  }, []);

  return { schedule, isGenerating, error, generate };
}
