/**
 * 正規化配置の事前生成ユーティリティ
 *
 * 全順列からフィルタリングする代わりに、正規化制約を満たす配置のみを直接構築する。
 * これにより、8人の場合 40,320回 → 315回 の反復に削減される（128倍高速化）。
 */

/**
 * 正規化配置のキャッシュ
 * キー: "courtsCount-playingCount" (例: "2-8")
 * 値: 正規化された配置の配列
 */
const arrangementCache = new Map<string, number[][]>();

/**
 * 指定されたコート数とプレイヤー数に対する全ての正規化配置を取得する
 *
 * 正規化ルール:
 * 1. 各ペア内: player1 < player2
 * 2. 同一コート内のペア間: min(pairA) < min(pairB)
 * 3. コート間: min(court[i]) < min(court[i+1])
 *
 * キャッシュを使用して同じパラメータでの再計算を防ぐ。
 *
 * @param players - プレイするプレイヤー番号の配列（ソート済み）
 * @param courtsCount - コート数
 * @returns 正規化された配置の配列
 *
 * @example
 * getNormalizedArrangements([1,2,3,4,5,6,7,8], 2)
 * // [[1,2,3,4,5,6,7,8], [1,2,3,5,4,6,7,8], ...] (315通り)
 */
export function getNormalizedArrangements(
  players: number[],
  courtsCount: number
): number[][] {
  // キャッシュキーはプレイヤー構成を含める
  const cacheKey = `${courtsCount}-${players.join(',')}`;

  const cached = arrangementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  // 直接構築アルゴリズムで正規化配置を生成
  const results: number[][] = [];
  generateNormalizedRecursive(players.slice(), courtsCount, [], results);

  arrangementCache.set(cacheKey, results);
  return results;
}

/**
 * 再帰的に正規化制約を満たす配置のみを構築する
 *
 * アルゴリズム:
 * 1. 利用可能なプレイヤーから最小のプレイヤーをpairAのplayer1に固定
 *    （ルール3: コート順序制約を満たすため）
 * 2. 残りからpairAのplayer2を選択（player1 < player2は自動的に満たされる）
 * 3. pairBを選択: min(pairB) > min(pairA) を満たすペア
 * 4. 次のコートへ再帰
 *
 * @param available - 未使用プレイヤー（昇順ソート済み）
 * @param remainingCourts - 残りコート数
 * @param current - 構築中の配置
 * @param results - 結果格納配列
 */
function generateNormalizedRecursive(
  available: number[],
  remainingCourts: number,
  current: number[],
  results: number[][]
): void {
  // 全コート構築完了
  if (remainingCourts === 0) {
    results.push(current.slice());
    return;
  }

  // 利用可能なプレイヤーが不足
  if (available.length < 4) {
    return;
  }

  // ルール3: 最小プレイヤーがこのコートのpairA player1になる
  // availableはソート済みなので、available[0]が最小
  const pairA_p1 = available[0];
  const remainingAfterP1 = available.slice(1);

  // pairAのplayer2を選択（pairA_p1より大きい任意のプレイヤー）
  for (let i = 0; i < remainingAfterP1.length; i++) {
    const pairA_p2 = remainingAfterP1[i];
    const remainingAfterPairA = remainingAfterP1.filter((_, idx) => idx !== i);

    // pairBを選択: 2人の組み合わせで min(pairB) > pairA_p1 を満たすもの
    // remainingAfterPairAはソート済みなので、最小要素 > pairA_p1 なら全てのペアが条件を満たす
    // 実際には pairA_p1 は元の配列で最小だったので、残り全員が pairA_p1 より大きい
    for (const [pairB_p1, pairB_p2, rest] of choosePairB(remainingAfterPairA)) {
      // 現在のコートを追加
      current.push(pairA_p1, pairA_p2, pairB_p1, pairB_p2);

      // 次のコートへ再帰
      generateNormalizedRecursive(rest, remainingCourts - 1, current, results);

      // バックトラック
      current.pop();
      current.pop();
      current.pop();
      current.pop();
    }
  }
}

/**
 * pairBの組み合わせを生成するジェネレータ
 *
 * ルール1, 2を満たす: pairB_p1 < pairB_p2
 *
 * @param players - 選択可能なプレイヤー（ソート済み）
 * @yields [pairB_p1, pairB_p2, 残りのプレイヤー]
 */
function* choosePairB(
  players: number[]
): Generator<[number, number, number[]]> {
  const n = players.length;
  for (let i = 0; i < n - 1; i++) {
    for (let j = i + 1; j < n; j++) {
      // players はソート済みなので players[i] < players[j]
      const rest = players.filter((_, idx) => idx !== i && idx !== j);
      yield [players[i], players[j], rest];
    }
  }
}

/**
 * キャッシュをクリアする（テスト用）
 */
export function clearArrangementCache(): void {
  arrangementCache.clear();
}

/**
 * キャッシュのサイズを取得する（デバッグ用）
 */
export function getArrangementCacheSize(): number {
  return arrangementCache.size;
}
