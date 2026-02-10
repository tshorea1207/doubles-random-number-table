import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography,
  Box,
  Card,
  CardContent,
  CardActionArea,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import type { Schedule, Match, Round } from "../types/schedule";
import { scheduleColors } from "../theme";

interface ScheduleTableProps {
  schedule: Schedule;
  completedMatches: Set<string>;
  onToggleComplete: (matchId: string) => void;
  onAddRound?: () => void;
}

/** 色付きバッジでマッチを表示（デスクトップ用） */
function MatchCell({ match }: { match: Match }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
      <Box
        sx={{
          bgcolor: scheduleColors.teamA,
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        {match.pairA.player1},{match.pairA.player2}
      </Box>
      <Typography variant="caption" sx={{ color: "text.secondary", mx: 0.25 }}>
        vs
      </Typography>
      <Box
        sx={{
          bgcolor: scheduleColors.teamB,
          borderRadius: 1,
          px: 0.75,
          py: 0.25,
          fontSize: "0.875rem",
          fontWeight: 500,
        }}
      >
        {match.pairB.player1},{match.pairB.player2}
      </Box>
    </Box>
  );
}

export function ScheduleTable({ schedule, completedMatches, onToggleComplete, onAddRound }: ScheduleTableProps) {
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);

  const handleRoundClick = (round: Round) => {
    const roundId = `${round.roundNumber}`;
    onToggleComplete(roundId);
    setSelectedRound(round);
  };

  const hasRestingPlayers = schedule.rounds.some((round) => round.restingPlayers && round.restingPlayers.length > 0);

  return (
    <Paper sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ p: 2 }}>
        対戦表
      </Typography>

      {/* デスクトップ: テーブル表示 */}
      <Box sx={{ display: { xs: "none", sm: "block" } }}>
        <TableContainer>
          <Table aria-label="対戦表">
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
                    onClick={() => handleRoundClick(round)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleRoundClick(round);
                      }
                    }}
                    aria-label={`ラウンド${round.roundNumber}の詳細を表示`}
                    sx={{
                      cursor: "pointer",
                      userSelect: "none",
                      backgroundColor: isCompleted ? scheduleColors.completedRow : "inherit",
                      "&:hover": {
                        backgroundColor: isCompleted ? scheduleColors.completedRowHover : scheduleColors.rowHover,
                      },
                    }}
                  >
                    <TableCell>
                      <strong>{round.roundNumber}</strong>
                    </TableCell>
                    {round.matches.map((match, idx) => (
                      <TableCell key={idx} align="center">
                        <MatchCell match={match} />
                      </TableCell>
                    ))}
                    {hasRestingPlayers && (
                      <TableCell align="center" sx={{ color: "text.secondary" }}>
                        {round.restingPlayers && round.restingPlayers.length > 0 ? round.restingPlayers.join(", ") : "-"}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* モバイル: カード表示 */}
      <Box sx={{ display: { xs: "block", sm: "none" }, px: 2, pb: 2 }}>
        {schedule.rounds.map((round) => {
          const roundId = `${round.roundNumber}`;
          const isCompleted = completedMatches.has(roundId);
          return (
            <Card
              key={round.roundNumber}
              variant="outlined"
              sx={{
                mb: 1.5,
                bgcolor: isCompleted ? scheduleColors.completedRow : "background.paper",
              }}
            >
              <CardActionArea onClick={() => handleRoundClick(round)}>
                <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                  {/* ラウンドヘッダー */}
                  <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                    <Typography variant="subtitle2" sx={{ flex: 1 }}>
                      ラウンド {round.roundNumber}
                    </Typography>
                    <IconButton
                      size="small"
                      color={isCompleted ? "success" : "default"}
                      aria-label={isCompleted ? "未消化に戻す" : "消化済みにする"}
                      sx={{ p: 0.5 }}
                    >
                      {isCompleted ? <CheckCircleIcon /> : <CheckCircleOutlineIcon />}
                    </IconButton>
                  </Box>

                  {/* コートごとの対戦 */}
                  {round.matches.map((match, idx) => (
                    <Box key={idx} sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                      <Typography variant="caption" sx={{ minWidth: 52, color: "text.secondary" }}>
                        コート {idx + 1}
                      </Typography>
                      <Chip
                        label={`${match.pairA.player1}, ${match.pairA.player2}`}
                        sx={{ bgcolor: scheduleColors.teamA, fontSize: "1.25rem", fontWeight: 700, height: 36 }}
                      />
                      <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                        vs
                      </Typography>
                      <Chip
                        label={`${match.pairB.player1}, ${match.pairB.player2}`}
                        sx={{ bgcolor: scheduleColors.teamB, fontSize: "1.25rem", fontWeight: 700, height: 36 }}
                      />
                    </Box>
                  ))}

                  {/* 休憩者 */}
                  {round.restingPlayers && round.restingPlayers.length > 0 && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, py: 0.5 }}>
                      <Typography variant="caption" sx={{ minWidth: 52, color: "text.secondary" }}>
                        休憩
                      </Typography>
                      <Typography color="text.secondary" sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
                        {round.restingPlayers.join(", ")}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      {/* ラウンド追加ボタン */}
      {onAddRound && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={onAddRound}>
            ラウンド追加
          </Button>
        </Box>
      )}

      {/* ラウンド詳細ダイアログ */}
      <Dialog
        open={selectedRound !== null}
        onClose={() => setSelectedRound(null)}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { mx: { xs: 1, sm: 4 } } } }}
      >
        {selectedRound && (
          <>
            <DialogTitle>ラウンド {selectedRound.roundNumber}</DialogTitle>
            <DialogContent sx={{ px: { xs: 1.5, sm: 3 } }}>
              {selectedRound.matches.map((match, idx) => (
                <Box key={idx} sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    コート {idx + 1}
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1 }}>
                    <Box
                      sx={{
                        bgcolor: scheduleColors.teamA,
                        borderRadius: 2,
                        px: { xs: 1, sm: 1.5 },
                        py: 1,
                        fontSize: "clamp(2.5rem, 8vw, 4rem)",
                        fontWeight: 700,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {match.pairA.player1},{match.pairA.player2}
                    </Box>
                    <Typography sx={{ fontSize: "1rem", color: "text.secondary", fontWeight: 600 }}>vs</Typography>
                    <Box
                      sx={{
                        bgcolor: scheduleColors.teamB,
                        borderRadius: 2,
                        px: { xs: 1, sm: 1.5 },
                        py: 1,
                        fontSize: "clamp(2.5rem, 8vw, 4rem)",
                        fontWeight: 700,
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {match.pairB.player1},{match.pairB.player2}
                    </Box>
                  </Box>
                </Box>
              ))}
              {selectedRound.restingPlayers && selectedRound.restingPlayers.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    休憩
                  </Typography>
                  <Typography sx={{ fontSize: "2rem", fontWeight: 700, color: "text.secondary", textAlign: "center" }}>
                    {selectedRound.restingPlayers.join(", ")}
                  </Typography>
                </Box>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSelectedRound(null)}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Paper>
  );
}
