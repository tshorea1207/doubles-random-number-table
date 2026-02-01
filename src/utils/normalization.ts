import type { Round, Match } from '../types/schedule';

/**
 * Checks if an arrangement satisfies normalization rules
 *
 * Normalization rules reduce search space by eliminating equivalent arrangements:
 * 1. Within each pair: player1 < player2
 * 2. Between pairs in same court: min(pairA) < min(pairB)
 * 3. Between courts: min(court[i]) < min(court[i+1])
 *
 * For 2 courts, 8 players: reduces 8! = 40,320 arrangements to 315 valid ones
 *
 * @param arrangement - Array of player numbers (1-based), format: [p1,p2,p3,p4, p5,p6,p7,p8, ...]
 *                      where each group of 4 represents one court (2 pairs of 2 players)
 * @param courtsCount - Number of courts in the arrangement
 * @returns true if arrangement is normalized, false otherwise
 *
 * @example
 * // Valid (normalized):
 * isNormalized([1,2,3,4, 5,6,7,8], 2) // true
 * // Court 1: (1,2):(3,4), Court 2: (5,6):(7,8)
 *
 * // Invalid (pair not sorted):
 * isNormalized([2,1,3,4, 5,6,7,8], 2) // false
 * // Violates rule 1: player1 should be < player2
 *
 * // Invalid (pairs not sorted):
 * isNormalized([3,4,1,2, 5,6,7,8], 2) // false
 * // Violates rule 2: min(3,4)=3 should be < min(1,2)=1
 *
 * // Invalid (courts not sorted):
 * isNormalized([5,6,7,8, 1,2,3,4], 2) // false
 * // Violates rule 3: min(court1)=5 should be < min(court2)=1
 *
 * Time complexity: O(courtsCount)
 */
export function isNormalized(arrangement: number[], courtsCount: number): boolean {
  const playersPerCourt = 4;

  // Check each court
  for (let courtIdx = 0; courtIdx < courtsCount; courtIdx++) {
    const offset = courtIdx * playersPerCourt;
    const court = arrangement.slice(offset, offset + playersPerCourt);

    // Rule 1: Within each pair, player1 < player2
    if (court[0] >= court[1]) return false; // Pair A
    if (court[2] >= court[3]) return false; // Pair B

    // Rule 2: Between pairs in same court, min(pairA) < min(pairB)
    const minPairA = Math.min(court[0], court[1]);
    const minPairB = Math.min(court[2], court[3]);
    if (minPairA >= minPairB) return false;
  }

  // Rule 3: Between courts, min(court[i]) < min(court[i+1])
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
 * Converts an arrangement array to a Round object
 *
 * @param arrangement - Array of player numbers in format [p1,p2,p3,p4, p5,p6,p7,p8, ...]
 * @param courtsCount - Number of courts
 * @param roundNumber - Round number (1-based)
 * @returns Round object with matches
 *
 * @example
 * arrangementToRound([1,2,3,4, 5,6,7,8], 2, 1)
 * // Returns:
 * // {
 * //   roundNumber: 1,
 * //   matches: [
 * //     { pairA: {player1: 1, player2: 2}, pairB: {player1: 3, player2: 4} },
 * //     { pairA: {player1: 5, player2: 6}, pairB: {player1: 7, player2: 8} }
 * //   ]
 * // }
 *
 * Time complexity: O(courtsCount)
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

  return { roundNumber, matches };
}
