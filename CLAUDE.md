# ダブルス乱数表アプリ - CLAUDE.md

## プロジェクト概要

テニスサークルのダブルス組み合わせを最適化するWebアプリケーション。
React + Vite + MUI で構築する。

## 技術スタック

- **フレームワーク**: React 18+
- **ビルドツール**: Vite
- **UIライブラリ**: MUI (Material-UI) v5+
- **言語**: TypeScript

---

## アルゴリズム仕様

### 問題定義

- **入力**: コート数、参加人数N、ラウンド数R
- **出力**: 各ラウンドの対戦組み合わせ表
- **制約**: 1コートにつき4人（2vs2のダブルス）

### 評価関数（目的関数）

組み合わせの良さを以下の評価値で判定する（値が小さいほど良い）：

```
totalScore = pairStdDev * w1 + oppoStdDev * w2 + restStdDev * w3
```

| 評価項目         | 説明           | 計算方法                         |
| ---------------- | -------------- | -------------------------------- |
| `pairStdDev`     | ペア回数の偏り | `pair_counts[p1][p2]` の標準偏差 |
| `oppoStdDev`     | 対戦回数の偏り | `oppo_counts[p1][p2]` の標準偏差 |
| `restStdDev`     | 休憩回数の偏り | `rest_counts[p]` の標準偏差      |
| `w1`, `w2`, `w3` | 重み係数       | w1: ペア、w2: 対戦、w3: 休憩     |

- `pair_counts[p1][p2]`: プレイヤーp1とp2がペアを組んだ回数
- `oppo_counts[p1][p2]`: プレイヤーp1とp2が対戦した回数
- `rest_counts[p]`: プレイヤーpが休憩した回数

### 組み合わせの正規化

探索空間を削減するため、以下の正規化ルールを適用する：

1. **ペア内の順序**: 常に `p1 < p2` となるよう昇順化
2. **対戦ペア間の順序**: 各ペアの最小プレイヤー番号で昇順にソート
3. **コート間の順序**: 各コートの最小プレイヤー番号で昇順にソート

**効果**: 2面8人の場合、40,320通り → 315通りに削減

### 逐次決定法（Sequential Decision Method）

全探索は計算量的に不可能なため、ランダム選択と制約チェックによる高速な2フェーズ手法を採用：

1. **第1ラウンド固定**: 正規化に基づき一意に決定
   - 例（2面8人）: `(1,2 : 3,4) (5,6 : 7,8)`

2. **Phase 1: ハード制約 + バックトラック**（最大100リトライ）:
   - プレイヤーをランダムにシャッフルし、コートごとに4人ずつ割り当て
   - 未ペア・未対戦の制約を満たせない場合はラウンド全体をリトライ

3. **Phase 2: スコアリングフォールバック**（Phase 1 が失敗した場合、最大100リトライ）:
   - ランダムシャッフルの各試行でペア回数・対戦回数・連続対戦ペナルティを算出
   - 最良スコアの組み合わせを採用（常に成功）

4. **計算量**: O(R × C × N) — 高速に動作

---

## データ構造

### 型定義

```typescript
// ペア（2人のプレイヤー）
interface Pair {
  player1: number; // 常に player1 < player2
  player2: number;
}

// 1コートの対戦（2ペア）
interface Match {
  pairA: Pair; // 常に min(pairA) < min(pairB)
  pairB: Pair;
}

// 1ラウンドの全コート
interface Round {
  roundNumber: number;
  matches: Match[]; // コートごとに1試合
  restingPlayers: number[]; // このラウンドで休憩するプレイヤー番号（昇順）
}

// スケジュールの評価指標
interface Evaluation {
  pairStdDev: number; // ペア回数の標準偏差
  oppoStdDev: number; // 対戦回数の標準偏差
  restStdDev: number; // 休憩回数の標準偏差
  totalScore: number; // 重み付き合計: pairStdDev * w1 + oppoStdDev * w2 + restStdDev * w3
}

// 対戦表全体
interface Schedule {
  courts: number;
  players: number;
  rounds: Round[];
  evaluation: Evaluation;
  fixedPairs: FixedPair[]; // 固定ペアのリスト
  activePlayers: number[]; // 現在アクティブなプレイヤー番号（ソート済み）
}

// カウント行列
type CountMatrix = number[][];
```

---

## コンポーネント設計

```
src/
├── components/
│   ├── ScheduleForm.tsx      # 入力フォーム（コート数、人数、ラウンド数）
│   ├── ScheduleTable.tsx     # 対戦表の表示
│   ├── EvaluationDisplay.tsx # 評価値の表示
│   └── PlayerStatsTable.tsx  # プレイヤーごとの統計
├── hooks/
│   └── useScheduleGenerator.ts # 組み合わせ生成ロジック
├── utils/
│   ├── permutation.ts        # 順列生成
│   ├── normalization.ts      # 正規化関数
│   ├── evaluation.ts         # 評価関数
│   └── statistics.ts         # 標準偏差計算
├── types/
│   └── schedule.ts           # 型定義
├── App.tsx
└── main.tsx
```

---

## 主要関数仕様

### 正規化チェック

```typescript
function isNormalized(arrangement: number[], courtsCount: number): boolean;
```

- 配列が正規化ルールに従っているかを判定
- 2面8人の場合: `[p1,p2,p3,p4, p5,p6,p7,p8]` 形式
  - ペア内: `p1<p2`, `p3<p4`, `p5<p6`, `p7<p8`
  - 対戦ペア間: `min(p1,p2) < min(p3,p4)`, `min(p5,p6) < min(p7,p8)`
  - コート間: `min(p1,p2,p3,p4) < min(p5,p6,p7,p8)`

### 評価関数

```typescript
function evaluate(
  rounds: Round[],
  playersCount: number,
  weights: { w1: number; w2: number; w3: number },
): { pairStdDev: number; oppoStdDev: number; restStdDev: number; totalScore: number };
```

### スケジュール生成

```typescript
function generateSchedule(courtsCount: number, playersCount: number, roundsCount: number): Schedule;
```

---

## UI要件

### 入力フォーム

- コート数: 1-4（デフォルト: 2）
- 参加人数: 4-16（デフォルト: 8、コート数×4以上）
- ラウンド数: 1-10（デフォルト: 7）
- 重み w1, w2, w3: スライダーで調整可能

### 対戦表表示

- MUI Table を使用
- ラウンドごとに行、コートごとに列
- 形式: `1,2 : 3,4`（ペアA : ペアB）

### 評価情報

- ペア回数の標準偏差
- 対戦回数の標準偏差
- 休憩回数の標準偏差
- 総合評価スコア
- 理想解（totalScore=0）かどうかの表示

### 統計表示（オプション）

- 各プレイヤーのペア回数行列
- 各プレイヤーの対戦回数行列

---

## 制限事項・注意点

1. **逐次決定法の特性**: ランダム性に基づくため実行ごとに結果が異なる。大域最適解を保証しない

---
