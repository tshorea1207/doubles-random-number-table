import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
} from '@mui/material';
import type { Schedule, Match } from '../types/schedule';

interface ScheduleTableProps {
  schedule: Schedule;
  completedMatches: Set<string>;
  onToggleComplete: (matchId: string) => void;
}

/**
 * 試合を表示用にフォーマットする
 * 形式: "p1,p2 : p3,p4"
 */
function formatMatch(match: Match): string {
  return `${match.pairA.player1},${match.pairA.player2} : ${match.pairB.player1},${match.pairB.player2}`;
}

export function ScheduleTable({ schedule, completedMatches, onToggleComplete }: ScheduleTableProps) {
  // 休憩者がいるかどうかを判定
  const hasRestingPlayers = schedule.rounds.some(
    (round) => round.restingPlayers && round.restingPlayers.length > 0
  );

  return (
    <Paper elevation={3} sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        対戦表
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>ラウンド</strong>
              </TableCell>
              {Array.from({ length: schedule.courts }, (_, i) => (
                <TableCell key={i} align="center">
                  <strong>コート {i + 1}</strong>
                </TableCell>
              ))}
              {hasRestingPlayers && (
                <TableCell align="center">
                  <strong>休憩</strong>
                </TableCell>
              )}
            </TableRow>
          </TableHead>

          <TableBody>
            {schedule.rounds.map((round) => {
              const roundId = `${round.roundNumber}`;
              const isCompleted = completedMatches.has(roundId);
              return (
                <TableRow
                  key={round.roundNumber}
                  onClick={() => onToggleComplete(roundId)}
                  sx={{
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: isCompleted ? '#e0e0e0' : 'inherit',
                    '&:hover': {
                      backgroundColor: isCompleted ? '#d0d0d0' : '#f5f5f5',
                    },
                  }}
                >
                  <TableCell>
                    <strong>{round.roundNumber}</strong>
                  </TableCell>
                  {round.matches.map((match, idx) => (
                    <TableCell key={idx} align="center">
                      {formatMatch(match)}
                    </TableCell>
                  ))}
                  {hasRestingPlayers && (
                    <TableCell align="center" sx={{ color: 'text.secondary' }}>
                      {round.restingPlayers && round.restingPlayers.length > 0
                        ? round.restingPlayers.join(', ')
                        : '-'}
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
