import type { CountMatrix } from '../types/schedule';

/**
 * Calculates the standard deviation of an array of numbers
 *
 * @param values - Array of numeric values
 * @returns Standard deviation, or 0 if array is empty
 *
 * @example
 * calculateStandardDeviation([1, 2, 3, 4, 5]) // Returns ~1.414
 * calculateStandardDeviation([]) // Returns 0
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  // Calculate mean
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  // Calculate variance
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  // Return standard deviation (square root of variance)
  return Math.sqrt(variance);
}

/**
 * Extracts values from the upper triangle of a symmetric matrix
 * (excluding the diagonal)
 *
 * Used for pair/opponent count matrices where matrix[i][j] = matrix[j][i]
 * and we only want to count each pair once.
 *
 * @param matrix - Symmetric N×N matrix
 * @returns Array of values from upper triangle (i < j)
 *
 * @example
 * // For a 3×3 matrix:
 * // [0, 1, 2]
 * // [1, 0, 3]
 * // [2, 3, 0]
 * extractUpperTriangleValues(matrix) // Returns [1, 2, 3]
 *
 * Time complexity: O(N²)
 */
export function extractUpperTriangleValues(matrix: CountMatrix): number[] {
  const values: number[] = [];

  for (let i = 0; i < matrix.length; i++) {
    for (let j = i + 1; j < matrix[i].length; j++) {
      values.push(matrix[i][j]);
    }
  }

  return values;
}
