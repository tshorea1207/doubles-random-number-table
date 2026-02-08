/**
 * 順列生成ユーティリティ
 * C++ STL の next_permutation アルゴリズムに基づく
 */

import type { RestCounts } from '../types/schedule';

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

/**
 * N個の要素からK個を選択する組み合わせを生成するジェネレータ
 *
 * @param arr - 選択元の配列
 * @param k - 選択する要素数
 * @yields 選択された要素の配列
 *
 * @example
 * [...generateCombinations([1, 2, 3], 2)]
 * // [[1, 2], [1, 3], [2, 3]]
 *
 * 計算量: O(C(n, k)) = O(n! / (k!(n-k)!))
 */
export function* generateCombinations(arr: number[], k: number): Generator<number[]> {
  const n = arr.length;
  if (k === 0) {
    yield [];
    return;
  }
  if (n < k) {
    return;
  }

  // インデックスベースの反復方式（spread演算子による中間配列生成を回避）
  const indices = Array.from({ length: k }, (_, i) => i);
  const result = new Array<number>(k);

  // 最初の組み合わせを生成
  for (let i = 0; i < k; i++) {
    result[i] = arr[indices[i]];
  }
  yield result.slice();

  // 後続の組み合わせを辞書順で生成
  while (true) {
    // 右端からインクリメント可能な位置を探す
    let i = k - 1;
    while (i >= 0 && indices[i] === i + n - k) {
      i--;
    }
    if (i < 0) return;

    // インデックスをインクリメントし、後続を再初期化
    indices[i]++;
    for (let j = i + 1; j < k; j++) {
      indices[j] = indices[j - 1] + 1;
    }

    // 結果配列を更新
    for (let j = 0; j < k; j++) {
      result[j] = arr[indices[j]];
    }
    yield result.slice();
  }
}

/**
 * ハイブリッドアプローチで休憩者候補を生成するジェネレータ
 *
 * アルゴリズム:
 * 1. 休憩回数の最小値 minRest と最大値 maxRest を計算
 * 2. 差分 diff = maxRest - minRest を計算
 * 3. diff >= 2 の場合: 公平性制約を適用
 *    - 休憩回数が maxRest のプレイヤーは必ずプレイ（除外）
 *    - 休憩回数が minRest のプレイヤーを優先的に休憩
 * 4. diff < 2 の場合: 全探索
 *
 * @param allPlayers - 全プレイヤー番号の配列
 * @param restCount - 休憩させる人数
 * @param restCounts - 各プレイヤーの現在の休憩回数
 * @yields 休憩者候補の配列（昇順ソート済み）
 *
 * @example
 * // 10人中2人休憩、休憩回数: [1,1,1,0,0,0,1,1,2,2]
 * // minRest=0 (プレイヤー4,5,6), maxRest=2 (プレイヤー9,10), diff=2
 * // 制約適用: プレイヤー4,5,6から2人を選択
 * [...generateRestingCandidates([1..10], 2, restCounts)]
 * // [[4, 5], [4, 6], [5, 6]]
 */
export function* generateRestingCandidates(
  allPlayers: number[],
  restCount: number,
  restCounts: RestCounts
): Generator<number[]> {
  // 休憩者がいない場合は空配列のみを生成
  if (restCount === 0) {
    yield [];
    return;
  }

  const minRest = Math.min(...restCounts);
  const maxRest = Math.max(...restCounts);
  const diff = maxRest - minRest;

  if (diff >= 2) {
    // ハイブリッド: 休憩回数が少ない人から優先的に休憩
    // maxRestのプレイヤーは除外（必ずプレイ）
    const mustRest = allPlayers.filter(p => restCounts[p - 1] === minRest);
    const canRest = allPlayers.filter(p => restCounts[p - 1] < maxRest);

    // mustRestからrestCount人を選択できる場合
    if (mustRest.length >= restCount) {
      yield* generateCombinations(mustRest, restCount);
    } else {
      // mustRestだけでは足りない場合、canRestから補充
      const remaining = restCount - mustRest.length;
      const others = canRest.filter(p => !mustRest.includes(p));
      for (const extra of generateCombinations(others, remaining)) {
        yield [...mustRest, ...extra].sort((a, b) => a - b);
      }
    }
  } else {
    // 全探索: 全プレイヤーからrestCount人を選択
    yield* generateCombinations(allPlayers, restCount);
  }
}
