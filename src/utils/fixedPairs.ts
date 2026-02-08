/**
 * 固定ペア機能のユーティリティ関数
 */

import type { FixedPair, FixedPairsValidation } from '../types/schedule';

/**
 * 固定ペアを正規化する（player1 < player2）
 *
 * @param p1 - プレイヤー1の番号
 * @param p2 - プレイヤー2の番号
 * @returns 正規化された固定ペア
 */
export function normalizeFixedPair(p1: number, p2: number): FixedPair {
  return p1 < p2
    ? { player1: p1, player2: p2 }
    : { player1: p2, player2: p1 };
}

/**
 * 固定ペアの設定をバリデーションする
 *
 * チェック項目:
 * - 同一プレイヤーが複数のペアに含まれていないか
 * - プレイヤー番号が有効範囲内か
 * - 固定ペア数がコート数を超えていないか（警告）
 *
 * @param fixedPairs - 固定ペアの配列
 * @param playersCount - 参加人数
 * @param courtsCount - コート数
 * @returns バリデーション結果
 */
export function validateFixedPairs(
  fixedPairs: FixedPair[],
  playersCount: number,
  courtsCount: number
): FixedPairsValidation {
  // 空の場合は常に有効
  if (fixedPairs.length === 0) {
    return { isValid: true };
  }

  // 同一プレイヤーの重複チェック
  const usedPlayers = new Set<number>();
  for (const pair of fixedPairs) {
    if (usedPlayers.has(pair.player1)) {
      return {
        isValid: false,
        errorMessage: `プレイヤー ${pair.player1} は既に別の固定ペアに含まれています`,
      };
    }
    if (usedPlayers.has(pair.player2)) {
      return {
        isValid: false,
        errorMessage: `プレイヤー ${pair.player2} は既に別の固定ペアに含まれています`,
      };
    }
    usedPlayers.add(pair.player1);
    usedPlayers.add(pair.player2);
  }

  // プレイヤー番号の範囲チェック
  for (const pair of fixedPairs) {
    if (pair.player1 < 1 || pair.player1 > playersCount) {
      return {
        isValid: false,
        errorMessage: `プレイヤー ${pair.player1} は有効範囲外です（1-${playersCount}）`,
      };
    }
    if (pair.player2 < 1 || pair.player2 > playersCount) {
      return {
        isValid: false,
        errorMessage: `プレイヤー ${pair.player2} は有効範囲外です（1-${playersCount}）`,
      };
    }
  }

  // 警告: 固定ペア数 > コート数
  const warnings: string[] = [];
  if (fixedPairs.length > courtsCount) {
    warnings.push(
      `固定ペア数（${fixedPairs.length}組）がコート数（${courtsCount}面）を超えています。一部の固定ペア同士が対戦することになります。`
    );
  }

  return {
    isValid: true,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * 配列が全ての固定ペア制約を満たしているかチェックする
 *
 * 配列内で各固定ペアが同じコートの同じペア位置（[0,1]または[2,3]）に
 * 存在するかを確認する。
 *
 * @param arrangement - プレイヤー配列またはテンプレート（0-basedインデックス）
 * @param courtsCount - コート数
 * @param fixedPairs - 固定ペアの配列
 * @param playerMap - テンプレート使用時の変換配列（省略時はarrangementを直接使用）
 * @returns 全ての固定ペア制約を満たしていればtrue
 *
 * @example
 * // 直接使用: 2コート、固定ペア (1,2)
 * satisfiesFixedPairs([1,2,3,4, 5,6,7,8], 2, [{player1:1, player2:2}])
 * // => true
 *
 * // テンプレート使用: template=[0,1,2,3,4,5,6,7], playerMap=[1,2,3,4,5,6,7,8]
 * satisfiesFixedPairs([0,1,2,3,4,5,6,7], 2, [{player1:1, player2:2}], [1,2,3,4,5,6,7,8])
 * // => true
 */
export function satisfiesFixedPairs(
  arrangement: number[],
  courtsCount: number,
  fixedPairs: FixedPair[],
  playerMap?: number[]
): boolean {
  // 固定ペアがない場合は常に満たす
  if (fixedPairs.length === 0) {
    return true;
  }

  const playersPerCourt = 4;

  // 配列からペアマップを構築
  // key: プレイヤー番号, value: そのプレイヤーとペアになっているプレイヤー番号
  const pairMap = new Map<number, number>();

  for (let courtIdx = 0; courtIdx < courtsCount; courtIdx++) {
    const offset = courtIdx * playersPerCourt;
    // テンプレートの場合はplayerMapで実番号に変換
    const p0 = playerMap ? playerMap[arrangement[offset]] : arrangement[offset];
    const p1 = playerMap ? playerMap[arrangement[offset + 1]] : arrangement[offset + 1];
    const p2 = playerMap ? playerMap[arrangement[offset + 2]] : arrangement[offset + 2];
    const p3 = playerMap ? playerMap[arrangement[offset + 3]] : arrangement[offset + 3];
    // ペアA: positions [0,1]
    pairMap.set(p0, p1);
    pairMap.set(p1, p0);
    // ペアB: positions [2,3]
    pairMap.set(p2, p3);
    pairMap.set(p3, p2);
  }

  // 各固定ペアが実際にペアになっているかチェック
  for (const fp of fixedPairs) {
    if (pairMap.get(fp.player1) !== fp.player2) {
      return false;
    }
  }

  return true;
}
