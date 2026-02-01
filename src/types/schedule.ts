/**
 * Type definitions for tennis doubles schedule generation
 */

/**
 * Represents a pair of players in a doubles match
 * Invariant: player1 < player2 (normalized)
 */
export interface Pair {
  player1: number; // Player number (1-based)
  player2: number; // Player number (1-based)
}

/**
 * Represents a match on one court (2 pairs facing each other)
 * Invariant: min(pairA) < min(pairB) (normalized)
 */
export interface Match {
  pairA: Pair;
  pairB: Pair;
}

/**
 * Represents all matches in a single round
 */
export interface Round {
  roundNumber: number; // 1-based round number
  matches: Match[]; // One match per court, sorted by minimum player number
}

/**
 * Evaluation metrics for a schedule
 */
export interface Evaluation {
  pairStdDev: number;   // Standard deviation of pair counts
  oppoStdDev: number;   // Standard deviation of opponent counts
  totalScore: number;   // Weighted sum: pairStdDev * w1 + oppoStdDev * w2
}

/**
 * Complete schedule for a tournament
 */
export interface Schedule {
  courts: number;       // Number of courts
  players: number;      // Total number of players
  rounds: Round[];      // All rounds in the schedule
  evaluation: Evaluation; // Quality metrics
}

/**
 * Matrix for counting pair/opponent occurrences
 * CountMatrix[i][j] = number of times player i+1 and player j+1 paired/opposed
 * Note: Player numbers are 1-based, array indices are 0-based
 */
export type CountMatrix = number[][];

/**
 * Parameters for schedule generation
 */
export interface ScheduleParams {
  courtsCount: number;
  playersCount: number;
  roundsCount: number;
  weights: {
    w1: number; // Weight for pair count standard deviation
    w2: number; // Weight for opponent count standard deviation
  };
}
