# マッチングアルゴリズム設計ドキュメント

## 1. 概要

テニスダブルスのスケジュールを生成するアルゴリズム。コート数・参加人数・ラウンド数を入力とし、各ラウンドの対戦組み合わせと休憩者を出力する。

### 問題定義

- **入力**: コート数 C、参加人数 N、ラウンド数 R
- **出力**: R ラウンド分の対戦表（各コートに 4 人、2 vs 2 のダブルス）
- **余り人数**: `N - C×4` 人が各ラウンド休憩

### 全体フロー

```
generateScheduleAsync(params)
  │
  ├─ ラウンド 1: createFirstRound()      … 固定配置（昇順に詰める）
  │
  └─ ラウンド 2〜R: generateRound()      … 1ラウンドを3フェーズで生成
       │
       ├─ 休憩者決定: selectRestingPlayers()
       │
       ├─ Phase 1   : tryAssignCourtWithBacktracking()   ×100 retry
       │               ペア制約 & 対戦制約 ハード
       │
       ├─ Phase 1.5 : tryAssignCourtOpponentOnly()       ×100 retry
       │               対戦制約 ハード（ペア制約緩和）
       │
       └─ Phase 2   : assignCourtWithScoring()           ×100 retry
                       スコアリング（常に成功）
```

---

## 2. データ構造

```typescript
// 常に player1 < player2（正規化済み）
interface FixedPair { player1: number; player2: number; }

// 常に player1 < player2（正規化済み）
interface Pair     { player1: number; player2: number; }

// 常に min(pairA) < min(pairB)（正規化済み）
interface Match    { pairA: Pair; pairB: Pair; }

interface Round {
  roundNumber: number;
  matches: Match[];          // コートごとに 1 試合
  restingPlayers: number[];  // 昇順ソート済み
}

interface Evaluation {
  pairStdDev: number;   // ペア回数の標準偏差
  oppoStdDev: number;   // 対戦回数の標準偏差
  restStdDev: number;   // 休憩回数の標準偏差
  totalScore: number;   // pairStdDev*w1 + oppoStdDev*w2 + restStdDev*w3
}

interface Schedule {
  courts: number;
  players: number;            // 最大プレイヤー番号（行列サイズ用）
  rounds: Round[];
  evaluation: Evaluation;
  fixedPairs: FixedPair[];
  activePlayers: number[];    // ソート済み
}

interface ScheduleParams {
  courtsCount: number;
  playersCount: number;
  roundsCount: number;
  weights: { w1: number; w2: number; w3: number };
  fixedPairs: FixedPair[];
}

// プレイヤー i と j の回数 = matrix[i-1][j-1]（対称行列）
type CountMatrix = number[][];
type RestCounts  = number[];   // restCounts[i] = プレイヤー i+1 の休憩回数
```

### CumulativeState（増分評価用）

```typescript
interface CumulativeState {
  pairCounts: CountMatrix;
  oppoCounts: CountMatrix;
  restCounts: RestCounts;
  pairSum: number;    // 上三角要素の合計
  pairSumSq: number;  // 上三角要素の二乗和
  pairN: number;      // N*(N-1)/2
  oppoSum: number;    oppoSumSq: number;  oppoN: number;
  restSum: number;    restSumSq: number;  restN: number;
  pairMax: number;    // ペア回数の最大値（辞書式評価用）
}
```

`commitRoundToState()` でラウンドを追加するたびに差分のみ更新する。
値が v → v+1 になるとき `sumSq += 2v + 1` という恒等式を利用して O(courts) を維持。

---

## 3. 正規化

探索空間を削減するため、以下 3 ルールを全配置に適用する。

| ルール | 条件 | 違反例 |
|--------|------|--------|
| 1. ペア内 | `player1 < player2` | `[2,1,3,4]` |
| 2. 同コート内のペア間 | `min(pairA) < min(pairB)` | `[3,4,1,2]` |
| 3. コート間 | `min(court[i]) < min(court[i+1])` | `[5,6,7,8, 1,2,3,4]` |

**削減効果**: 2 コート 8 人の場合 `8! = 40,320` 通り → **315 通り**（約 1/128）

実装: `isNormalized(arrangement, courtsCount)` — 計算量 O(C)

実際の適用箇所: `buildNormalizedMatches()` でコート割り当て後に正規化を適用。

---

## 4. スケジュール生成フロー

### 4.1 ラウンド 1（固定配置）

```typescript
// 昇順のプレイヤー番号を先頭から詰める
// 例: 8 人 2 コート → (1,2 : 3,4) (5,6 : 7,8)
createFirstRound(allPlayers, courtsCount)
```

余りが出る場合（N > C×4）: 末尾のプレイヤーが休憩。

### 4.2 ラウンド 2 以降（`generateRound`）

3 フェーズを順に試み、成功したフェーズで結果を確定する。

#### Phase 1: ペア制約 + 対戦制約ハード（最大 100 retry）

`tryAssignCourtWithBacktracking(available, pairHistory, opponentHistory)` — DFS バックトラック

```
p1 を選択
  └─ p2 を選択（pairHistory[p1][p2] === 0）
       └─ p3 を選択（opponentHistory[p1][p3] === 0 かつ [p2][p3] === 0）
            └─ p4 を選択（対戦制約 + pairHistory[p3][p4] === 0）
                 → 成功: available から 4 人を除去して返す
```

`p4` 候補がなければ `p3` を変更、`p3` 候補がなければ `p2` を変更… と系統的に遡る。
全候補を試して失敗した場合は `null` を返し、外側のループが再シャッフルして retry。

#### Phase 1.5: 対戦制約のみハード（最大 100 retry）

`tryAssignCourtOpponentOnly(available, pairHistory, opponentHistory)` — ペア制約を緩和

- `p2` 選択時にペア制約なし（ペア回数昇順でソフト優先）
- `p4` 選択時もペア制約なし（p3 とのペア回数が最小のものを選択）
- 対戦制約は `p3`, `p4` ともハードに維持

Phase 1 が全 retry 失敗したとき（プレイヤー数に対しラウンド数が多い後半）に使用。

#### Phase 2: スコアリングフォールバック（最大 100 retry、常に成功）

`assignCourtWithScoring(available, pairHistory, opponentHistory, previousOpponents)` — 制約違反を許容してスコアで選択

```
p1 = ランダム選択
p2 = pairHistory[p1][p] が最小の p
p3 = opponentHistory[p1][p] + opponentHistory[p2][p] + 連続対戦ペナルティ が最小の p
p4 = 同上 + pairHistory[p3][p] が最小の p
```

100 回試行して `quickEvaluate()` スコアが最小の組み合わせを採用する。

```typescript
// quickEvaluate のスコア式
score = pairMax * 100 + oppoMax * 100
      + Σ(pairHistory + opponentHistory)
      + 連続対戦数 * 100
```

---

## 5. 休憩者決定ロジック

`selectRestingPlayers(allPlayers, restCount, restCounts, previousResting, fixedPairs)`

### 5.1 基本選択（固定ペアなし）

休憩回数が少ない順にソートし、先頭 `restCount` 人を選択。
同じ休憩回数なら前ラウンド休憩者を後ろに回し（連続休憩回避）、それでも同じならランダム。

### 5.2 固定ペアあり（アトミック単位選択）

固定ペアをペア丸ごと（2 枠）、ソロを 1 枠として扱い、スコアを比較して貪欲法で選択。

```
ペアのスコア = restCounts[p1] + restCounts[p2] + 前回休憩ペナルティ + random * 0.1
ソロのスコア = restCounts[p] * 2             + 前回休憩ペナルティ + random * 0.1
```

`restCount` 枠を満たせない場合（奇数 restCount + 全員固定ペアなど）は固定ペア制約を無視してフォールバック。

### 5.3 連続休憩回避の無効化条件

`restCount >= allPlayers.length / 2` の場合、連続休憩フィルタを**無効化**する。
（過半数が休憩するケースでは連続回避が数学的に不可能 → グループ分離を防ぐため）

---

## 6. 評価関数

### 6.1 スコア計算式

```
totalScore = pairStdDev * w1 + oppoStdDev * w2 + restStdDev * w3
```

| 項目 | 計算対象 |
|------|----------|
| `pairStdDev` | `pairCounts` 上三角要素の標準偏差 |
| `oppoStdDev` | `oppoCounts` 上三角要素の標準偏差 |
| `restStdDev` | `restCounts` 配列の標準偏差 |

標準偏差の計算式:
```
stddev = sqrt(Σ(v - mean)² / n)
       = sqrt(sumSq/n - (sum/n)²)   ← 増分評価用の等価形式
```

推奨重み: `{ w1: 1.0, w2: 0.5, w3: 2.0 }` — 休憩の公平性はユーザー満足度に直結するため w3 を高めに設定。

### 6.2 増分評価（`evaluateCandidate`）

全 Round を再集計せずに O(C) で候補スコアを計算する。

```
候補スコア = candidatePairMax * 1000 + totalScore
```

`PAIR_MAX_PENALTY = 1000` は `totalScore` の最大値（≒30 程度）を十分上回る定数。
この辞書式順序評価により、ペア最大回数の最小化が最優先となる。

### 6.3 関数一覧（`src/utils/evaluation.ts`）

| 関数 | 計算量 | 用途 |
|------|--------|------|
| `evaluate(rounds, playersCount, weights)` | O(R×C + N²) | 全ラウンドを一括評価 |
| `createCumulativeState(playersCount)` | O(N²) | 累積状態を初期化 |
| `commitRoundToState(state, round)` | O(C) | ラウンドを累積状態に追加 |
| `evaluateCandidate(state, template, ...)` | O(C) | 候補スコアを増分計算 |
| `evaluateFromState(state, weights)` | O(1) | 累積状態から Evaluation を生成 |
| `buildCumulativeStateForActivePlayers(...)` | O(R×C + N²) | 再生成時のアクティブプレイヤー限定状態構築 |

---

## 7. 特殊制約

### 7.1 固定ペア（FixedPair）

**定義**: 常に同じペアを組む 2 人。不変条件 `player1 < player2`。

**適用箇所**:

| 場所 | 処理 |
|------|------|
| 休憩者決定 | `splitsAnyFixedPair()` — 固定ペアの片方だけが休憩する候補を除外 |
| Phase 1 バックトラック | `tryAssignCourtWithBacktrackingFixedPairs()` — 固定ペアを p1,p2 として優先使用 |
| Phase 1.5 | `tryAssignCourtOpponentOnlyFixedPairs()` — 同上 |
| Phase 2 スコアリング | `assignCourtWithScoringFixedPairs()` — 固定ペアをアトミックに選択 |

固定ペア処理の優先順序（Phase 1/1.5/2 共通）:
1. Step A: 固定ペア vs 固定ペアのマッチングを試みる
2. Step B: 固定ペア vs 個別プレイヤーにフォールバック
3. フォールバック: 全員が固定ペアでない場合は通常ロジックを使用

**バリデーション** (`validateFixedPairs`):
- 同一プレイヤーが複数のペアに含まれていないか
- プレイヤー番号が有効範囲内か

### 7.2 連続対戦回避ペナルティ

```typescript
const CONSECUTIVE_OPPONENT_PENALTY = 100;
// 前ラウンドで対戦した相手と再び対戦する場合にスコアに加算
```

`extractPreviousOpponents(round)` で前ラウンドの対戦相手マップを構築し、
各フェーズのスコアリングで参照する。

### 7.3 ペア回数最大値（pairMax）優先

Phase 2 の評価では totalScore だけでなく `pairMax` を最優先にする辞書式順序を採用:

```
finalScore = pairMax * 1000 + oppoMax * 100 + Σcounts + 連続対戦ペナルティ
```

これにより、1 組のペアだけが突出して多く組まされる状況を防ぐ。

---

## 8. 非同期実行

### アーキテクチャ

```
useScheduleGenerator(strategyId)
  ├─ generate(params)    → generateScheduleAsync(params, callbacks, signal)
  └─ regenerate(params)  → generateRemainingScheduleAsync(params, callbacks, signal)
```

### キャンセル

`AbortController` を使用。`signal.aborted` をラウンドごとにチェックし、
キャンセル時は `DOMException("AbortError")` をスローする。
前回の生成が実行中に新しい生成を開始した場合、前回を自動的に中断する。

### 進捗コールバック

```typescript
interface ProgressCallbacks {
  onProgress(p: GenerationProgress): void;
  // currentRound / totalRounds / percentage (0-100)
  onRoundComplete?(confirmedRounds: Round[], roundNumber: number): void;
  // ラウンド確定のたびに中間結果を UI へ渡す
}
```

各ラウンド完了後に `await new Promise(resolve => setTimeout(resolve, 0))` で
UI スレッドに制御を返し、進捗表示が更新されるようにする。

### 参加者変更後の再生成（`generateRemainingScheduleAsync`）

消化済みラウンドの履歴（ペア・対戦・休憩回数）を再構築し、
アクティブプレイヤーのみを対象に残りラウンドを生成する。
最終評価も `buildCumulativeStateForActivePlayers()` でアクティブプレイヤー限定で算出。

---

## 9. 性能特性

| 指標 | 値 |
|------|----|
| 全体計算量 | O(R × C × N) — ラウンド数 × コート数 × 人数 |
| 増分評価 | O(C) / ラウンド（全再集計は O(R×C+N²)） |
| 正規化削減率 | 2C8P: 40,320 → 315（約 1/128） |
| Phase 1 最大 retry | 100 回 |
| Phase 1.5 最大 retry | 100 回 |
| Phase 2 最大 retry | 100 回（常に成功） |

Phase 1 が失敗する典型ケース: ラウンド数が多く、全対戦組み合わせが使い尽くされた後半。
この場合 Phase 1.5 → Phase 2 と自動的に降格する。

---

## 10. ファイルマップ

| ファイル | 担当 |
|----------|------|
| `src/types/schedule.ts` | 全型定義（FixedPair, Round, Schedule, CumulativeState, etc.） |
| `src/utils/normalization.ts` | `isNormalized()`, `arrangementToRoundWithRest()` |
| `src/utils/evaluation.ts` | `evaluate()`, `evaluateCandidate()`, `commitRoundToState()`, `createCumulativeState()` |
| `src/utils/permutation.ts` | `nextPermutation()`, `generateCombinations()`, `generateRestingCandidates()` |
| `src/utils/statistics.ts` | `calculateStandardDeviation()`, `extractUpperTriangleValues()` |
| `src/utils/fixedPairs.ts` | `splitsAnyFixedPair()`, `satisfiesFixedPairs()`, `validateFixedPairs()` |
| `src/strategies/sequential-decision/index.ts` | `SequentialDecisionStrategy` — 3 フェーズ生成の主ロジック |
| `src/strategies/sequential-decision/sequentialUtils.ts` | `tryAssignCourtWithBacktracking()`, `assignCourtWithScoring()`, `selectRestingPlayers()` など各フェーズの実装 |
| `src/hooks/useScheduleGenerator.ts` | React フック — 非同期実行・キャンセル・状態管理 |
| `src/hooks/useBenchmarkCalibration.ts` | ハードウェア性能計測・時間推定係数のキャリブレーション |
