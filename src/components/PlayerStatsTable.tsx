import { useState } from 'react';
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
import type { Schedule, CountMatrix } from '../types/schedule';
import { initializeCountMatrix, updateCountMatrices } from '../utils/evaluation';

interface PlayerStatsTableProps {
  schedule: Schedule;
}

/**
 * カウント行列をテーブルとして描画する
 * 対称行列の冗長性を避けるため上三角（i < j）のみ表示
 */
function renderMatrix(matrix: CountMatrix, title: string, playersCount: number) {
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
              {Array.from({ length: playersCount }, (_, i) => (
                <TableCell key={i} align="center">
                  <strong>{i + 1}</strong>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {matrix.map((row, i) => (
              <TableRow key={i}>
                <TableCell>
                  <strong>{i + 1}</strong>
                </TableCell>
                {row.map((count, j) => {
                  // 上三角（i < j）のみ表示
                  // 対角線と下三角は '-' として表示
                  const displayValue = i < j ? count : '-';

                  // カウントに基づく色の濃さ
                  const bgColor =
                    i < j ? `rgba(25, 118, 210, ${Math.min(count * 0.15, 0.7)})` : 'grey.200';

                  return (
                    <TableCell
                      key={j}
                      align="center"
                      sx={{
                        bgcolor: bgColor,
                        color: i < j && count > 2 ? 'white' : 'inherit',
                      }}
                    >
                      {displayValue}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </>
  );
}

export function PlayerStatsTable({ schedule }: PlayerStatsTableProps) {
  const [tabValue, setTabValue] = useState(0);

  // カウント行列を計算
  const pairCounts = initializeCountMatrix(schedule.players);
  const oppoCounts = initializeCountMatrix(schedule.players);

  for (const round of schedule.rounds) {
    updateCountMatrices(round, pairCounts, oppoCounts);
  }

  return (
    <Paper elevation={3} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2, pb: 0 }}>
        統計情報
      </Typography>

      <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ px: 2 }}>
        <Tab label="ペア回数" />
        <Tab label="対戦回数" />
      </Tabs>

      <Box sx={{ mt: 1 }}>
        {tabValue === 0 &&
          renderMatrix(pairCounts, 'プレイヤー間のペア回数', schedule.players)}
        {tabValue === 1 &&
          renderMatrix(oppoCounts, 'プレイヤー間の対戦回数', schedule.players)}
      </Box>

      {/* 凡例 */}
      <Box sx={{ p: 2, pt: 1 }}>
        <Typography variant="caption" color="text.secondary">
          上三角のみ表示（対称行列のため）。色が濃いほど回数が多いです。
        </Typography>
      </Box>
    </Paper>
  );
}
