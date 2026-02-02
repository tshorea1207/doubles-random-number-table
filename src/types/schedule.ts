/**
 * テニスダブルススケジュール生成の型定義
 */

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
 * 1ラウンドの全試合
 */
export interface Round {
  roundNumber: number; // ラウンド番号（1始まり）
  matches: Match[]; // コートごとに1試合、最小プレイヤー番号でソート済み
}

/**
 * スケジュールの評価指標
 */
export interface Evaluation {
  pairStdDev: number;   // ペア回数の標準偏差
  oppoStdDev: number;   // 対戦回数の標準偏差
  totalScore: number;   // 重み付き合計: pairStdDev * w1 + oppoStdDev * w2
}

/**
 * 大会の完全なスケジュール
 */
export interface Schedule {
  courts: number;       // コート数
  players: number;      // プレイヤーの総数
  rounds: Round[];      // スケジュールの全ラウンド
  evaluation: Evaluation; // 品質指標
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
  };
}

/**
 * スケジュール生成中の進捗情報（評価ベース）
 */
export interface GenerationProgress {
  currentEvaluations: number;  // これまでに完了した評価回数
  totalEvaluations: number;    // 実行予定の総評価回数
  percentage: number;          // 進捗率（0-100）
}
