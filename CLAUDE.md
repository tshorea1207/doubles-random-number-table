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
ev = ev_pair_counts * W1 + ev_oppo_counts * W2
```

| 評価項目 | 説明 | 計算方法 |
|---------|------|---------|
| `ev_pair_counts` | ペア回数の偏り | `pair_counts[p1][p2]` の標準偏差 |
| `ev_oppo_counts` | 対戦回数の偏り | `oppo_counts[p1][p2]` の標準偏差 |
| `W1`, `W2` | 重み係数 | W1 > W2 > 0（ペアの公平性を優先） |

- `pair_counts[p1][p2]`: プレイヤーp1とp2がペアを組んだ回数
- `oppo_counts[p1][p2]`: プレイヤーp1とp2が対戦した回数

### 組み合わせの正規化

探索空間を削減するため、以下の正規化ルールを適用する：

1. **ペア内の順序**: 常に `p1 < p2` となるよう昇順化
2. **対戦ペア間の順序**: 各ペアの最小プレイヤー番号で昇順にソート
3. **コート間の順序**: 各コートの最小プレイヤー番号で昇順にソート

**効果**: 2面8人の場合、40,320通り → 315通りに削減

### 貪欲法に基づく逐次構築法

全探索は計算量的に不可能（7ラウンドで約3×10^17通り）なため、以下の手法を採用：

1. **第1ラウンド固定**: 正規化に基づき一意に決定
   - 例（2面8人）: `(1,2 : 3,4) (5,6 : 7,8)`

2. **逐次的ラウンド最適化**:
   - 各ラウンドで可能な全組み合わせ（315通り）を評価
   - 累積の目的関数が最小となる組み合わせを選択
   - 次のラウンドへ進む

3. **計算量**: `315通り × (R-1)ラウンド` = 2面8人7ラウンドで約1,890回の評価

### next_permutation アルゴリズム

```typescript
function nextPermutation(arr: number[]): boolean {
  // 1. 右から a[k] < a[k+1] となる最大のk を探す
  let k = arr.length - 2;
  while (k >= 0 && arr[k] >= arr[k + 1]) {
    k--;
  }
  
  // 2. kが見つからない場合は最後の順列
  if (k < 0) {
    arr.reverse();
    return false;
  }
  
  // 3. 右から a[k] < a[l] となる最大のl を探す
  let l = arr.length - 1;
  while (arr[k] >= arr[l]) {
    l--;
  }
  
  // 4. a[k] と a[l] を交換
  [arr[k], arr[l]] = [arr[l], arr[k]];
  
  // 5. k+1 以降を反転
  reverseSubarray(arr, k + 1, arr.length - 1);
  return true;
}
```

---

## データ構造

### 型定義

```typescript
// ペア（2人のプレイヤー）
interface Pair {
  player1: number;  // 常に player1 < player2
  player2: number;
}

// 1コートの対戦（2ペア）
interface Match {
  pairA: Pair;  // 常に min(pairA) < min(pairB)
  pairB: Pair;
}

// 1ラウンドの全コート
interface Round {
  roundNumber: number;
  matches: Match[];  // コート番号順（最小プレイヤー番号でソート済み）
}

// 対戦表全体
interface Schedule {
  courts: number;
  players: number;
  rounds: Round[];
  evaluation: {
    pairStdDev: number;
    oppoStdDev: number;
    totalScore: number;
  };
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
function isNormalized(arrangement: number[], courtsCount: number): boolean
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
  weights: { w1: number; w2: number }
): { pairStdDev: number; oppoStdDev: number; totalScore: number }
```

### スケジュール生成

```typescript
function generateSchedule(
  courtsCount: number,
  playersCount: number,
  roundsCount: number
): Schedule
```

---

## UI要件

### 入力フォーム
- コート数: 1-4（デフォルト: 2）
- 参加人数: 4-16（デフォルト: 8、コート数×4以上）
- ラウンド数: 1-10（デフォルト: 7）
- 重み W1, W2: スライダーで調整可能

### 対戦表表示
- MUI Table を使用
- ラウンドごとに行、コートごとに列
- 形式: `1,2 : 3,4`（ペアA : ペアB）

### 評価情報
- ペア回数の標準偏差
- 対戦回数の標準偏差
- 総合評価スコア
- 理想解（ev=0）かどうかの表示

### 統計表示（オプション）
- 各プレイヤーのペア回数行列
- 各プレイヤーの対戦回数行列

---

## 制限事項・注意点

1. **2面コート推奨**: 3面以上は計算時間が大幅に増加
2. **貪欲法の限界**: 大域最適解を保証しない（局所最適解）
3. **正規化による重複排除**: 同一組み合わせの重複評価を防止

---

## 参考

- [サークルテニス ダブルス組み合わせ最適化 - Qiita](https://qiita.com/vivisuke2025/items/15a5d9af31e59b883482)
