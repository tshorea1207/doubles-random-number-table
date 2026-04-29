import { useState, useMemo } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Tabs,
  Tab,
  Box,
  Typography,
  Chip,
} from '@mui/material';
import type { Schedule, CountMatrix, FixedPair, RestCounts, Round } from '../types/schedule';
import { initializeCountMatrix, updateCountMatrices, initializeRestCounts, updateRestCounts, extractPreviousOpponents } from '../utils/evaluation';

/**
 * 固定ペアによって必ず0になるセルかどうかを判定する
 */
function isFixedPairZeroCell(
  i: number,
  j: number,
  fixedPairs: FixedPair[],
  matrixType: 'pair' | 'opponent'
): boolean {
  if (fixedPairs.length === 0) return false;

  const p1 = i + 1;
  const p2 = j + 1;

  if (matrixType === 'pair') {
    for (const fp of fixedPairs) {
      if (fp.player1 === p1 || fp.player2 === p1) {
        const partner = fp.player1 === p1 ? fp.player2 : fp.player1;
        if (p2 !== partner) return true;
      }
      if (fp.player1 === p2 || fp.player2 === p2) {
        const partner = fp.player1 === p2 ? fp.player2 : fp.player1;
        if (p1 !== partner) return true;
      }
    }
  } else {
    for (const fp of fixedPairs) {
      if ((fp.player1 === p1 && fp.player2 === p2) ||
          (fp.player1 === p2 && fp.player2 === p1)) {
        return true;
      }
    }
  }

  return false;
}

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

type QualityTotals = {
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  hasRest: boolean;
};

function renderQualityViolations(totals: QualityTotals, rounds: number) {
  const rows: { label: string; count: number | null; description: string }[] = [
    {
      label: '(1) ペア重複',
      count: totals.c1,
      description: `全${rounds}R・発生ペア数`,
    },
    {
      label: '(2) 対戦重複',
      count: totals.c2,
      description: `全${rounds}R・発生組数`,
    },
    {
      label: '(3) 不公平休憩',
      count: totals.hasRest ? totals.c3 : null,
      description: totals.hasRest ? '累計人数' : '休憩なし',
    },
    {
      label: '(4) 前R対戦→今Rペア',
      count: totals.c4,
      description: `全${rounds}R`,
    },
    {
      label: '(5) 前Rペア→今R対戦',
      count: totals.c5,
      description: `全${rounds}R`,
    },
  ];

  return (
    <>
      <Typography variant="subtitle1" sx={{ p: 2, pb: 1 }}>
        品質違反件数
      </Typography>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell><strong>観点</strong></TableCell>
              <TableCell align="center"><strong>件数</strong></TableCell>
              <TableCell><strong>備考</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.label}>
                <TableCell>{row.label}</TableCell>
                <TableCell align="center">
                  {row.count === null ? (
                    <Chip label="-" size="small" variant="outlined" />
                  ) : (
                    <Chip
                      label={row.count}
                      size="small"
                      color={row.count === 0 ? 'success' : row.count <= 2 ? 'warning' : 'error'}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">
                    {row.description}
                  </Typography>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

/** sticky列の共通スタイル */
const stickyColumnSx = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
  borderRight: 1,
  borderColor: 'divider',
} as const;

interface PlayerStatsTableProps {
  schedule: Schedule;
}

function renderMatrix(
  matrix: CountMatrix,
  title: string,
  playersCount: number,
  fixedPairs: FixedPair[],
  matrixType: 'pair' | 'opponent',
  activeSet: Set<number>
) {
  return (
    <>
      <Typography variant="subtitle1" sx={{ p: 2, pb: 1 }}>
        {title}
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={stickyColumnSx}>
                <strong>P</strong>
              </TableCell>
              {Array.from({ length: playersCount }, (_, i) => {
                const isActive = activeSet.has(i + 1);
                return (
                  <TableCell
                    key={i}
                    align="center"
                    sx={{
                      opacity: isActive ? 1 : 0.3,
                      minWidth: { xs: 28, sm: 36 },
                      fontSize: { xs: '0.75rem', sm: '0.875rem' },
                    }}
                  >
                    <strong>{i + 1}</strong>
                  </TableCell>
                );
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {matrix.map((row, i) => {
              const rowActive = activeSet.has(i + 1);
              return (
                <TableRow key={i} sx={{ opacity: rowActive ? 1 : 0.3 }}>
                  <TableCell sx={stickyColumnSx}>
                    <strong>{i + 1}</strong>
                  </TableCell>
                  {row.map((count, j) => {
                    const colActive = activeSet.has(j + 1);
                    const bothActive = rowActive && colActive;
                    const isUpperTriangle = i < j;
                    const displayValue = isUpperTriangle ? count : '-';
                    const isFixedZero = isUpperTriangle &&
                      isFixedPairZeroCell(i, j, fixedPairs, matrixType);
                    const isInactive = !bothActive;

                    let bgColor: string;
                    if (!isUpperTriangle) {
                      bgColor = 'grey.200';
                    } else if (isInactive) {
                      bgColor = 'grey.100';
                    } else if (isFixedZero) {
                      bgColor = 'grey.300';
                    } else {
                      bgColor = `rgba(25, 118, 210, ${Math.min(count * 0.15, 0.7)})`;
                    }

                    return (
                      <TableCell
                        key={j}
                        align="center"
                        sx={{
                          bgcolor: bgColor,
                          color: isUpperTriangle && !isFixedZero && !isInactive && count > 2 ? 'white' : 'inherit',
                          opacity: isFixedZero ? 0.6 : isInactive && isUpperTriangle ? 0.3 : 1,
                          minWidth: { xs: 28, sm: 36 },
                          fontSize: { xs: '0.75rem', sm: '0.875rem' },
                        }}
                      >
                        {displayValue}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {/* モバイル横スクロールヒント */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ display: { xs: 'block', sm: 'none' }, mt: 0.5, textAlign: 'center' }}
      >
        ← 横にスクロールできます →
      </Typography>
    </>
  );
}

function renderRestCounts(restCounts: RestCounts, activeSet: Set<number>) {
  const activeRestCounts = restCounts.filter((_, i) => activeSet.has(i + 1));
  const maxCount = Math.max(...activeRestCounts, 1);

  return (
    <>
      <Typography variant="subtitle1" sx={{ p: 2, pb: 1 }}>
        各プレイヤーの休憩回数
      </Typography>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>プレイヤー</strong>
              </TableCell>
              <TableCell align="center">
                <strong>休憩回数</strong>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {restCounts.map((count, i) => {
              const isActive = activeSet.has(i + 1);
              return (
                <TableRow key={i} sx={{ opacity: isActive ? 1 : 0.3 }}>
                  <TableCell>
                    <strong>{i + 1}</strong>
                  </TableCell>
                  <TableCell
                    align="center"
                    sx={{
                      bgcolor: isActive
                        ? `rgba(255, 152, 0, ${Math.min(count / maxCount * 0.6, 0.6)})`
                        : 'grey.100',
                    }}
                  >
                    {count}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export function PlayerStatsTable({ schedule }: PlayerStatsTableProps) {
  const [tabValue, setTabValue] = useState(0);

  const activeSet = useMemo(() => {
    return new Set(schedule.activePlayers);
  }, [schedule.activePlayers]);

  const pairCounts = initializeCountMatrix(schedule.players);
  const oppoCounts = initializeCountMatrix(schedule.players);
  const restCounts = initializeRestCounts(schedule.players);

  for (const round of schedule.rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
    updateRestCounts(round, restCounts);
  }

  const hasRestingPlayers = schedule.rounds.some(
    (round) => round.restingPlayers && round.restingPlayers.length > 0
  );

  const qualityTotals = useMemo<QualityTotals>(() => {
    const n = schedule.players;
    const pc = initializeCountMatrix(n);
    const oc = initializeCountMatrix(n);
    const rc = initializeRestCounts(n);
    const allPlayers = schedule.activePlayers;
    const totals = { c1: 0, c2: 0, c3: 0, c4: 0, c5: 0 };
    let hasRest = false;
    let prevRound: Round | null = null;

    for (const round of schedule.rounds) {
      // (1) ペア重複
      for (const match of round.matches) {
        if (pc[match.pairA.player1 - 1][match.pairA.player2 - 1] > 0) totals.c1++;
        if (pc[match.pairB.player1 - 1][match.pairB.player2 - 1] > 0) totals.c1++;
      }

      // (2) 対戦重複
      for (const match of round.matches) {
        const { pairA, pairB } = match;
        for (const [a, b] of [
          [pairA.player1, pairB.player1],
          [pairA.player1, pairB.player2],
          [pairA.player2, pairB.player1],
          [pairA.player2, pairB.player2],
        ] as [number, number][]) {
          if (oc[a - 1][b - 1] > 0) totals.c2++;
        }
      }

      // (3) 不公平休憩
      if (round.restingPlayers.length > 0) {
        hasRest = true;
        const minRest = Math.min(...allPlayers.map((p) => rc[p - 1]));
        for (const p of round.restingPlayers) {
          if (rc[p - 1] > minRest) totals.c3++;
        }
      }

      // (4) 前R対戦→今Rペア
      if (prevRound !== null) {
        const prevOppoMap = extractPreviousOpponents(prevRound);
        for (const match of round.matches) {
          for (const pair of [match.pairA, match.pairB]) {
            if (prevOppoMap.get(pair.player1)?.has(pair.player2)) totals.c4++;
          }
        }
      }

      // (5) 前Rペア→今R対戦
      if (prevRound !== null) {
        const prevPairMap = buildPrevPairMap(prevRound);
        for (const match of round.matches) {
          const { pairA, pairB } = match;
          for (const a of [pairA.player1, pairA.player2]) {
            for (const b of [pairB.player1, pairB.player2]) {
              if (prevPairMap.get(a) === b) totals.c5++;
            }
          }
        }
      }

      updateCountMatrices(round, pc, oc);
      updateRestCounts(round, rc);
      prevRound = round;
    }

    return { ...totals, hasRest };
  }, [schedule]);

  return (
    <Paper sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2, pb: 0 }}>
        統計情報
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }} aria-label="統計情報タブ">
        <Tab label="ペア回数" />
        <Tab label="対戦回数" />
        {hasRestingPlayers && <Tab label="休憩回数" />}
        <Tab label="品質" />
      </Tabs>

      {(() => {
        const qualityTabIndex = hasRestingPlayers ? 3 : 2;
        return (
          <Box sx={{ mt: 1 }}>
            {tabValue === 0 &&
              renderMatrix(pairCounts, 'プレイヤー間のペア回数', schedule.players, schedule.fixedPairs, 'pair', activeSet)}
            {tabValue === 1 &&
              renderMatrix(oppoCounts, 'プレイヤー間の対戦回数', schedule.players, schedule.fixedPairs, 'opponent', activeSet)}
            {tabValue === 2 && hasRestingPlayers &&
              renderRestCounts(restCounts, activeSet)}
            {tabValue === qualityTabIndex &&
              renderQualityViolations(qualityTotals, schedule.rounds.length)}
          </Box>
        );
      })()}

      {/* 凡例 */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {(() => {
            const qualityTabIndex = hasRestingPlayers ? 3 : 2;
            if (tabValue === qualityTabIndex) {
              return '各観点の違反件数。0件が理想です。色: 緑=0件、橙=1〜2件、赤=3件以上。';
            }
            if (tabValue === 2 && hasRestingPlayers) {
              return (
                <>
                  色が濃いほど休憩回数が多いです。理想的には全員が均等に休憩します。
                  {activeSet.size < schedule.players && (
                    <> 薄い行は離脱したプレイヤーです。</>
                  )}
                </>
              );
            }
            return (
              <>
                上三角のみ表示（対称行列のため）。色が濃いほど回数が多いです。
                {schedule.fixedPairs.length > 0 && (
                  <> グレーのセルは固定ペアにより必ず0になる組み合わせです。</>
                )}
                {activeSet.size < schedule.players && (
                  <> 薄い行/列は離脱したプレイヤーです。</>
                )}
              </>
            );
          })()}
        </Typography>
      </Box>
    </Paper>
  );
}
