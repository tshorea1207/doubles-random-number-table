# 生成処理の高速化 - 実装計画

## 実装状況

| # | 最適化項目 | 優先度 | 期待効果 | 状況 |
|---|-----------|--------|---------|------|
| 1 | 正規化配置の事前生成 | 最優先 | 〜60%高速化 | ✅ 実装済み |
| 2 | 増分評価 | 高 | 〜80%高速化（累積） | ⬜ 未実装 |
| 3 | 配列コピーの削減 | 中 | 〜85%高速化（累積） | ⬜ 未実装 |
| 4 | 早期終了/枝刈り | 低 | 〜88%高速化（累積） | ⬜ 未実装 |
| 5 | Web Worker並列化 | オプション | 〜92%高速化（累積） | ⬜ 未実装 |
| - | 性能検証用テストコード | - | 検証用 | ⬜ 未実装 |

**凡例**: ✅ 実装済み / 🚧 作業中 / ⬜ 未実装

---

## 概要

スケジュール生成アルゴリズムの高速化を行う。現在の実装では2コート8人7ラウンドで約500ms〜1秒かかる処理を、50〜100msに短縮することを目標とする。

## 現状分析

### ボトルネック1: 全順列の反復 (最大のボトルネック)
**場所**: [useScheduleGenerator.ts:171-201](src/hooks/useScheduleGenerator.ts#L171-L201)

```typescript
do {
  if (isNormalized(arrangement, courtsCount) && satisfiesFixedPairs(...)) {
    // 評価処理
  }
} while (nextPermutation(arrangement));
```

- 8人の場合: 40,320回の反復で315個の有効配置を発見（99.2%が無駄）
- `nextPermutation` + `isNormalized`のチェックが毎回発生

### ボトルネック2: 評価関数の冗長計算
**場所**: [evaluation.ts:94-119](src/utils/evaluation.ts#L94-L119)

- 各評価で2つのN×N行列を新規作成
- 累積された全ラウンドを毎回再処理
- ラウンド7では315候補 × 6ラウンド分の反復 = 1,890回のラウンド処理

### ボトルネック3: 配列コピー
**場所**: [useScheduleGenerator.ts:179-186](src/hooks/useScheduleGenerator.ts#L179-L186)

- 毎回`arrangement.slice()`で配列コピー
- 毎回`[...currentRounds, candidateRound]`で配列展開

---

## 最適化計画

### 最適化1: 正規化配置の事前生成 (最優先・ROI最高)

**効果**: 40,320回 → 315回の反復に削減（128倍高速化）

**実装内容**:
1. 新規ファイル `src/utils/normalizedArrangements.ts` を作成
2. 直接構築アルゴリズムで正規化配置を生成（順列フィルタリングではなく）
3. 設定ごとにキャッシュ（Map使用）

**アルゴリズム**:
```typescript
// 再帰的に正規化制約を満たす配置のみを構築
function generateNormalizedRecursive(
  available: number[],      // 未使用プレイヤー
  remainingCourts: number,  // 残りコート数
  current: number[],        // 構築中の配置
  minFirstPlayer: number,   // コート順序制約
  results: number[][]       // 結果格納
): void
```

**修正ファイル**:
- 新規: `src/utils/normalizedArrangements.ts`
- 修正: `src/hooks/useScheduleGenerator.ts` - `findBestNextRoundAsync`を配置リスト反復に変更

---

### 最適化2: 増分評価 (高優先・ROI高)

**効果**: 評価コストをO(rounds × courts)からO(courts)に削減

**実装内容**:
1. `CumulativeState`型を追加（累積カウント行列 + 統計用の和・二乗和）
2. ラウンド追加時は差分のみ計算
3. Welford's algorithmで増分標準偏差を計算

**データ構造**:
```typescript
interface CumulativeState {
  pairCounts: CountMatrix;   // 累積ペア回数行列
  oppoCounts: CountMatrix;   // 累積対戦回数行列
  pairSum: number;           // Σ(pair_count)
  pairSumSq: number;         // Σ(pair_count²)
  oppoSum: number;           // Σ(oppo_count)
  oppoSumSq: number;         // Σ(oppo_count²)
}
```

**修正ファイル**:
- 修正: `src/types/schedule.ts` - `CumulativeState`型追加
- 修正: `src/utils/evaluation.ts` - 増分評価関数追加
- 修正: `src/hooks/useScheduleGenerator.ts` - 累積状態の維持

---

### 最適化3: 配列コピーの削減 (中優先・低コスト)

**効果**: 315回 → 1回のコピーに削減

**現在の問題** ([useScheduleGenerator.ts:256-264](src/hooks/useScheduleGenerator.ts#L256-L264)):
```typescript
// 毎評価でコピー発生
const candidateRound = arrangementToRoundWithRest(arrangement.slice(), ...);
const candidateRounds = [...currentRounds, candidateRound];
```

**実装内容**:
1. 評価時はRoundオブジェクトを作成せず、配列から直接スコア計算
2. 最良候補が見つかった時のみ配列をコピー
3. ループ終了後に1回だけRoundオブジェクトを作成

**修正後のコード**:
```typescript
let bestArrangement: number[] | null = null;
let bestRestingPlayers: number[] | null = null;

do {
  if (isNormalized(...) && satisfiesFixedPairs(...)) {
    // Roundオブジェクトを作らず直接評価
    const score = evaluateArrangementDirect(
      arrangement,        // コピーなし
      restingPlayers,
      cumulativeState,    // 最適化2と併用
      weights
    );

    if (score < bestScore) {
      bestScore = score;
      bestArrangement = arrangement.slice();  // 最良時のみコピー
      bestRestingPlayers = [...restingPlayers];
    }
  }
} while (nextPermutation(arrangement));

// 最後に1回だけRoundオブジェクトを作成
return arrangementToRoundWithRest(bestArrangement!, courtsCount, roundNumber, bestRestingPlayers!);
```

**修正ファイル**:
- 修正: `src/hooks/useScheduleGenerator.ts` - `findBestNextRoundAsync`のループ構造変更
- 修正: `src/utils/evaluation.ts` - 配列から直接評価する関数追加

---

### 最適化4: 早期終了/枝刈り (低優先・低コスト)

**効果**: 約30-50%の評価をスキップ

**実装内容**:
1. ペアスコア（重みW1）を先に計算
2. `pairScore * W1 >= bestScore`なら対戦・休憩スコア計算をスキップ

**修正ファイル**:
- 修正: `src/hooks/useScheduleGenerator.ts` - 評価ループに条件追加

---

### 最適化5: Web Worker並列化 (オプション・高複雑度)

**効果**: マルチコアCPUで2-3倍の追加高速化

**実装内容**:
1. Vite worker設定
2. 評価ワーカースクリプト作成
3. 作業分散と結果集約

**修正ファイル**:
- 新規: `src/workers/evaluationWorker.ts`
- 修正: `vite.config.ts` - worker設定
- 修正: `src/hooks/useScheduleGenerator.ts` - 並列評価

**注意**: 複雑度が高いため、最適化1-4で十分な性能が得られれば省略可能

---

## 実装順序

| フェーズ | 内容 | 期待効果 |
|---------|------|---------|
| 1 | 正規化配置の事前生成 | 〜60%高速化 |
| 2 | 増分評価 | 〜80%高速化（累積） |
| 3 | 配列コピーの削減 | 〜85%高速化（累積） |
| 4 | 早期終了/枝刈り | 〜88%高速化（累積） |
| 5 | Web Worker (オプション) | 〜92%高速化（累積） |

---

## 修正対象ファイル一覧

| ファイル | 変更内容 |
|---------|---------|
| `src/utils/normalizedArrangements.ts` | 新規作成 - 正規化配置生成・キャッシュ |
| `src/hooks/useScheduleGenerator.ts` | 大幅修正 - 最適化1,2,3,4の適用 |
| `src/utils/evaluation.ts` | 修正 - 増分評価関数・配列直接評価関数追加 |
| `src/types/schedule.ts` | 修正 - CumulativeState型追加 |
| `src/__tests__/performance.test.ts` | 新規作成 - 性能ベンチマークテスト |

---

## 検証方法

1. **機能テスト**: 最適化前後で同じ入力に対して同じスケジュールが生成されることを確認
2. **性能テスト**: 2コート8人7ラウンドの生成時間を計測
   - 目標: 500ms → 50-100ms
3. **回帰テスト**: 既存の固定ペア機能が正常に動作することを確認

---

## 性能検証用テストコード

### 新規作成: `src/__tests__/performance.test.ts`

**目的**: 各最適化フェーズの効果を定量的に測定

**テスト内容**:
```typescript
import { generateSchedule, generateScheduleAsync } from '../hooks/useScheduleGenerator';

describe('Performance Benchmarks', () => {
  // ベースラインパラメータ
  const testCases = [
    { courts: 2, players: 8, rounds: 7, label: '2コート8人7R' },
    { courts: 2, players: 10, rounds: 7, label: '2コート10人7R (休憩あり)' },
    { courts: 3, players: 12, rounds: 7, label: '3コート12人7R' },
  ];

  test.each(testCases)('$label の生成時間を計測', async ({ courts, players, rounds }) => {
    const params = {
      courtsCount: courts,
      playersCount: players,
      roundsCount: rounds,
      weights: { w1: 1.0, w2: 0.5, w3: 2.0 },
      fixedPairs: [],
    };

    const iterations = 5;
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await generateScheduleAsync(params, () => {});
      const end = performance.now();
      times.push(end - start);
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    console.log(`${courts}コート${players}人${rounds}R: avg=${avg.toFixed(1)}ms, min=${min.toFixed(1)}ms, max=${max.toFixed(1)}ms`);

    // 性能目標（調整可能）
    expect(avg).toBeLessThan(500); // 最適化後は100ms未満を目標
  });

  test('最適化前後の結果一致を確認', async () => {
    const params = {
      courtsCount: 2,
      playersCount: 8,
      roundsCount: 7,
      weights: { w1: 1.0, w2: 0.5, w3: 2.0 },
      fixedPairs: [],
    };

    // 同じシードで複数回実行して結果が一致することを確認
    const result1 = await generateScheduleAsync(params, () => {});
    const result2 = await generateScheduleAsync(params, () => {});

    expect(result1.evaluation.totalScore).toBeCloseTo(result2.evaluation.totalScore, 5);
  });
});
```

---

## リスクと対策

| リスク | 対策 |
|-------|------|
| 配置生成の誤り | `isNormalized()`で全配置を検証するユニットテスト |
| 増分計算の精度誤差 | フル計算との比較テスト、イプシロン許容 |
| キャッシュのメモリ使用 | 3コート12人で最大約10,000配置、許容範囲 |
