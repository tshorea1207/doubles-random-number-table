import type { CountMatrix } from '../types/schedule';

/**
 * 数値配列の標準偏差を計算する
 *
 * @param values - 数値の配列
 * @returns 標準偏差（配列が空の場合は0を返す）
 *
 * @example
 * calculateStandardDeviation([1, 2, 3, 4, 5]) // 約1.414を返す
 * calculateStandardDeviation([]) // 0を返す
 */
export function calculateStandardDeviation(values: number[]): number {
  if (values.length === 0) return 0;

  // 平均を計算
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length;

  // 分散を計算
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;

  // 標準偏差（分散の平方根）を返す
  return Math.sqrt(variance);
}

/**
 * 対称行列の上三角部分の値を抽出する（対角線を除く）
 *
 * ペア/対戦回数行列で使用。matrix[i][j] = matrix[j][i]となる対称行列で、
 * 各ペアを1回だけカウントするために使用。
 *
 * @param matrix - N×Nの対称行列
 * @returns 上三角部分（i < j）の値の配列
 *
 * @example
 * // 3×3行列の場合:
 * // [0, 1, 2]
 * // [1, 0, 3]
 * // [2, 3, 0]
 * extractUpperTriangleValues(matrix) // [1, 2, 3]を返す
 *
 * 計算量: O(N²)
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
