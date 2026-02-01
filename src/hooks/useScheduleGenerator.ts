import { useState, useCallback } from 'react';
import type { Schedule, ScheduleParams, Round, GenerationProgress } from '../types/schedule';
import { createInitialArrangement, nextPermutation } from '../utils/permutation';
import { isNormalized, arrangementToRound } from '../utils/normalization';
import { evaluate } from '../utils/evaluation';

/**
 * Calculates factorial (n!)
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * Estimates the number of normalized arrangements for given parameters
 *
 * Formula: n! / ((2^courts) * (2^(2*courts)) * courts!)
 * - n! = total permutations
 * - 2^courts = pair order normalization
 * - 2^(2*courts) = match pair order normalization
 * - courts! = court order normalization
 *
 * Example: 2 courts, 8 players
 * 8! / (2^2 * 2^4 * 2!) = 40320 / (4 * 16 * 2) = 40320 / 128 = 315
 */
function estimateNormalizedCount(playersCount: number, courtsCount: number): number {
  const totalPermutations = factorial(playersCount);
  const pairOrderDivisor = Math.pow(2, courtsCount * 2); // Each pair can swap
  const courtOrderDivisor = factorial(courtsCount);
  return Math.floor(totalPermutations / (pairOrderDivisor * courtOrderDivisor));
}

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
 * Finds the best next round asynchronously with progress reporting
 *
 * Similar to findBestNextRound but reports evaluation progress via callback
 *
 * @param currentRounds - All rounds generated so far
 * @param playersCount - Total number of players
 * @param courtsCount - Number of courts
 * @param weights - Evaluation weights
 * @param onProgress - Callback for progress updates (current evaluation count)
 * @returns Round with lowest cumulative evaluation score
 */
async function findBestNextRoundAsync(
  currentRounds: Round[],
  playersCount: number,
  courtsCount: number,
  weights: { w1: number; w2: number },
  onProgress: (evaluationCount: number) => void
): Promise<Round> {
  const arrangement = createInitialArrangement(playersCount);
  let bestArrangement: number[] | null = null;
  let bestScore = Infinity;
  let evaluationCount = 0;

  // Iterate through all permutations
  do {
    // Only evaluate normalized arrangements (skip duplicates)
    if (isNormalized(arrangement, courtsCount)) {
      evaluationCount++;

      // Create candidate round
      const candidateRound = arrangementToRound(
        arrangement.slice(),
        courtsCount,
        currentRounds.length + 1
      );

      // Evaluate with this round added
      const candidateRounds = [...currentRounds, candidateRound];
      const evaluation = evaluate(candidateRounds, playersCount, weights);

      // Keep track of best
      if (evaluation.totalScore < bestScore) {
        bestScore = evaluation.totalScore;
        bestArrangement = arrangement.slice();
      }

      // Report progress
      onProgress(evaluationCount);
    }
  } while (nextPermutation(arrangement));

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
 * Generates schedule asynchronously with progress reporting
 *
 * @param params - Schedule generation parameters
 * @param onProgress - Callback for progress updates
 * @returns Complete schedule with evaluation metrics
 */
export async function generateScheduleAsync(
  params: ScheduleParams,
  onProgress: (progress: GenerationProgress) => void
): Promise<Schedule> {
  const { courtsCount, playersCount, roundsCount, weights } = params;

  const rounds: Round[] = [];

  // Calculate total evaluations
  const normalizedCount = estimateNormalizedCount(playersCount, courtsCount);
  const totalEvaluations = normalizedCount * (roundsCount - 1);
  let currentEvaluations = 0;

  // Step 1: Create first round (normalized base case)
  const firstRound = createFirstRound(playersCount, courtsCount);
  rounds.push(firstRound);

  // Report initial progress
  onProgress({
    currentEvaluations: 0,
    totalEvaluations,
    percentage: 0
  });

  // Step 2: Generate subsequent rounds using greedy approach
  for (let r = 2; r <= roundsCount; r++) {
    // Yield to UI thread between rounds
    await new Promise(resolve => setTimeout(resolve, 0));

    const bestRound = await findBestNextRoundAsync(
      rounds,
      playersCount,
      courtsCount,
      weights,
      (roundEvaluations) => {
        // Update progress for this round
        const prevRoundEvaluations = normalizedCount * (r - 2);
        currentEvaluations = prevRoundEvaluations + roundEvaluations;
        const percentage = Math.round((currentEvaluations / totalEvaluations) * 100);

        onProgress({
          currentEvaluations,
          totalEvaluations,
          percentage
        });
      }
    );

    rounds.push(bestRound);
  }

  // Step 3: Calculate final evaluation
  const evaluation = evaluate(rounds, playersCount, weights);

  // Report completion
  onProgress({
    currentEvaluations: totalEvaluations,
    totalEvaluations,
    percentage: 100
  });

  return {
    courts: courtsCount,
    players: playersCount,
    rounds,
    evaluation,
  };
}

/**
 * React hook for schedule generation with loading, progress, and error states
 *
 * @returns Hook interface with schedule state, progress, and generate function
 *
 * @example
 * const { schedule, isGenerating, progress, error, generate } = useScheduleGenerator();
 *
 * // Trigger generation
 * generate({ courtsCount: 2, playersCount: 8, roundsCount: 7, weights: { w1: 1.0, w2: 0.5 } });
 *
 * // Display progress
 * if (isGenerating && progress) {
 *   return <Progress value={progress.percentage} label={`評価 ${progress.currentEvaluations} / ${progress.totalEvaluations}`} />;
 * }
 * if (error) return <Error message={error} />;
 * if (schedule) return <ScheduleTable schedule={schedule} />;
 */
export function useScheduleGenerator() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback((params: ScheduleParams) => {
    setIsGenerating(true);
    setError(null);
    setProgress(null);

    // Run async generation with progress updates
    generateScheduleAsync(params, (progressUpdate) => {
      setProgress(progressUpdate);
    })
      .then((result) => {
        setSchedule(result);
        setIsGenerating(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Generation failed');
        setIsGenerating(false);
        setProgress(null);
      });
  }, []);

  return { schedule, isGenerating, progress, error, generate };
}
