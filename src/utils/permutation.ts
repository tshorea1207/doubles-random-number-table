/**
 * 順列生成ユーティリティ
 * C++ STL の next_permutation アルゴリズムに基づく
 */

/**
 * 部分配列をその場で反転する
 *
 * @param arr - 変更対象の配列
 * @param start - 開始インデックス（含む）
 * @param end - 終了インデックス（含む）
 *
 * 計算量: O(end - start)
 */
function reverseSubarray(arr: number[], start: number, end: number): void {
  while (start < end) {
    [arr[start], arr[end]] = [arr[end], arr[start]];
    start++;
    end--;
  }
}

/**
 * 辞書順で次の順列をその場で生成する
 * C++ STL の next_permutation アルゴリズムに基づく
 *
 * アルゴリズムの手順:
 * 1. arr[k] < arr[k+1] となる最大のインデックス k を見つける
 * 2. そのような k が存在しない場合、これは最後の順列（反転して false を返す）
 * 3. arr[k] < arr[l] となる最大のインデックス l を見つける
 * 4. arr[k] と arr[l] を交換
 * 5. k+1 から末尾までの部分配列を反転
 *
 * @param arr - 順列を変更する配列（その場で変更される）
 * @returns 次の順列が存在する場合は true、最初に戻った場合は false
 *
 * @example
 * const arr = [1, 2, 3];
 * nextPermutation(arr); // arr は [1, 3, 2] になり、true を返す
 * nextPermutation(arr); // arr は [2, 1, 3] になり、true を返す
 * nextPermutation(arr); // arr は [2, 3, 1] になり、true を返す
 * nextPermutation(arr); // arr は [3, 1, 2] になり、true を返す
 * nextPermutation(arr); // arr は [3, 2, 1] になり、true を返す
 * nextPermutation(arr); // arr は [1, 2, 3] になり、false を返す（一周した）
 *
 * 計算量: 最悪 O(n)、平均 O(1)
 */
export function nextPermutation(arr: number[]): boolean {
  // ステップ1: arr[k] < arr[k+1] となる最大の k を見つける
  let k = arr.length - 2;
  while (k >= 0 && arr[k] >= arr[k + 1]) {
    k--;
  }

  // ステップ2: そのような k が存在しない場合、最後の順列
  if (k < 0) {
    arr.reverse();
    return false;
  }

  // ステップ3: arr[k] < arr[l] となる最大の l を見つける
  let l = arr.length - 1;
  while (arr[k] >= arr[l]) {
    l--;
  }

  // ステップ4: arr[k] と arr[l] を交換
  [arr[k], arr[l]] = [arr[l], arr[k]];

  // ステップ5: k+1 から末尾までの部分配列を反転
  reverseSubarray(arr, k + 1, arr.length - 1);

  return true;
}

/**
 * 初期配列 [1, 2, 3, ..., n] を生成する
 *
 * @param playersCount - プレイヤーの総数
 * @returns 1 から playersCount までのプレイヤー番号の配列
 *
 * @example
 * createInitialArrangement(8) // [1, 2, 3, 4, 5, 6, 7, 8] を返す
 *
 * 計算量: O(n)
 */
export function createInitialArrangement(playersCount: number): number[] {
  return Array.from({ length: playersCount }, (_, i) => i + 1);
}
