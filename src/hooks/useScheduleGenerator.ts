import { useState, useCallback } from 'react';
import type { Schedule, ScheduleParams, Round, GenerationProgress, FixedPair } from '../types/schedule';
import { createInitialArrangement, nextPermutation } from '../utils/permutation';
import { isNormalized, arrangementToRound } from '../utils/normalization';
import { evaluate } from '../utils/evaluation';
import { satisfiesFixedPairs } from '../utils/fixedPairs';

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
 * 与えられたパラメータに対する正規化された配列の数を推定する
 *
 * 式: n! / ((2^courts) * (2^(2*courts)) * courts!)
 * - n! = 全順列数
 * - 2^courts = ペア順序の正規化
 * - 2^(2*courts) = マッチペア順序の正規化
 * - courts! = コート順序の正規化
 *
 * 例: 2コート、8人
 * 8! / (2^2 * 2^4 * 2!) = 40320 / (4 * 16 * 2) = 40320 / 128 = 315
 */
function estimateNormalizedCount(playersCount: number, courtsCount: number): number {
  const totalPermutations = factorial(playersCount);
  const pairOrderDivisor = Math.pow(2, courtsCount * 2); // 各ペアは入れ替え可能
  const courtOrderDivisor = factorial(courtsCount);
  return Math.floor(totalPermutations / (pairOrderDivisor * courtOrderDivisor));
}

/**
 * 標準的な正規化配列を使って最初のラウンドを作成する
 *
 * 固定ペアがない場合:
 *   N人のプレイヤーの場合、最初のラウンドは常に [1, 2, 3, ..., N]
 *   例: 2コート、8人の場合: コート1: (1,2):(3,4)、コート2: (5,6):(7,8)
 *
 * 固定ペアがある場合:
 *   固定ペア制約を満たす最初の正規化配列を探索
 *
 * @param playersCount - プレイヤーの総数
 * @param courtsCount - コート数
 * @param fixedPairs - 固定ペアの配列
 * @returns 標準形式の最初のラウンド
 * @throws 固定ペアを満たす配置が見つからない場合
 */
function createFirstRound(
  playersCount: number,
  courtsCount: number,
  fixedPairs: FixedPair[]
): Round {
  // 固定ペアがない場合は従来通り
  if (fixedPairs.length === 0) {
    const arrangement = createInitialArrangement(playersCount);
    return arrangementToRound(arrangement, courtsCount, 1);
  }

  // 固定ペアがある場合: 最初の有効な配列を探索
  const arrangement = createInitialArrangement(playersCount);
  do {
    if (isNormalized(arrangement, courtsCount) &&
        satisfiesFixedPairs(arrangement, courtsCount, fixedPairs)) {
      return arrangementToRound(arrangement.slice(), courtsCount, 1);
    }
  } while (nextPermutation(arrangement));

  throw new Error('固定ペアを満たす配置が見つかりません');
}

/**
 * 貪欲アルゴリズムを使用して最適な次のラウンドを探す
 *
 * アルゴリズム:
 * 1. [1, 2, ..., N] の全順列を生成
 * 2. 正規化された配列のみをフィルタ（例: 2コート8人で40,320通りから315通り）
 * 3. 固定ペア制約を満たす配列のみをフィルタ
 * 4. 各候補配列について:
 *    - 一時的なラウンドを作成
 *    - これまでの全ラウンドとの累積スコアを評価
 *    - 最低スコアの配列を追跡
 * 5. 最良の配列をラウンドとして返す
 *
 * @param currentRounds - これまでに生成された全ラウンド
 * @param playersCount - プレイヤーの総数
 * @param courtsCount - コート数
 * @param weights - 評価の重み
 * @param fixedPairs - 固定ペアの配列
 * @returns 累積評価スコアが最低のラウンド
 *
 * 計算量: O(normalized_arrangements * rounds * players²)
 * 2コート8人の場合: O(315 * rounds * 64)
 */
function findBestNextRound(
  currentRounds: Round[],
  playersCount: number,
  courtsCount: number,
  weights: { w1: number; w2: number },
  fixedPairs: FixedPair[]
): Round {
  const arrangement = createInitialArrangement(playersCount);
  let bestArrangement: number[] | null = null;
  let bestScore = Infinity;

  // 全順列を反復
  do {
    // 正規化された配列かつ固定ペア制約を満たす配列のみを評価
    if (isNormalized(arrangement, courtsCount) &&
        satisfiesFixedPairs(arrangement, courtsCount, fixedPairs)) {
      // 候補ラウンドを作成
      const candidateRound = arrangementToRound(
        arrangement.slice(), // ミューテーションを避けるためコピー
        courtsCount,
        currentRounds.length + 1
      );

      // このラウンドを追加して評価
      const candidateRounds = [...currentRounds, candidateRound];
      const evaluation = evaluate(candidateRounds, playersCount, weights);

      // 最良を追跡
      if (evaluation.totalScore < bestScore) {
        bestScore = evaluation.totalScore;
        bestArrangement = arrangement.slice(); // 参照ではなくコピー
      }
    }
  } while (nextPermutation(arrangement));

  // 最良の配列をラウンドに変換
  if (!bestArrangement) {
    throw new Error('固定ペアを満たす配置が見つかりません');
  }
  return arrangementToRound(bestArrangement, courtsCount, currentRounds.length + 1);
}

/**
 * 進捗報告付きで非同期に最適な次のラウンドを探す
 *
 * findBestNextRound と同様だが、コールバック経由で評価の進捗を報告する
 *
 * @param currentRounds - これまでに生成された全ラウンド
 * @param playersCount - プレイヤーの総数
 * @param courtsCount - コート数
 * @param weights - 評価の重み
 * @param fixedPairs - 固定ペアの配列
 * @param onProgress - 進捗更新のコールバック（現在の評価回数）
 * @returns 累積評価スコアが最低のラウンド
 */
async function findBestNextRoundAsync(
  currentRounds: Round[],
  playersCount: number,
  courtsCount: number,
  weights: { w1: number; w2: number },
  fixedPairs: FixedPair[],
  onProgress: (evaluationCount: number) => void
): Promise<Round> {
  const arrangement = createInitialArrangement(playersCount);
  let bestArrangement: number[] | null = null;
  let bestScore = Infinity;
  let evaluationCount = 0;

  const BATCH_SIZE = 100; // 100評価ごとにUIスレッドに制御を譲る

  // 全順列を反復
  do {
    // 正規化された配列かつ固定ペア制約を満たす配列のみを評価
    if (isNormalized(arrangement, courtsCount) &&
        satisfiesFixedPairs(arrangement, courtsCount, fixedPairs)) {
      evaluationCount++;

      // 候補ラウンドを作成
      const candidateRound = arrangementToRound(
        arrangement.slice(),
        courtsCount,
        currentRounds.length + 1
      );

      // このラウンドを追加して評価
      const candidateRounds = [...currentRounds, candidateRound];
      const evaluation = evaluate(candidateRounds, playersCount, weights);

      // 最良を追跡
      if (evaluation.totalScore < bestScore) {
        bestScore = evaluation.totalScore;
        bestArrangement = arrangement.slice();
      }

      // 定期的に進捗を報告し制御を譲る
      if (evaluationCount % BATCH_SIZE === 0) {
        onProgress(evaluationCount);
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }
  } while (nextPermutation(arrangement));

  // バッチ境界でない場合、最終進捗を報告
  if (evaluationCount % BATCH_SIZE !== 0) {
    onProgress(evaluationCount);
  }

  if (!bestArrangement) {
    throw new Error('固定ペアを満たす配置が見つかりません');
  }
  return arrangementToRound(bestArrangement, courtsCount, currentRounds.length + 1);
}

/**
 * 貪欲逐次構築法を使用して最適化されたダブルススケジュールを生成する
 *
 * アルゴリズム:
 * 1. 最初のラウンドを標準的な正規化形式に固定（固定ペアがある場合は探索）
 * 2. 後続の各ラウンドについて:
 *    - 全ての正規化配列を評価（固定ペア制約を適用）
 *    - 累積スコアが最低のものを選択
 * 3. 最終評価付きの完全なスケジュールを返す
 *
 * 注意: これは貪欲アルゴリズムなので大域最適解を保証しないが、
 * 通常は妥当な時間内に良い解を生成する。
 *
 * @param params - スケジュール生成パラメータ
 * @returns 評価指標付きの完全なスケジュール
 *
 * @example
 * generateSchedule({
 *   courtsCount: 2,
 *   playersCount: 8,
 *   roundsCount: 7,
 *   weights: { w1: 1.0, w2: 0.5 },
 *   fixedPairs: []
 * })
 * // 約 315 * 6 = 1,890 回の評価を含むスケジュールを返す
 * // 生成時間: 1秒未満
 *
 * 計算量: O(rounds * normalized_arrangements * rounds * players²)
 * 2コート8人7ラウンドの場合: O(7 * 315 * 7 * 64) ≈ 100万操作
 */
export function generateSchedule(params: ScheduleParams): Schedule {
  const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

  const rounds: Round[] = [];

  // ステップ1: 最初のラウンドを作成（正規化された基本ケース、固定ペア考慮）
  const firstRound = createFirstRound(playersCount, courtsCount, fixedPairs);
  rounds.push(firstRound);

  // ステップ2: 貪欲アプローチで後続ラウンドを生成
  for (let r = 2; r <= roundsCount; r++) {
    const bestRound = findBestNextRound(rounds, playersCount, courtsCount, weights, fixedPairs);
    rounds.push(bestRound);
  }

  // ステップ3: 最終評価を計算
  const evaluation = evaluate(rounds, playersCount, weights);

  return {
    courts: courtsCount,
    players: playersCount,
    rounds,
    evaluation,
    fixedPairs,
  };
}

/**
 * 進捗報告付きで非同期にスケジュールを生成する
 *
 * @param params - スケジュール生成パラメータ
 * @param onProgress - 進捗更新のコールバック
 * @returns 評価指標付きの完全なスケジュール
 */
export async function generateScheduleAsync(
  params: ScheduleParams,
  onProgress: (progress: GenerationProgress) => void
): Promise<Schedule> {
  const { courtsCount, playersCount, roundsCount, weights, fixedPairs } = params;

  const rounds: Round[] = [];

  // 総評価回数を計算
  const normalizedCount = estimateNormalizedCount(playersCount, courtsCount);
  const totalEvaluations = normalizedCount * (roundsCount - 1);
  let currentEvaluations = 0;

  // ステップ1: 最初のラウンドを作成（正規化された基本ケース、固定ペア考慮）
  const firstRound = createFirstRound(playersCount, courtsCount, fixedPairs);
  rounds.push(firstRound);

  // 初期進捗を報告
  onProgress({
    currentEvaluations: 0,
    totalEvaluations,
    percentage: 0
  });

  // ステップ2: 貪欲アプローチで後続ラウンドを生成
  for (let r = 2; r <= roundsCount; r++) {
    // ラウンド間でUIスレッドに譲る
    await new Promise(resolve => setTimeout(resolve, 0));

    const bestRound = await findBestNextRoundAsync(
      rounds,
      playersCount,
      courtsCount,
      weights,
      fixedPairs,
      (roundEvaluations: number) => {
        // このラウンドの進捗を更新
        const prevRoundEvaluations = normalizedCount * (r - 2);
        currentEvaluations = prevRoundEvaluations + roundEvaluations;
        const percentage = Math.round((currentEvaluations / totalEvaluations) * 100);

        onProgress({
          currentEvaluations,
          totalEvaluations,
          percentage
        });
      }
    );

    rounds.push(bestRound);
  }

  // ステップ3: 最終評価を計算
  const evaluation = evaluate(rounds, playersCount, weights);

  // 完了を報告
  onProgress({
    currentEvaluations: totalEvaluations,
    totalEvaluations,
    percentage: 100
  });

  return {
    courts: courtsCount,
    players: playersCount,
    rounds,
    evaluation,
    fixedPairs,
  };
}

/**
 * ローディング、進捗、エラー状態を持つスケジュール生成用 React フック
 *
 * @returns スケジュール状態、進捗、生成関数を含むフックインターフェース
 *
 * @example
 * const { schedule, isGenerating, progress, error, generate } = useScheduleGenerator();
 *
 * // 生成をトリガー
 * generate({ courtsCount: 2, playersCount: 8, roundsCount: 7, weights: { w1: 1.0, w2: 0.5 } });
 *
 * // 進捗を表示
 * if (isGenerating && progress) {
 *   return <Progress value={progress.percentage} label={`評価 ${progress.currentEvaluations} / ${progress.totalEvaluations}`} />;
 * }
 * if (error) return <Error message={error} />;
 * if (schedule) return <ScheduleTable schedule={schedule} />;
 */
export function useScheduleGenerator() {
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback((params: ScheduleParams) => {
    setIsGenerating(true);
    setError(null);
    setProgress(null);

    // 進捗更新付きで非同期生成を実行
    generateScheduleAsync(params, (progressUpdate) => {
      setProgress(progressUpdate);
    })
      .then((result) => {
        setSchedule(result);
        setIsGenerating(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '生成に失敗しました');
        setIsGenerating(false);
        setProgress(null);
      });
  }, []);

  return { schedule, isGenerating, progress, error, generate };
}
