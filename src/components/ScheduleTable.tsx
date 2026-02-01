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
}

/**
 * Formats a match for display
 * Format: "p1,p2 : p3,p4"
 */
function formatMatch(match: Match): string {
  return `${match.pairA.player1},${match.pairA.player2} : ${match.pairB.player1},${match.pairB.player2}`;
}

export function ScheduleTable({ schedule }: ScheduleTableProps) {
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
            </TableRow>
          </TableHead>

          <TableBody>
            {schedule.rounds.map((round) => (
              <TableRow key={round.roundNumber}>
                <TableCell>
                  <strong>{round.roundNumber}</strong>
                </TableCell>
                {round.matches.map((match, idx) => (
                  <TableCell key={idx} align="center">
                    {formatMatch(match)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
