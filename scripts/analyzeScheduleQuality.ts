/**
 * マッチングアルゴリズム 品質レポートスクリプト
 *
 * 実行方法:
 *   npm run analyze
 *   npx vitest run scripts/analyzeScheduleQuality.ts
 *
 * 評価観点（優先度順）:
 *   1. ペア重複:     新規ペア候補がいるのに既ペアを再度組んだ回数
 *   2. 対戦重複:     未対戦者がいるのに既対戦者と再対戦になった回数
 *   3. 不公平休憩:   休憩が少ない人がいるのに自分が休憩になった回数
 *   4. 前R対戦→今Rペア: 前ラウンド対戦相手が今ラウンドのパートナーになった回数
 *   5. 前Rペア→今R対戦: 前ラウンドのペアが今ラウンドの対戦相手になった回数
 */

import { describe, it } from "vitest";
import { generateSchedule } from "../src/hooks/useScheduleGenerator";
import {
  initializeCountMatrix,
  updateCountMatrices,
  initializeRestCounts,
  updateRestCounts,
  extractPreviousOpponents,
} from "../src/utils/evaluation";
import type { Round, Schedule, Evaluation } from "../src/types/schedule";

// ─── 定数 ────────────────────────────────────────────────────

const WEIGHTS = { w1: 1.0, w2: 0.5, w3: 2.0 };
const RUNS = 10;

// ─── 型定義 ──────────────────────────────────────────────────

type RoundViolations = {
  c1_pairDuplicates: number;
  c2_oppoDuplicates: number;
  c3_unfairRest: number;
  c4_prevOppoNowPair: number;
  c5_prevPairNowOppo: number;
  hasRest: boolean;
};

type ScheduleAnalysis = {
  roundViolations: RoundViolations[];
  totals: {
    c1: number;
    c2: number;
    c3_cases: number;
    c4: number;
    c5: number;
  };
  evaluation: Evaluation;
};

type Scenario = {
  label: string;
  courtsCount: number;
  playersCount: number;
  roundsCount: number;
};

// ─── ヘルパー ─────────────────────────────────────────────────

/**
 * 前ラウンドのペア関係を Map<player, partner> で返す
 * pairA の player1/player2 の両方向を格納する
 */
function buildPrevPairMap(round: Round): Map<number, number> {
  const map = new Map<number, number>();
  for (const match of round.matches) {
    map.set(match.pairA.player1, match.pairA.player2);
    map.set(match.pairA.player2, match.pairA.player1);
    map.set(match.pairB.player1, match.pairB.player2);
    map.set(match.pairB.player2, match.pairB.player1);
  }
  return map;
}

// ─── メイン分析関数 ───────────────────────────────────────────

/**
 * スケジュールをラウンドごとに分析し、5つの観点の違反回数を集計する
 * カウント更新は違反チェックの「後」に行う（前ラウンドまでの累積で判定するため）
 */
function analyzeScheduleDetailed(schedule: Schedule): ScheduleAnalysis {
  const n = schedule.players;
  const pairCounts = initializeCountMatrix(n);
  const oppoCounts = initializeCountMatrix(n);
  const restCounts = initializeRestCounts(n);
  const allPlayers = schedule.activePlayers;

  const roundViolations: RoundViolations[] = [];
  const totals = { c1: 0, c2: 0, c3_cases: 0, c4: 0, c5: 0 };
  let prevRound: Round | null = null;

  for (const round of schedule.rounds) {
    // ── 観点1: ペア重複 ──────────────────────────────────────
    let c1 = 0;
    for (const match of round.matches) {
      const { pairA, pairB } = match;
      if (pairCounts[pairA.player1 - 1][pairA.player2 - 1] > 0) c1++;
      if (pairCounts[pairB.player1 - 1][pairB.player2 - 1] > 0) c1++;
    }

    // ── 観点2: 対戦重複 ──────────────────────────────────────
    let c2 = 0;
    for (const match of round.matches) {
      const { pairA, pairB } = match;
      const a1 = pairA.player1,
        a2 = pairA.player2;
      const b1 = pairB.player1,
        b2 = pairB.player2;
      // 4組の対戦ペアを個別に確認
      for (const [a, b] of [
        [a1, b1],
        [a1, b2],
        [a2, b1],
        [a2, b2],
      ] as [number, number][]) {
        if (oppoCounts[a - 1][b - 1] > 0) c2++;
      }
    }

    // ── 観点3: 不公平休憩 ─────────────────────────────────────
    let c3 = 0;
    const hasRest = round.restingPlayers.length > 0;
    if (hasRest) {
      const currentRestVals = allPlayers.map((p) => restCounts[p - 1]);
      const minRest = Math.min(...currentRestVals);
      for (const p of round.restingPlayers) {
        if (restCounts[p - 1] > minRest) c3++;
      }
    }

    // ── 観点4: 前R対戦相手が今Rペアに ────────────────────────
    let c4 = 0;
    if (prevRound !== null) {
      const prevOppoMap = extractPreviousOpponents(prevRound);
      for (const match of round.matches) {
        for (const pair of [match.pairA, match.pairB]) {
          if (prevOppoMap.get(pair.player1)?.has(pair.player2)) c4++;
        }
      }
    }

    // ── 観点5: 前Rペアが今R対戦相手に ────────────────────────
    let c5 = 0;
    if (prevRound !== null) {
      const prevPairMap = buildPrevPairMap(prevRound);
      for (const match of round.matches) {
        const { pairA, pairB } = match;
        const playersA = [pairA.player1, pairA.player2];
        const playersB = [pairB.player1, pairB.player2];
        for (const a of playersA) {
          for (const b of playersB) {
            if (prevPairMap.get(a) === b) c5++;
          }
        }
      }
    }

    roundViolations.push({
      c1_pairDuplicates: c1,
      c2_oppoDuplicates: c2,
      c3_unfairRest: c3,
      c4_prevOppoNowPair: c4,
      c5_prevPairNowOppo: c5,
      hasRest,
    });

    totals.c1 += c1;
    totals.c2 += c2;
    totals.c3_cases += c3;
    totals.c4 += c4;
    totals.c5 += c5;

    // カウント更新は違反チェックの後に行う
    updateCountMatrices(round, pairCounts, oppoCounts);
    updateRestCounts(round, restCounts);
    prevRound = round;
  }

  return { roundViolations, totals, evaluation: schedule.evaluation };
}

// ─── シナリオ実行 ─────────────────────────────────────────────

function runScenario(scenario: Scenario, runs: number): ScheduleAnalysis[] {
  return Array.from({ length: runs }, () => {
    const schedule = generateSchedule({
      courtsCount: scenario.courtsCount,
      playersCount: scenario.playersCount,
      roundsCount: scenario.roundsCount,
      weights: WEIGHTS,
      fixedPairs: [],
    });
    return analyzeScheduleDetailed(schedule);
  });
}

// ─── レポート出力 ─────────────────────────────────────────────

function f(v: number): string {
  return v.toFixed(2);
}

function printReport(label: string, analyses: ScheduleAnalysis[]): void {
  const rounds = analyses[0].roundViolations.length;
  const hasRest = analyses[0].roundViolations.some((r) => r.hasRest);
  const runsCount = analyses.length;

  const best = (fn: (a: ScheduleAnalysis) => number): number => Math.min(...analyses.map(fn));
  const worst = (fn: (a: ScheduleAnalysis) => number): number => Math.max(...analyses.map(fn));
  const avg = (fn: (a: ScheduleAnalysis) => number): number => analyses.reduce((s, a) => s + fn(a), 0) / runsCount;

  const SEP = "━".repeat(52);
  const THIN = "─".repeat(52);

  console.log(SEP);
  console.log(`[${label}]  ${runsCount}回実行`);
  console.log(SEP);

  const row = (label: string, b: number, w: number, a: number) =>
    console.log(`${label.padEnd(28)}最良: ${String(b).padStart(3)}  最悪: ${String(w).padStart(3)}  平均: ${f(a)}`);

  row(`(1) ペア重複 [全${rounds}R・発生ペア数]`, best((a) => a.totals.c1), worst((a) => a.totals.c1), avg((a) => a.totals.c1));
  row(`(2) 対戦重複 [全${rounds}R・発生組数]`, best((a) => a.totals.c2), worst((a) => a.totals.c2), avg((a) => a.totals.c2));

  if (hasRest) {
    row(`(3) 不公平休憩 [累計人数]`, best((a) => a.totals.c3_cases), worst((a) => a.totals.c3_cases), avg((a) => a.totals.c3_cases));
  } else {
    console.log(`(3) 不公平休憩                      - (休憩なし)`);
  }

  row(`(4) 前R対戦→今Rペア [全${rounds}R]`, best((a) => a.totals.c4), worst((a) => a.totals.c4), avg((a) => a.totals.c4));
  row(`(5) 前Rペア→今R対戦 [全${rounds}R]`, best((a) => a.totals.c5), worst((a) => a.totals.c5), avg((a) => a.totals.c5));

  // 評価指標
  console.log(THIN);
  console.log(`評価指標 (最良 / 最悪 / 平均)`);
  console.log(
    `    pairStdDev: ${f(best((a) => a.evaluation.pairStdDev))} / ${f(worst((a) => a.evaluation.pairStdDev))} / ${f(avg((a) => a.evaluation.pairStdDev))}`,
  );
  console.log(
    `    oppoStdDev: ${f(best((a) => a.evaluation.oppoStdDev))} / ${f(worst((a) => a.evaluation.oppoStdDev))} / ${f(avg((a) => a.evaluation.oppoStdDev))}`,
  );
  console.log(
    `    restStdDev: ${f(best((a) => a.evaluation.restStdDev))} / ${f(worst((a) => a.evaluation.restStdDev))} / ${f(avg((a) => a.evaluation.restStdDev))}`,
  );
  console.log(
    `    totalScore: ${f(best((a) => a.evaluation.totalScore))} / ${f(worst((a) => a.evaluation.totalScore))} / ${f(avg((a) => a.evaluation.totalScore))}`,
  );
  console.log("");
}

// ─── シナリオ定義 ─────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  { label: "4人1コート 3R（理想解）", courtsCount: 1, playersCount: 4, roundsCount: 3 },
  { label: "4人1コート 5R", courtsCount: 1, playersCount: 4, roundsCount: 5 },
  { label: "8人2コート 7R（標準）", courtsCount: 2, playersCount: 8, roundsCount: 7 },
  { label: "10人2コート 7R（休憩あり）", courtsCount: 2, playersCount: 10, roundsCount: 7 },
  { label: "12人3コート 5R（大規模）", courtsCount: 3, playersCount: 12, roundsCount: 5 },
];

// ─── vitest エントリポイント ──────────────────────────────────

describe("マッチング品質レポート", () => {
  it("全シナリオのレポートを出力", () => {
    console.log("\n=== マッチングアルゴリズム 品質レポート ===\n");
    for (const s of SCENARIOS) {
      const analyses = runScenario(s, RUNS);
      printReport(s.label, analyses);
    }
  });
});
