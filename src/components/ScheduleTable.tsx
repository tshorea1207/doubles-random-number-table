import { useState, useMemo, useEffect } from "react";
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
  Collapse,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import VolumeUpIcon from "@mui/icons-material/VolumeUp";
import StopIcon from "@mui/icons-material/Stop";
import type { Schedule, Match, Round } from "../types/schedule";
import { scheduleColors } from "../theme";
import { useSpeech, buildSpeechText } from "../hooks/useSpeech";

interface ScheduleTableProps {
  schedule: Schedule;
  completedMatches: Set<string>;
  onToggleComplete: (matchId: string) => void;
  onAddRound?: () => void;
  openedAt: Record<string, Date>;
  onRoundOpened: (roundNumber: string) => void;
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

function formatTime(date: Date): string {
  return date.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" });
}

export function ScheduleTable({ schedule, completedMatches, onToggleComplete, onAddRound, openedAt, onRoundOpened }: ScheduleTableProps) {
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const { speak, stop, isSpeaking } = useSpeech();

  // ダイアログが閉じたら読み上げを停止
  useEffect(() => {
    if (!selectedRound) stop();
  }, [selectedRound, stop]);

  const handleDialogClose = () => {
    setSelectedRound(null);
  };

  const handleSpeechToggle = () => {
    if (isSpeaking) {
      stop();
    } else if (selectedRound) {
      speak(buildSpeechText(selectedRound));
    }
  };

  const handleRoundClick = (round: Round) => {
    const roundId = `${round.roundNumber}`;
    onToggleComplete(roundId);
    onRoundOpened(roundId);
    setSelectedRound(round);
  };

  const hasRestingPlayers = schedule.rounds.some((round) => round.restingPlayers && round.restingPlayers.length > 0);

  const { completedRounds, nonCompletedRounds } = useMemo(() => {
    const completed: Round[] = [];
    const nonCompleted: Round[] = [];
    schedule.rounds.forEach((round) => {
      if (completedMatches.has(`${round.roundNumber}`)) {
        completed.push(round);
      } else {
        nonCompleted.push(round);
      }
    });
    return { completedRounds: completed, nonCompletedRounds: nonCompleted };
  }, [schedule.rounds, completedMatches]);

  const totalColSpan = 1 + schedule.courts + (hasRestingPlayers ? 1 : 0);

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
              {completedRounds.length > 0 && (
                <TableRow
                  onClick={() => setCompletedExpanded(!completedExpanded)}
                  sx={{
                    cursor: "pointer",
                    userSelect: "none",
                    bgcolor: scheduleColors.completedRow,
                    "&:hover": { bgcolor: scheduleColors.completedRowHover },
                  }}
                >
                  <TableCell colSpan={totalColSpan}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      {completedExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      <Typography variant="body2" fontWeight={500}>
                        消化済み ({completedRounds.length} ラウンド)
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              )}
              {completedExpanded &&
                completedRounds.map((round) => (
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
                      backgroundColor: scheduleColors.completedRow,
                      opacity: 0.7,
                      "&:hover": {
                        backgroundColor: scheduleColors.completedRowHover,
                      },
                    }}
                  >
                    <TableCell>
                      <strong>{round.roundNumber}</strong>
                      {openedAt[`${round.roundNumber}`] && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {formatTime(openedAt[`${round.roundNumber}`])}
                        </Typography>
                      )}
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
                ))}
              {nonCompletedRounds.map((round) => (
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
                    "&:hover": {
                      backgroundColor: scheduleColors.rowHover,
                    },
                  }}
                >
                  <TableCell>
                    <strong>{round.roundNumber}</strong>
                    {openedAt[`${round.roundNumber}`] && (
                      <Typography variant="caption" display="block" color="text.secondary">
                        {formatTime(openedAt[`${round.roundNumber}`])}
                      </Typography>
                    )}
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
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* モバイル: カード表示 */}
      <Box sx={{ display: { xs: "block", sm: "none" }, px: 2, pb: 2 }}>
        {completedRounds.length > 0 && (
          <>
            <Box
              onClick={() => setCompletedExpanded(!completedExpanded)}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.5,
                mb: 1.5,
                px: 2,
                py: 1,
                bgcolor: scheduleColors.completedRow,
                borderRadius: 1,
                cursor: "pointer",
              }}
            >
              {completedExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              <Typography variant="body2" fontWeight={500}>
                消化済み ({completedRounds.length} ラウンド)
              </Typography>
            </Box>
            <Collapse in={completedExpanded}>
              {completedRounds.map((round) => (
                <Card
                  key={round.roundNumber}
                  variant="outlined"
                  sx={{
                    mb: 1.5,
                    bgcolor: scheduleColors.completedRow,
                    opacity: 0.7,
                  }}
                >
                  <CardActionArea onClick={() => handleRoundClick(round)}>
                    <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                      <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ flex: 1 }}>
                          ラウンド {round.roundNumber}
                          {openedAt[`${round.roundNumber}`] && (
                            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                              {formatTime(openedAt[`${round.roundNumber}`])}
                            </Typography>
                          )}
                        </Typography>
                        <IconButton size="small" color="success" aria-label="未消化に戻す" sx={{ p: 0.5 }}>
                          <CheckCircleIcon />
                        </IconButton>
                      </Box>
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
              ))}
            </Collapse>
          </>
        )}
        {nonCompletedRounds.map((round) => (
          <Card
            key={round.roundNumber}
            variant="outlined"
            sx={{
              mb: 1.5,
              bgcolor: "background.paper",
            }}
          >
            <CardActionArea onClick={() => handleRoundClick(round)}>
              <CardContent sx={{ py: 1.5, px: 2, "&:last-child": { pb: 1.5 } }}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 1 }}>
                  <Typography variant="subtitle2" sx={{ flex: 1 }}>
                    ラウンド {round.roundNumber}
                    {openedAt[`${round.roundNumber}`] && (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                        {formatTime(openedAt[`${round.roundNumber}`])}
                      </Typography>
                    )}
                  </Typography>
                  <IconButton size="small" color="default" aria-label="消化済みにする" sx={{ p: 0.5 }}>
                    <CheckCircleOutlineIcon />
                  </IconButton>
                </Box>
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
        ))}
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
        onClose={handleDialogClose}
        maxWidth="sm"
        fullWidth
        slotProps={{ paper: { sx: { mx: { xs: 1, sm: 4 } } } }}
      >
        {selectedRound && (
          <>
            <DialogTitle>
              ラウンド {selectedRound.roundNumber}
              {openedAt[`${selectedRound.roundNumber}`] && (
                <Typography variant="caption" color="text.secondary" display="block">
                  Opened at {formatTime(openedAt[`${selectedRound.roundNumber}`])}
                </Typography>
              )}
            </DialogTitle>
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
              <IconButton
                onClick={handleSpeechToggle}
                color={isSpeaking ? "error" : "primary"}
                aria-label={isSpeaking ? "読み上げ停止" : "読み上げ"}
                sx={{ mr: "auto" }}
              >
                {isSpeaking ? <StopIcon /> : <VolumeUpIcon />}
              </IconButton>
              <Button onClick={handleDialogClose}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Paper>
  );
}
