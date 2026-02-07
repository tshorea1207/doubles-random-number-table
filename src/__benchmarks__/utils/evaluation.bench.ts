/**
 * 評価関数のベンチマーク
 */

import { bench, describe } from 'vitest';
import {
  evaluate,
  initializeCountMatrix,
  updateCountMatrices,
  initializeRestCounts,
  updateRestCounts,
} from '../../utils/evaluation';
import { arrangementToRoundWithRest } from '../../utils/normalization';
import { createTestRounds, DEFAULT_WEIGHTS } from '../helpers/fixtures';

describe('initializeCountMatrix', () => {
  bench('8人行列初期化 (8x8)', () => {
    initializeCountMatrix(8);
  });

  bench('10人行列初期化 (10x10)', () => {
    initializeCountMatrix(10);
  });

  bench('12人行列初期化 (12x12)', () => {
    initializeCountMatrix(12);
  });

  bench('16人行列初期化 (16x16)', () => {
    initializeCountMatrix(16);
  });
});

describe('initializeRestCounts', () => {
  bench('8人', () => {
    initializeRestCounts(8);
  });

  bench('10人', () => {
    initializeRestCounts(10);
  });

  bench('12人', () => {
    initializeRestCounts(12);
  });
});

describe('updateCountMatrices', () => {
  const round2Courts = arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8], 2, 1, []);
  const round3Courts = arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3, 1, []);

  bench('2コート1ラウンド更新', () => {
    const pairCounts = initializeCountMatrix(8);
    const oppoCounts = initializeCountMatrix(8);
    updateCountMatrices(round2Courts, pairCounts, oppoCounts);
  });

  bench('3コート1ラウンド更新', () => {
    const pairCounts = initializeCountMatrix(12);
    const oppoCounts = initializeCountMatrix(12);
    updateCountMatrices(round3Courts, pairCounts, oppoCounts);
  });
});

describe('updateRestCounts', () => {
  const roundWithRest = arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8], 2, 1, [9, 10]);

  bench('2人休憩の更新', () => {
    const restCounts = initializeRestCounts(10);
    updateRestCounts(roundWithRest, restCounts);
  });
});

describe('evaluate', () => {
  bench('2コート8人 1ラウンド', () => {
    const rounds = createTestRounds(2, 8, 1);
    evaluate(rounds, 8, DEFAULT_WEIGHTS);
  });

  bench('2コート8人 3ラウンド', () => {
    const rounds = createTestRounds(2, 8, 3);
    evaluate(rounds, 8, DEFAULT_WEIGHTS);
  });

  bench('2コート8人 7ラウンド', () => {
    const rounds = createTestRounds(2, 8, 7);
    evaluate(rounds, 8, DEFAULT_WEIGHTS);
  });

  bench('2コート10人 7ラウンド', () => {
    const rounds = createTestRounds(2, 10, 7);
    evaluate(rounds, 10, DEFAULT_WEIGHTS);
  });

  bench('3コート12人 5ラウンド', () => {
    const rounds = createTestRounds(3, 12, 5);
    evaluate(rounds, 12, DEFAULT_WEIGHTS);
  });

  bench('1コート4人 5ラウンド', () => {
    const rounds = createTestRounds(1, 4, 5);
    evaluate(rounds, 4, DEFAULT_WEIGHTS);
  });
});

describe('evaluate - 連続呼び出し', () => {
  // スケジュール生成中のボトルネックをシミュレート
  const rounds7 = createTestRounds(2, 8, 7);

  bench('315回連続評価 (1ラウンド分)', () => {
    for (let i = 0; i < 315; i++) {
      evaluate(rounds7, 8, DEFAULT_WEIGHTS);
    }
  }, { iterations: 10 });

  bench('1890回連続評価 (6ラウンド分)', () => {
    for (let i = 0; i < 1890; i++) {
      evaluate(rounds7, 8, DEFAULT_WEIGHTS);
    }
  }, { iterations: 5 });
});
