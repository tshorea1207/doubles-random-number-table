/**
 * 正規化配置の事前生成ユーティリティ
 *
 * 全順列からフィルタリングする代わりに、正規化制約を満たす配置のみを直接構築する。
 * これにより、8人の場合 40,320回 → 315回 の反復に削減される（128倍高速化）。
 *
 * テンプレート方式: 配置を0-basedインデックスのテンプレートとして保存し、
 * 使用時にplayerMapで実プレイヤー番号に変換する。
 * これにより、異なるプレイヤーサブセットで同一構造のキャッシュ重複を排除する。
 * （10人2コートの場合: 45エントリ → 1エントリ に削減）
 *
 * メモリ戦略:
 * - 小規模（推定配置数 ≤ CACHE_THRESHOLD）: 配列にキャッシュ（高速な再利用）
 * - 大規模（推定配置数 > CACHE_THRESHOLD）: ジェネレータで逐次生成（メモリ安全）
 */

/**
 * キャッシュを使用する配置数の上限
 * これを超える場合はジェネレータで逐次生成する
 */
const CACHE_THRESHOLD = 1_000_000;

/**
 * 正規化配置テンプレートのキャッシュ（小規模用）
 * キー: "courtsCount-playingCount" (例: "2-8")
 * 値: 0-basedインデックスの配置テンプレート配列
 */
const arrangementCache = new Map<string, number[][]>();

/**
 * 階乗（n!）を計算する
 */
function factorial(n: number): number {
  if (n <= 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * 正規化配置数を推定する
 *
 * 式: n! / (2^(3*courts) * courts!)
 * - 2^(2*courts): 各ペア内の順序（ペア数 = 2*courts）
 * - 2^courts: 各コート内のペア間の順序
 * - courts!: コート間の順序
 *
 * @example
 * estimateArrangementCount(2, 8) // 8! / (2^6 * 2!) = 40320 / 128 = 315
 * estimateArrangementCount(4, 16) // 16! / (2^12 * 4!) ≈ 212,837,625
 */
export function estimateArrangementCount(courtsCount: number, playingCount: number): number {
  const totalPermutations = factorial(playingCount);
  const divisor = Math.pow(2, courtsCount * 3) * factorial(courtsCount);
  return Math.floor(totalPermutations / divisor);
}

/**
 * 指定されたコート数とプレイ人数に対する全ての正規化配置テンプレートを取得する
 *
 * 正規化ルール:
 * 1. 各ペア内: player1 < player2
 * 2. 同一コート内のペア間: min(pairA) < min(pairB)
 * 3. コート間: min(court[i]) < min(court[i+1])
 *
 * テンプレートは0-basedインデックスで格納される。
 * 使用時に playerMap[index] で実プレイヤー番号に変換すること。
 *
 * 小規模の場合はキャッシュ配列、大規模の場合はジェネレータを返す。
 * 消費側は for...of ループでどちらも同様に使用可能。
 *
 * 注意: 大規模ケース（ジェネレータ）では、yield された配列は内部で再利用される。
 * 保持が必要な場合は消費側で .slice() すること。
 *
 * @param courtsCount - コート数
 * @param playingCount - プレイするプレイヤー数
 * @returns 0-basedインデックスの正規化配置テンプレートの Iterable
 *
 * @example
 * getNormalizedArrangements(2, 8)
 * // 315通りのテンプレートを返す（キャッシュ配列）
 *
 * getNormalizedArrangements(4, 16)
 * // 約2.1億通りのテンプレートをジェネレータで逐次生成
 */
export function getNormalizedArrangements(
  courtsCount: number,
  playingCount: number
): Iterable<number[]> {
  const estimated = estimateArrangementCount(courtsCount, playingCount);

  if (estimated <= CACHE_THRESHOLD) {
    // 小規模: キャッシュ配列を使用
    return getCachedArrangements(courtsCount, playingCount);
  }

  // 大規模: ジェネレータで逐次生成（毎回新しいジェネレータを返す）
  const indices = Array.from({ length: playingCount }, (_, i) => i);
  return generateNormalizedRecursiveGen(indices, courtsCount, []);
}

/**
 * 小規模用: キャッシュされた配置配列を取得する
 */
function getCachedArrangements(courtsCount: number, playingCount: number): number[][] {
  const cacheKey = `${courtsCount}-${playingCount}`;

  const cached = arrangementCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const indices = Array.from({ length: playingCount }, (_, i) => i);
  const results: number[][] = [];
  generateNormalizedRecursive(indices, courtsCount, [], results);

  arrangementCache.set(cacheKey, results);
  return results;
}

/**
 * 再帰的に正規化制約を満たす配置のみを構築する（配列蓄積版）
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
 * 再帰的に正規化制約を満たす配置のみを構築する（ジェネレータ版）
 *
 * generateNormalizedRecursive と同じアルゴリズムだが、
 * results 配列に蓄積する代わりに yield で1件ずつ返す。
 * メモリ使用量: O(playingCount) の再帰スタックのみ。
 *
 * 注意: yield される配列は内部の current 配列への参照。
 * 次の yield で内容が変わるため、保持する場合は .slice() でコピーすること。
 *
 * @param available - 未使用プレイヤー（昇順ソート済み）
 * @param remainingCourts - 残りコート数
 * @param current - 構築中の配置（内部で再利用）
 */
function* generateNormalizedRecursiveGen(
  available: number[],
  remainingCourts: number,
  current: number[]
): Generator<number[]> {
  // 全コート構築完了
  if (remainingCourts === 0) {
    yield current;
    return;
  }

  // 利用可能なプレイヤーが不足
  if (available.length < 4) {
    return;
  }

  const pairA_p1 = available[0];
  const remainingAfterP1 = available.slice(1);

  for (let i = 0; i < remainingAfterP1.length; i++) {
    const pairA_p2 = remainingAfterP1[i];
    const remainingAfterPairA = remainingAfterP1.filter((_, idx) => idx !== i);

    for (const [pairB_p1, pairB_p2, rest] of choosePairB(remainingAfterPairA)) {
      current.push(pairA_p1, pairA_p2, pairB_p1, pairB_p2);

      yield* generateNormalizedRecursiveGen(rest, remainingCourts - 1, current);

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
