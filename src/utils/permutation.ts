/**
 * Permutation utilities for generating all arrangements
 * Based on C++ STL next_permutation algorithm
 */

/**
 * Reverses a subarray in-place
 *
 * @param arr - Array to modify
 * @param start - Start index (inclusive)
 * @param end - End index (inclusive)
 *
 * Time complexity: O(end - start)
 */
function reverseSubarray(arr: number[], start: number, end: number): void {
  while (start < end) {
    [arr[start], arr[end]] = [arr[end], arr[start]];
    start++;
    end--;
  }
}

/**
 * Generates the next lexicographical permutation in-place
 * Based on C++ STL next_permutation algorithm
 *
 * Algorithm steps:
 * 1. Find the largest index k such that arr[k] < arr[k+1]
 * 2. If no such k exists, this is the last permutation (reverse and return false)
 * 3. Find the largest index l such that arr[k] < arr[l]
 * 4. Swap arr[k] and arr[l]
 * 5. Reverse the subarray from k+1 to end
 *
 * @param arr - Array to permute (modified in-place)
 * @returns true if next permutation exists, false if wrapped around to first
 *
 * @example
 * const arr = [1, 2, 3];
 * nextPermutation(arr); // arr becomes [1, 3, 2], returns true
 * nextPermutation(arr); // arr becomes [2, 1, 3], returns true
 * nextPermutation(arr); // arr becomes [2, 3, 1], returns true
 * nextPermutation(arr); // arr becomes [3, 1, 2], returns true
 * nextPermutation(arr); // arr becomes [3, 2, 1], returns true
 * nextPermutation(arr); // arr becomes [1, 2, 3], returns false (wrapped)
 *
 * Time complexity: O(n) worst case, O(1) average
 */
export function nextPermutation(arr: number[]): boolean {
  // Step 1: Find largest k where arr[k] < arr[k+1]
  let k = arr.length - 2;
  while (k >= 0 && arr[k] >= arr[k + 1]) {
    k--;
  }

  // Step 2: If no such k exists, we're at the last permutation
  if (k < 0) {
    arr.reverse();
    return false;
  }

  // Step 3: Find largest l where arr[k] < arr[l]
  let l = arr.length - 1;
  while (arr[k] >= arr[l]) {
    l--;
  }

  // Step 4: Swap arr[k] and arr[l]
  [arr[k], arr[l]] = [arr[l], arr[k]];

  // Step 5: Reverse subarray from k+1 to end
  reverseSubarray(arr, k + 1, arr.length - 1);

  return true;
}

/**
 * Creates the initial arrangement [1, 2, 3, ..., n]
 *
 * @param playersCount - Total number of players
 * @returns Array of player numbers from 1 to playersCount
 *
 * @example
 * createInitialArrangement(8) // Returns [1, 2, 3, 4, 5, 6, 7, 8]
 *
 * Time complexity: O(n)
 */
export function createInitialArrangement(playersCount: number): number[] {
  return Array.from({ length: playersCount }, (_, i) => i + 1);
}
