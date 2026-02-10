# ダブルスマッチング乱数表 - 逐次決定法 実装ガイド

## プロジェクト概要

ダブルステニスのラウンドロビン方式トーナメントにおいて、各ラウンドのコートごとに4人のプレイヤー（ペア2組）を公平に割り当てる乱数表を生成する。

## パラメータ

- N: プレイヤー数
- C: コート数（1ラウンドあたり）
- R: ラウンド数

## アルゴリズム: 逐次決定 + バックトラック + スコアリングフォールバック

ラウンド生成は2フェーズで構成される。Phase 1 で重複ゼロの最適解を探索し、充足不可能な場合は Phase 2 のスコアリングで重複を最小化する。これにより**生成失敗が発生しない**。

### Phase 1: ハード制約 + DFSバックトラック

1コートの4人を以下の制約で系統的に探索する:

```
for p1 in shuffle(available):
  for p2 in available where pairHistory[p1][p2] === 0:
    for p3 in available where opponentHistory[p1][p3] === 0 and opponentHistory[p2][p3] === 0:
      p4Candidates = available where opponentHistory[p1][p4] === 0
                                 and opponentHistory[p2][p4] === 0
                                 and pairHistory[p3][p4] === 0
      if p4Candidates is not empty:
        return [p1, p2, p3, p4]
return null  // ハード制約が充足不可能
```

- p4で詰まったらp3を変更、p3で詰まったらp2を変更…と系統的にバックトラック
- 計算量: 最大 N×(N-1)×(N-2)×(N-3) だが、制約フィルタにより大幅削減
- 8人の場合: 最大 1,680 反復

### Phase 2: スコアリングベースのフォールバック（常に成功）

ハード制約の代わりに、履歴カウントが最小のプレイヤーを優先選択する:

```
p1 ← random(available)
p2 ← argmin over available of pairHistory[p1][p]
p3 ← argmin over available of (opponentHistory[p1][p] + opponentHistory[p2][p])
p4 ← argmin over available of (opponentHistory[p1][p] + opponentHistory[p2][p] + pairHistory[p3][p])
```

- `argmin` のタイブレークはランダム
- 候補が必ず存在するため、常に成功する
- 複数回シャッフルし、`quickEvaluate` で最良候補を選択

#### 制約の定義

- **ペア**: 同じチームとして組んだことがある関係（p1-p2、p3-p4）
- **対戦**: 敵チームとして戦ったことがある関係（p1-p3、p1-p4、p2-p3、p2-p4）
- Phase 1: 「未ペア」「未対戦」（`=== 0`）をハード制約として使用
- Phase 2: カウント最小化をソフト制約として使用

### ラウンド生成フロー

```
for each round r = 1..R:
  restingPlayers ← 休憩回数最少のプレイヤーから選択
  playingPlayers ← allPlayers - restingPlayers

  // === Phase 1: ハード制約 + バックトラック ===
  for retry = 0..MAX_RETRY_HARD(50):
    available ← shuffle(playingPlayers)
    courts = []
    failed = false
    for each court k = 1..C:
      result = tryAssignCourtWithBacktracking(available, history)
      if result == null:
        failed = true
        break
      courts.push(result)
    if not failed:
      return courts  // 重複ゼロの最適解

  // === Phase 2: スコアリングフォールバック ===
  bestScore = Infinity
  bestCourts = null
  for retry = 0..MAX_RETRY_SOFT(50):
    available ← shuffle(playingPlayers)
    courts = []
    for each court k = 1..C:
      result = assignCourtWithScoring(available, history)  // 常に成功
      courts.push(result)
    score = quickEvaluate(courts, history)
    if score < bestScore:
      bestScore = score
      bestCourts = courts
  return bestCourts  // 重複最小化された解
```

### quickEvaluate（軽量評価）

Phase 2 の複数候補を比較するための軽量スコアリング:

```
score = 0
for each [p1, p2, p3, p4] in courtAssignments:
  score += pairHistory[p1][p2] + pairHistory[p3][p4]        // ペアコスト
  score += opponentHistory[p1][p3] + opponentHistory[p1][p4] // 対戦コスト
  score += opponentHistory[p2][p3] + opponentHistory[p2][p4]
return score  // 小さいほど良い
```

## データ構造

### 履歴管理

```typescript
// ペア履歴: pairHistory[i][j] = p_i と p_j がペアを組んだ回数
pairHistory: number[][];

// 対戦履歴: opponentHistory[i][j] = p_i と p_j が対戦した回数
opponentHistory: number[][];
```

- N×N の対称行列として管理する
- Phase 1 では `=== 0` で判定、Phase 2 では `argmin` で使用

### コート割り当て結果

```typescript
interface CourtAssignment {
  team1: [playerId, playerId]; // p1, p2
  team2: [playerId, playerId]; // p3, p4
}

interface RoundResult {
  round: number;
  courts: CourtAssignment[];
  rest: playerId[]; // 休憩プレイヤー（N > 4C の場合）
}
```

## 計算量

- Phase 1 成功時: O(R × C × N⁴)（バックトラック最悪ケース、実際はフィルタで大幅削減）
- Phase 2: O(MAX_RETRY_SOFT × C × N)
- 全体: O(R × (MAX_RETRY_HARD × C × N⁴ + MAX_RETRY_SOFT × C × N))
- N=16, C=4, R=10 程度であれば十分高速（ミリ秒単位）

## 制約と限界

- ラウンド数が増えると Phase 1 のハード制約が充足不可能になり Phase 2 にフォールバックする
- Phase 2 は常に成功するため、**生成失敗は発生しない**
- Phase 2 の品質はラウンド増で緩やかに低下する（重複ペア・対戦が増加）
- バックトラックはコート単位で行い、コート間のバックトラックはラウンド単位リトライで代替

## 実装ファイルと関数一覧

### `src/strategies/sequential-decision/sequentialUtils.ts`

| 関数 | 役割 |
|------|------|
| `tryAssignCourtWithBacktracking` | Phase 1: DFSバックトラック（ハード制約） |
| `tryAssignCourtWithBacktrackingFixedPairs` | Phase 1 固定ペア版 |
| `assignCourtWithScoring` | Phase 2: スコアリング（常に成功） |
| `assignCourtWithScoringFixedPairs` | Phase 2 固定ペア版 |
| `pickMinScore` | スコア最小プレイヤー選択（タイブレークはランダム） |
| `selectRestingPlayers` | 休憩者決定（休憩回数最少優先） |
| `buildNormalizedMatches` | コート割り当て結果の正規化 |
| `shuffle` | Fisher-Yates シャッフル |
| `randomPick` | ランダム選択 |

### `src/strategies/sequential-decision/index.ts`

| メソッド / 定数 | 役割 |
|------|------|
| `MAX_RETRY_HARD = 50` | Phase 1 のリトライ上限 |
| `MAX_RETRY_SOFT = 50` | Phase 2 のリトライ上限 |
| `generateRound()` | 2フェーズ構造のラウンド生成 |
| `quickEvaluate()` | Phase 2 候補の軽量評価 |
| `generateSchedule()` | 同期スケジュール生成 |
| `generateScheduleAsync()` | 非同期スケジュール生成（プログレス付き） |
| `generateRemainingScheduleAsync()` | 途中からの再生成 |
| `createFirstRound()` | ラウンド1の固定配置 |

## 将来の改善候補

- MRVヒューリスティック: 候補が少ないプレイヤーから優先的に割り当てることで、Phase 1 のバックトラック探索木を削減

## 技術スタック

- TypeScript / React
- Material-UI (MUI)