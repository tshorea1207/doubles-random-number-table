/**
 * スケジュール生成の統合ベンチマーク
 */

import { bench, describe } from "vitest";
import { generateSchedule } from "../../hooks/useScheduleGenerator";
import type { ScheduleParams } from "../../types/schedule";
import { DEFAULT_WEIGHTS, BENCHMARK_SCENARIOS } from "../helpers/fixtures";

describe("generateSchedule - 基準シナリオ", () => {
  bench("1コート 4人 5ラウンド（最小構成）", () => {
    const params: ScheduleParams = {
      courtsCount: BENCHMARK_SCENARIOS.small.courts,
      playersCount: BENCHMARK_SCENARIOS.small.players,
      roundsCount: BENCHMARK_SCENARIOS.small.rounds,
      weights: DEFAULT_WEIGHTS,
      fixedPairs: [],
    };
    generateSchedule(params);
  });

  bench(
    "2コート 8人 7ラウンド（標準構成）",
    () => {
      const params: ScheduleParams = {
        courtsCount: BENCHMARK_SCENARIOS.medium.courts,
        playersCount: BENCHMARK_SCENARIOS.medium.players,
        roundsCount: BENCHMARK_SCENARIOS.medium.rounds,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { iterations: 10 },
  );
});

describe("generateSchedule - 休憩あり", () => {
  bench(
    "2コート 9人 7ラウンド（1人休憩）",
    () => {
      const params: ScheduleParams = {
        courtsCount: 2,
        playersCount: 9,
        roundsCount: 7,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { time: 3000, iterations: 2 },
  );

  bench(
    "2コート 10人 7ラウンド（2人休憩）",
    () => {
      const params: ScheduleParams = {
        courtsCount: BENCHMARK_SCENARIOS.mediumWithRest.courts,
        playersCount: BENCHMARK_SCENARIOS.mediumWithRest.players,
        roundsCount: BENCHMARK_SCENARIOS.mediumWithRest.rounds,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { time: 3000, iterations: 2 },
  );

  bench(
    "1コート 6人 5ラウンド（2人休憩）",
    () => {
      const params: ScheduleParams = {
        courtsCount: 1,
        playersCount: 6,
        roundsCount: 5,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { iterations: 10 },
  );
});

describe("generateSchedule - 大規模", () => {
  bench(
    "3コート 12人 5ラウンド",
    () => {
      const params: ScheduleParams = {
        courtsCount: BENCHMARK_SCENARIOS.large.courts,
        playersCount: BENCHMARK_SCENARIOS.large.players,
        roundsCount: BENCHMARK_SCENARIOS.large.rounds,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { time: 5000, iterations: 1 },
  );

  bench(
    "2コート 8人 10ラウンド（長時間）",
    () => {
      const params: ScheduleParams = {
        courtsCount: 2,
        playersCount: 8,
        roundsCount: 10,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [],
      };
      generateSchedule(params);
    },
    { time: 2000, iterations: 3 },
  );
});

describe("generateSchedule - 固定ペアあり", () => {
  bench(
    "2コート 8人 7ラウンド 1固定ペア",
    () => {
      const params: ScheduleParams = {
        courtsCount: 2,
        playersCount: 8,
        roundsCount: 7,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [{ player1: 1, player2: 2 }],
      };
      generateSchedule(params);
    },
    { iterations: 10 },
  );

  bench(
    "2コート 8人 7ラウンド 2固定ペア",
    () => {
      const params: ScheduleParams = {
        courtsCount: 2,
        playersCount: 8,
        roundsCount: 7,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [
          { player1: 1, player2: 2 },
          { player1: 3, player2: 4 },
        ],
      };
      generateSchedule(params);
    },
    { iterations: 10 },
  );

  bench(
    "2コート 10人 7ラウンド 1固定ペア",
    () => {
      const params: ScheduleParams = {
        courtsCount: 2,
        playersCount: 10,
        roundsCount: 7,
        weights: DEFAULT_WEIGHTS,
        fixedPairs: [{ player1: 1, player2: 2 }],
      };
      generateSchedule(params);
    },
    { time: 3000, iterations: 2 },
  );
});

describe("generateSchedule - 重み調整", () => {
  const baseParams = {
    courtsCount: 2,
    playersCount: 8,
    roundsCount: 7,
    fixedPairs: [],
  };

  bench(
    "デフォルト重み (w1:1.0, w2:0.5, w3:2.0)",
    () => {
      generateSchedule({
        ...baseParams,
        weights: { w1: 1.0, w2: 0.5, w3: 2.0 },
      });
    },
    { iterations: 10 },
  );

  bench(
    "ペア重視 (w1:2.0, w2:0.5, w3:1.0)",
    () => {
      generateSchedule({
        ...baseParams,
        weights: { w1: 2.0, w2: 0.5, w3: 1.0 },
      });
    },
    { iterations: 10 },
  );

  bench(
    "休憩重視 (w1:0.5, w2:0.5, w3:3.0)",
    () => {
      generateSchedule({
        ...baseParams,
        weights: { w1: 0.5, w2: 0.5, w3: 3.0 },
      });
    },
    { iterations: 10 },
  );

  bench(
    "対戦重視 (w1:0.5, w2:2.0, w3:1.0)",
    () => {
      generateSchedule({
        ...baseParams,
        weights: { w1: 0.5, w2: 2.0, w3: 1.0 },
      });
    },
    { iterations: 10 },
  );
});

describe("generateSchedule - ラウンド数の影響", () => {
  bench("2コート 8人 3ラウンド", () => {
    generateSchedule({
      courtsCount: 2,
      playersCount: 8,
      roundsCount: 3,
      weights: DEFAULT_WEIGHTS,
      fixedPairs: [],
    });
  });

  bench("2コート 8人 5ラウンド", () => {
    generateSchedule({
      courtsCount: 2,
      playersCount: 8,
      roundsCount: 5,
      weights: DEFAULT_WEIGHTS,
      fixedPairs: [],
    });
  });

  bench("2コート 8人 7ラウンド", () => {
    generateSchedule({
      courtsCount: 2,
      playersCount: 8,
      roundsCount: 7,
      weights: DEFAULT_WEIGHTS,
      fixedPairs: [],
    });
  });
});
