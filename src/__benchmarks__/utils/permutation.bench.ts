/**
 * 順列生成関数のベンチマーク
 */

import { bench, describe } from 'vitest';
import {
  nextPermutation,
  createInitialArrangement,
  generateCombinations,
  generateRestingCandidates,
} from '../../utils/permutation';
import { initializeRestCounts } from '../../utils/evaluation';

describe('nextPermutation', () => {
  bench('8人配列の1回呼び出し', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    nextPermutation(arr);
  });

  bench('8人配列を全順列走査 (40,320通り)', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8];
    let count = 0;
    do {
      count++;
    } while (nextPermutation(arr));
  }, { iterations: 10 });

  bench('12人配列の1回呼び出し', () => {
    const arr = createInitialArrangement(12);
    nextPermutation(arr);
  });

  bench('4人配列を全順列走査 (24通り)', () => {
    const arr = [1, 2, 3, 4];
    let count = 0;
    do {
      count++;
    } while (nextPermutation(arr));
  });
});

describe('createInitialArrangement', () => {
  bench('8人配列生成', () => {
    createInitialArrangement(8);
  });

  bench('10人配列生成', () => {
    createInitialArrangement(10);
  });

  bench('12人配列生成', () => {
    createInitialArrangement(12);
  });

  bench('16人配列生成', () => {
    createInitialArrangement(16);
  });
});

describe('generateCombinations', () => {
  bench('C(10, 2) = 45通り', () => {
    const arr = createInitialArrangement(10);
    for (const _ of generateCombinations(arr, 2)) {
      // 45回
    }
  });

  bench('C(12, 2) = 66通り', () => {
    const arr = createInitialArrangement(12);
    for (const _ of generateCombinations(arr, 2)) {
      // 66回
    }
  });

  bench('C(12, 4) = 495通り', () => {
    const arr = createInitialArrangement(12);
    for (const _ of generateCombinations(arr, 4)) {
      // 495回
    }
  });

  bench('C(16, 4) = 1820通り', () => {
    const arr = createInitialArrangement(16);
    for (const _ of generateCombinations(arr, 4)) {
      // 1820回
    }
  });
});

describe('generateRestingCandidates', () => {
  bench('10人2人休憩 - 均等時（全探索 C(10,2)=45通り）', () => {
    const allPlayers = createInitialArrangement(10);
    const restCounts = initializeRestCounts(10); // 全員0
    let count = 0;
    for (const _ of generateRestingCandidates(allPlayers, 2, restCounts)) {
      count++;
    }
  });

  bench('10人2人休憩 - 偏り時（ハイブリッド diff>=2）', () => {
    const allPlayers = createInitialArrangement(10);
    // 差が2以上: プレイヤー1-3が0回、4-7が1回、8-10が2回休憩
    const restCounts = [0, 0, 0, 1, 1, 1, 1, 2, 2, 2];
    let count = 0;
    for (const _ of generateRestingCandidates(allPlayers, 2, restCounts)) {
      count++;
    }
  });

  bench('12人4人休憩 - 均等時（全探索 C(12,4)=495通り）', () => {
    const allPlayers = createInitialArrangement(12);
    const restCounts = initializeRestCounts(12);
    let count = 0;
    for (const _ of generateRestingCandidates(allPlayers, 4, restCounts)) {
      count++;
    }
  });

  bench('12人4人休憩 - 偏り時（ハイブリッド diff>=2）', () => {
    const allPlayers = createInitialArrangement(12);
    // 差が2以上
    const restCounts = [0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2];
    let count = 0;
    for (const _ of generateRestingCandidates(allPlayers, 4, restCounts)) {
      count++;
    }
  });
});
