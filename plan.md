# 連続休憩回避 実装計画

## 概要
同じプレイヤーが連続ラウンドで休憩することを回避する機能を実装する。
ハード制約（フォールバック付き）方式を採用。

## 変更ファイル

### 1. `src/utils/permutation.ts`
- `generateRestingCandidates` に `previousRestingPlayers?: number[]` パラメータ追加
- 前ラウンド休憩者との重複がない候補のみ yield するフィルタリング追加

### 2. `src/strategies/greedy/index.ts`
- `findBestNextRound` / `findBestNextRoundAsync` に `previousRestingPlayers` パラメータ追加
- 2フェーズ探索: Phase 1（連続回避）→ Phase 2（フォールバック）
- `generateSchedule` / `generateScheduleAsync` / `generateRemainingScheduleAsync` で前ラウンド休憩者を追跡・伝搬

### 3. `src/strategies/sequential-decision/index.ts`（存在する場合）
- 同様のロジックを適用

## 変更しないファイル
- 型定義（新しい型不要）
- 評価関数（新しい重み不要）
- UIコンポーネント（トグル不要、常時有効）

## テスト観点
- 連続休憩なし候補が存在する場合：連続休憩が発生しないこと
- 連続休憩なし候補が存在しない場合：フォールバックで正常にスケジュール生成されること
- 休憩者がいない場合（playersCount = courtsCount * 4）：影響なし
- 固定ペアとの組み合わせ：正常に動作すること
- 参加者変更後の再生成：前ラウンドの休憩者を正しく引き継ぐこと
