# UI改善 対応内容一覧

## 概要

モバイル端末（テニスコート）での使用を主な用途とし、レスポンシブ対応・デザイン統一・操作性向上を目的としたUI改善。

---

## 対応内容

| #  | 対応内容                       | 対象ファイル                      | 変更種別 | 説明                                                      |
|----|-------------------------------|----------------------------------|---------|----------------------------------------------------------|
| 1  | カスタムテーマ作成              | `src/theme.ts`                   | 新規    | パレット・タイポグラフィ・コンポーネントデフォルト定義       |
| 2  | ThemeProvider適用              | `src/main.tsx`                   | 変更    | ThemeProviderでアプリ全体をラップ                          |
| 3  | 重みスライダー退避              | `src/components/ScheduleForm.tsx` | 変更    | W1/W2/W3を詳細設定ダイアログに移動                         |
| 4  | 評価結果の折りたたみ            | `src/components/EvaluationDisplay.tsx` | 変更 | Collapseで折りたたみ、総合スコアのみ常時表示               |
| 5  | EvaluationDisplayレスポンシブ   | `src/components/EvaluationDisplay.tsx` | 変更 | CSS Grid 2列/3-4列切替、テーマ色参照                      |
| 6  | 対戦セル色付きバッジ            | `src/components/ScheduleTable.tsx` | 変更   | pairA薄青/pairB薄橙のバッジ表示、"vs"セパレータ           |
| 7  | 対戦表モバイルカード            | `src/components/ScheduleTable.tsx` | 変更   | デスクトップ:テーブル、モバイル:カード形式のデュアル表示    |
| 8  | PlayerChangePanel縦並び         | `src/components/PlayerChangePanel.tsx` | 変更 | モバイルで縦並びレイアウト                                 |
| 9  | PlayerStatsTable sticky列       | `src/components/PlayerStatsTable.tsx` | 変更  | 1列目固定スクロール、セル縮小、横スクロールヒント          |
| 10 | アクセシビリティ改善            | 複数ファイル                      | 変更    | aria-label追加、キーボード操作対応、Tabs aria-label       |
| 11 | レイアウト調整                  | `src/App.tsx`                    | 変更    | Containerのレスポンシブpadding                            |

---

## テーマ設定 (`src/theme.ts`)

| 項目              | 設定値                         |
|-------------------|-------------------------------|
| Primary           | `#1565c0` (テニスコートブルー)  |
| Secondary         | `#2e7d32` (グリーン)           |
| Paper borderRadius| `12px`                         |
| Button borderRadius| `8px`                         |
| teamA色           | `#e3f2fd` (薄青)               |
| teamB色           | `#fff3e0` (薄橙)               |

---

## 備考

- MUI v6 既存APIのみ使用（新規依存パッケージなし）
- Grid コンポーネントの deprecation 警告は既存コードと同様（v6 Grid2への移行は別タスク）
