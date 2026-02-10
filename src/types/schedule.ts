/**
 * テニスダブルススケジュール生成の型定義
 */

/**
 * 固定ペア（常に一緒にペアを組む2人のプレイヤー）
 * 不変条件: player1 < player2（正規化済み）
 * 用途: 夫婦、親子、初心者+経験者など
 */
export interface FixedPair {
  player1: number; // プレイヤー番号（1始まり）、常に小さい方
  player2: number; // プレイヤー番号（1始まり）、常に大きい方
}

/**
 * 固定ペアのバリデーション結果
 */
export interface FixedPairsValidation {
  isValid: boolean;
  errorMessage?: string;
  warnings?: string[];
}

/**
 * ダブルスの試合におけるペア（2人のプレイヤー）
 * 不変条件: player1 < player2（正規化済み）
 */
export interface Pair {
  player1: number; // プレイヤー番号（1始まり）
  player2: number; // プレイヤー番号（1始まり）
}

/**
 * 1コートでの試合（2ペアが対戦）
 * 不変条件: min(pairA) < min(pairB)（正規化済み）
 */
export interface Match {
  pairA: Pair;
  pairB: Pair;
}

/**
 * 1ラウンドの全試合と休憩者
 */
export interface Round {
  roundNumber: number; // ラウンド番号（1始まり）
  matches: Match[]; // コートごとに1試合（コート割り当てはランダム）
  restingPlayers: number[]; // このラウンドで休憩するプレイヤー番号（昇順）
}

/**
 * スケジュールの評価指標
 */
export interface Evaluation {
  pairStdDev: number;   // ペア回数の標準偏差
  oppoStdDev: number;   // 対戦回数の標準偏差
  restStdDev: number;   // 休憩回数の標準偏差
  totalScore: number;   // 重み付き合計: pairStdDev * w1 + oppoStdDev * w2 + restStdDev * w3
}

/**
 * 大会の完全なスケジュール
 */
export interface Schedule {
  courts: number;       // コート数
  players: number;      // 最大プレイヤー番号（行列サイズ用）
  rounds: Round[];      // スケジュールの全ラウンド
  evaluation: Evaluation; // 品質指標
  fixedPairs: FixedPair[]; // 固定ペアのリスト
  activePlayers: number[]; // 現在アクティブなプレイヤー番号（ソート済み）
}

/**
 * ペア/対戦回数のカウント行列
 * CountMatrix[i][j] = プレイヤー i+1 と j+1 がペアを組んだ/対戦した回数
 * 注意: プレイヤー番号は1始まり、配列インデックスは0始まり
 */
export type CountMatrix = number[][];

/**
 * スケジュール生成のパラメータ
 */
export interface ScheduleParams {
  courtsCount: number;
  playersCount: number;
  roundsCount: number;
  weights: {
    w1: number; // ペア回数の標準偏差の重み
    w2: number; // 対戦回数の標準偏差の重み
    w3: number; // 休憩回数の標準偏差の重み
  };
  fixedPairs: FixedPair[]; // 固定ペアのリスト
}

/**
 * 休憩回数カウント配列
 * RestCounts[i] = プレイヤー i+1 の休憩回数
 * 注意: プレイヤー番号は1始まり、配列インデックスは0始まり
 */
export type RestCounts = number[];

/**
 * 増分評価のための累積状態
 * ラウンド追加時に差分のみ更新することで、評価コストをO(rounds×courts)からO(courts)に削減
 */
export interface CumulativeState {
  pairCounts: CountMatrix;   // 累積ペア回数行列
  oppoCounts: CountMatrix;   // 累積対戦回数行列
  restCounts: RestCounts;    // 累積休憩回数配列
  pairSum: number;           // ペア回数上三角要素の合計
  pairSumSq: number;         // ペア回数上三角要素の二乗和
  pairN: number;             // ペア回数上三角要素数 = N*(N-1)/2
  oppoSum: number;           // 対戦回数上三角要素の合計
  oppoSumSq: number;         // 対戦回数上三角要素の二乗和
  oppoN: number;             // 対戦回数上三角要素数 = N*(N-1)/2
  restSum: number;           // 休憩回数の合計
  restSumSq: number;         // 休憩回数の二乗和
  restN: number;             // プレイヤー数
}

/**
 * 参加者変更後の残りラウンド再生成パラメータ
 */
export interface RegenerationParams {
  courtsCount: number;
  completedRounds: Round[];       // 消化済みラウンド（保持する）
  activePlayers: number[];        // 新しいアクティブプレイヤー（ソート済み）
  remainingRoundsCount: number;   // 再生成するラウンド数
  weights: { w1: number; w2: number; w3: number };
  fixedPairs: FixedPair[];
}

/**
 * スケジュール生成中の進捗情報（評価ベース）
 */
export interface GenerationProgress {
  currentEvaluations: number;  // これまでに完了した評価回数
  totalEvaluations: number;    // 実行予定の総評価回数
  percentage: number;          // 進捗率（0-100）
  currentRound: number;        // 現在生成中のラウンド番号（1始まり）
  totalRounds: number;         // 総ラウンド数
}
