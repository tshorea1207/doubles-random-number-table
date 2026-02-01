import type { Round, Evaluation, CountMatrix } from '../types/schedule';
import { calculateStandardDeviation, extractUpperTriangleValues } from './statistics';

/**
 * Initializes an N×N count matrix with all zeros
 *
 * @param playersCount - Number of players
 * @returns N×N matrix filled with zeros
 *
 * @example
 * initializeCountMatrix(8) // Returns 8×8 matrix of zeros
 *
 * Time complexity: O(N²)
 */
export function initializeCountMatrix(playersCount: number): CountMatrix {
  return Array(playersCount)
    .fill(0)
    .map(() => Array(playersCount).fill(0));
}

/**
 * Updates pair and opponent count matrices based on a round
 *
 * IMPORTANT: Player numbers are 1-based, array indices are 0-based
 * Always subtract 1 when indexing: pairCounts[player - 1][...]
 *
 * Count matrices are symmetric: matrix[i][j] = matrix[j][i]
 * Both directions must be updated for each relationship
 *
 * @param round - Round to process
 * @param pairCounts - Symmetric matrix tracking how many times each pair played together (modified in-place)
 * @param oppoCounts - Symmetric matrix tracking how many times each pair opposed (modified in-place)
 *
 * @example
 * // Round with one match: (1,2) vs (3,4)
 * // Updates:
 * // - pairCounts[0][1]++ and pairCounts[1][0]++ (players 1-2 paired)
 * // - pairCounts[2][3]++ and pairCounts[3][2]++ (players 3-4 paired)
 * // - oppoCounts[0][2]++, oppoCounts[0][3]++, oppoCounts[1][2]++, oppoCounts[1][3]++ (all 4 opponent combinations)
 * // - (and symmetric updates)
 *
 * Time complexity: O(matches * 4²) = O(courts)
 */
export function updateCountMatrices(
  round: Round,
  pairCounts: CountMatrix,
  oppoCounts: CountMatrix
): void {
  for (const match of round.matches) {
    const { pairA, pairB } = match;

    // Update pair counts (symmetric matrix)
    // Players in pairA played together
    pairCounts[pairA.player1 - 1][pairA.player2 - 1]++;
    pairCounts[pairA.player2 - 1][pairA.player1 - 1]++;

    // Players in pairB played together
    pairCounts[pairB.player1 - 1][pairB.player2 - 1]++;
    pairCounts[pairB.player2 - 1][pairB.player1 - 1]++;

    // Update opponent counts (all combinations of pairA vs pairB)
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
 * Evaluates the quality of a schedule based on pair and opponent fairness
 *
 * Evaluation formula:
 *   totalScore = pairStdDev * w1 + oppoStdDev * w2
 *
 * Lower scores are better. Ideal solution: pairStdDev = 0, oppoStdDev = 0
 * (all players paired equally often with all others, opposed equally often)
 *
 * @param rounds - All rounds to evaluate
 * @param playersCount - Total number of players
 * @param weights - Weights for pair and opponent fairness (w1 > w2 prioritizes pair fairness)
 * @returns Evaluation metrics
 *
 * @example
 * evaluate([round1, round2, round3], 8, { w1: 1.0, w2: 0.5 })
 * // Returns: { pairStdDev: 0.52, oppoStdDev: 0.82, totalScore: 0.93 }
 *
 * Time complexity: O(rounds * courts + players²)
 */
export function evaluate(
  rounds: Round[],
  playersCount: number,
  weights: { w1: number; w2: number }
): Evaluation {
  const pairCounts = initializeCountMatrix(playersCount);
  const oppoCounts = initializeCountMatrix(playersCount);

  // Accumulate counts across all rounds
  for (const round of rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
  }

  // Extract upper triangle values (symmetric matrices, only count each pair once)
  const pairValues = extractUpperTriangleValues(pairCounts);
  const oppoValues = extractUpperTriangleValues(oppoCounts);

  // Calculate standard deviations
  const pairStdDev = calculateStandardDeviation(pairValues);
  const oppoStdDev = calculateStandardDeviation(oppoValues);

  // Calculate total score (weighted sum)
  const totalScore = pairStdDev * weights.w1 + oppoStdDev * weights.w2;

  return { pairStdDev, oppoStdDev, totalScore };
}
