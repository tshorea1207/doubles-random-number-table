/**
 * 正規化関数のベンチマーク
 */

import { bench, describe } from 'vitest';
import { isNormalized, arrangementToRoundWithRest } from '../../utils/normalization';

describe('isNormalized', () => {
  describe('2コート', () => {
    bench('正規化済み配列', () => {
      isNormalized([1, 2, 3, 4, 5, 6, 7, 8], 2);
    });

    bench('非正規化配列（ルール1違反 - 早期リターン）', () => {
      isNormalized([2, 1, 3, 4, 5, 6, 7, 8], 2);
    });

    bench('非正規化配列（ルール2違反）', () => {
      isNormalized([3, 4, 1, 2, 5, 6, 7, 8], 2);
    });

    bench('非正規化配列（ルール3違反）', () => {
      isNormalized([5, 6, 7, 8, 1, 2, 3, 4], 2);
    });
  });

  describe('3コート', () => {
    bench('正規化済み配列', () => {
      isNormalized([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
    });

    bench('非正規化配列（早期リターン）', () => {
      isNormalized([2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
    });
  });

  describe('4コート', () => {
    bench('正規化済み配列', () => {
      isNormalized([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 4);
    });

    bench('非正規化配列（早期リターン）', () => {
      isNormalized([2, 1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 4);
    });
  });

  describe('1コート', () => {
    bench('正規化済み配列', () => {
      isNormalized([1, 2, 3, 4], 1);
    });

    bench('非正規化配列', () => {
      isNormalized([2, 1, 3, 4], 1);
    });
  });
});

describe('arrangementToRoundWithRest', () => {
  bench('2コート 休憩なし', () => {
    arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8], 2, 1, []);
  });

  bench('2コート 2人休憩', () => {
    arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8], 2, 1, [9, 10]);
  });

  bench('3コート 休憩なし', () => {
    arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3, 1, []);
  });

  bench('3コート 2人休憩', () => {
    arrangementToRoundWithRest([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3, 1, [13, 14]);
  });

  bench('1コート 2人休憩', () => {
    arrangementToRoundWithRest([1, 2, 3, 4], 1, 1, [5, 6]);
  });
});
