/**
 * 統計関数のベンチマーク
 */

import { bench, describe } from 'vitest';
import { calculateStandardDeviation, extractUpperTriangleValues } from '../../utils/statistics';
import { initializeCountMatrix } from '../../utils/evaluation';

describe('calculateStandardDeviation', () => {
  // N人の上三角要素数 = N*(N-1)/2
  bench('28要素（8人の上三角）', () => {
    const values = Array(28).fill(0).map((_, i) => i % 5);
    calculateStandardDeviation(values);
  });

  bench('45要素（10人の上三角）', () => {
    const values = Array(45).fill(0).map((_, i) => i % 5);
    calculateStandardDeviation(values);
  });

  bench('66要素（12人の上三角）', () => {
    const values = Array(66).fill(0).map((_, i) => i % 5);
    calculateStandardDeviation(values);
  });

  bench('120要素（16人の上三角）', () => {
    const values = Array(120).fill(0).map((_, i) => i % 5);
    calculateStandardDeviation(values);
  });

  bench('空配列', () => {
    calculateStandardDeviation([]);
  });

  bench('1要素', () => {
    calculateStandardDeviation([5]);
  });

  bench('全同値（分散0）', () => {
    const values = Array(45).fill(3);
    calculateStandardDeviation(values);
  });
});

describe('extractUpperTriangleValues', () => {
  bench('8x8行列', () => {
    const matrix = initializeCountMatrix(8);
    // いくつかの値を設定
    matrix[0][1] = 1;
    matrix[1][0] = 1;
    matrix[2][3] = 2;
    matrix[3][2] = 2;
    extractUpperTriangleValues(matrix);
  });

  bench('10x10行列', () => {
    const matrix = initializeCountMatrix(10);
    matrix[0][1] = 1;
    matrix[1][0] = 1;
    extractUpperTriangleValues(matrix);
  });

  bench('12x12行列', () => {
    const matrix = initializeCountMatrix(12);
    extractUpperTriangleValues(matrix);
  });

  bench('16x16行列', () => {
    const matrix = initializeCountMatrix(16);
    extractUpperTriangleValues(matrix);
  });
});

describe('統計処理の組み合わせ', () => {
  // evaluate() 内の統計処理をシミュレート
  bench('8人: 行列抽出 + 標準偏差×2', () => {
    const pairMatrix = initializeCountMatrix(8);
    const oppoMatrix = initializeCountMatrix(8);

    const pairValues = extractUpperTriangleValues(pairMatrix);
    const oppoValues = extractUpperTriangleValues(oppoMatrix);

    calculateStandardDeviation(pairValues);
    calculateStandardDeviation(oppoValues);
  });

  bench('10人: 行列抽出 + 標準偏差×2', () => {
    const pairMatrix = initializeCountMatrix(10);
    const oppoMatrix = initializeCountMatrix(10);

    const pairValues = extractUpperTriangleValues(pairMatrix);
    const oppoValues = extractUpperTriangleValues(oppoMatrix);

    calculateStandardDeviation(pairValues);
    calculateStandardDeviation(oppoValues);
  });

  bench('12人: 行列抽出 + 標準偏差×2', () => {
    const pairMatrix = initializeCountMatrix(12);
    const oppoMatrix = initializeCountMatrix(12);

    const pairValues = extractUpperTriangleValues(pairMatrix);
    const oppoValues = extractUpperTriangleValues(oppoMatrix);

    calculateStandardDeviation(pairValues);
    calculateStandardDeviation(oppoValues);
  });
});
