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
} from '@mui/material';
import type { Schedule, CountMatrix, FixedPair, RestCounts } from '../types/schedule';
import { initializeCountMatrix, updateCountMatrices, initializeRestCounts, updateRestCounts } from '../utils/evaluation';

/**
 * 固定ペアによって必ず0になるセルかどうかを判定する
 *
 * @param i - 行インデックス（0始まり）
 * @param j - 列インデックス（0始まり）
 * @param fixedPairs - 固定ペアの配列
 * @param matrixType - 'pair'（ペア回数）または 'opponent'（対戦回数）
 * @returns 固定ペアにより必ず0になるセルならtrue
 */
function isFixedPairZeroCell(
  i: number,
  j: number,
  fixedPairs: FixedPair[],
  matrixType: 'pair' | 'opponent'
): boolean {
  if (fixedPairs.length === 0) return false;

  // プレイヤー番号に変換（1始まり）
  const p1 = i + 1;
  const p2 = j + 1;

  if (matrixType === 'pair') {
    // ペア回数行列: 固定ペアのメンバーは、固定ペアの相手以外とは組まない
    for (const fp of fixedPairs) {
      // p1が固定ペアのメンバーの場合
      if (fp.player1 === p1 || fp.player2 === p1) {
        // p2が固定ペアの相手でない場合は必ず0
        const partner = fp.player1 === p1 ? fp.player2 : fp.player1;
        if (p2 !== partner) return true;
      }
      // p2が固定ペアのメンバーの場合
      if (fp.player1 === p2 || fp.player2 === p2) {
        // p1が固定ペアの相手でない場合は必ず0
        const partner = fp.player1 === p2 ? fp.player2 : fp.player1;
        if (p1 !== partner) return true;
      }
    }
  } else {
    // 対戦回数行列: 固定ペアのメンバー同士は対戦しない（同じチーム）
    for (const fp of fixedPairs) {
      if ((fp.player1 === p1 && fp.player2 === p2) ||
          (fp.player1 === p2 && fp.player2 === p1)) {
        return true;
      }
    }
  }

  return false;
}

interface PlayerStatsTableProps {
  schedule: Schedule;
}

/**
 * カウント行列をテーブルとして描画する
 * 対称行列の冗長性を避けるため上三角（i < j）のみ表示
 *
 * @param matrix - カウント行列
 * @param title - テーブルのタイトル
 * @param playersCount - プレイヤー数（行列サイズ）
 * @param fixedPairs - 固定ペアの配列
 * @param matrixType - 'pair'（ペア回数）または 'opponent'（対戦回数）
 * @param activeSet - アクティブプレイヤーのセット
 */
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
              <TableCell>
                <strong>プレイヤー</strong>
              </TableCell>
              {Array.from({ length: playersCount }, (_, i) => {
                const isActive = activeSet.has(i + 1);
                return (
                  <TableCell key={i} align="center" sx={{ opacity: isActive ? 1 : 0.3 }}>
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
                  <TableCell>
                    <strong>{i + 1}</strong>
                  </TableCell>
                  {row.map((count, j) => {
                    const colActive = activeSet.has(j + 1);
                    const bothActive = rowActive && colActive;

                    // 上三角（i < j）のみ表示
                    // 対角線と下三角は '-' として表示
                    const isUpperTriangle = i < j;
                    const displayValue = isUpperTriangle ? count : '-';

                    // 固定ペアにより必ず0になるセルかどうか
                    const isFixedZero = isUpperTriangle &&
                      isFixedPairZeroCell(i, j, fixedPairs, matrixType);

                    // 非アクティブプレイヤーに関わるセル
                    const isInactive = !bothActive;

                    // 背景色の決定
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
    </>
  );
}

/**
 * 休憩回数をテーブルとして描画する
 *
 * @param restCounts - 休憩回数配列
 * @param activeSet - アクティブプレイヤーのセット
 */
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

  // アクティブプレイヤーのセット
  const activeSet = useMemo(() => {
    return new Set(schedule.activePlayers);
  }, [schedule.activePlayers]);

  // カウント行列を計算
  const pairCounts = initializeCountMatrix(schedule.players);
  const oppoCounts = initializeCountMatrix(schedule.players);
  const restCounts = initializeRestCounts(schedule.players);

  for (const round of schedule.rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
    updateRestCounts(round, restCounts);
  }

  // 休憩者がいるかどうか
  const hasRestingPlayers = schedule.rounds.some(
    (round) => round.restingPlayers && round.restingPlayers.length > 0
  );

  return (
    <Paper elevation={3} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2, pb: 0 }}>
        統計情報
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }}>
        <Tab label="ペア回数" />
        <Tab label="対戦回数" />
        {hasRestingPlayers && <Tab label="休憩回数" />}
      </Tabs>

      <Box sx={{ mt: 1 }}>
        {tabValue === 0 &&
          renderMatrix(pairCounts, 'プレイヤー間のペア回数', schedule.players, schedule.fixedPairs, 'pair', activeSet)}
        {tabValue === 1 &&
          renderMatrix(oppoCounts, 'プレイヤー間の対戦回数', schedule.players, schedule.fixedPairs, 'opponent', activeSet)}
        {tabValue === 2 && hasRestingPlayers &&
          renderRestCounts(restCounts, activeSet)}
      </Box>

      {/* 凡例 */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {tabValue < 2 ? (
            <>
              上三角のみ表示（対称行列のため）。色が濃いほど回数が多いです。
              {schedule.fixedPairs.length > 0 && (
                <> グレーのセルは固定ペアにより必ず0になる組み合わせです。</>
              )}
              {activeSet.size < schedule.players && (
                <> 薄い行/列は離脱したプレイヤーです。</>
              )}
            </>
          ) : (
            <>
              色が濃いほど休憩回数が多いです。理想的には全員が均等に休憩します。
              {activeSet.size < schedule.players && (
                <> 薄い行は離脱したプレイヤーです。</>
              )}
            </>
          )}
        </Typography>
      </Box>
    </Paper>
  );
}
