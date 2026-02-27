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
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
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
  speechPitch: number;
  speechRate: number;
  onEditRound?: (roundIndex: number, editedRound: Round) => void;
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

/** プレイヤー番号のスワップヘルパー */
function swapPlayer(current: number, from: number, to: number): number {
  if (current === from) return to;
  if (current === to) return from;
  return current;
}

export function ScheduleTable({ schedule, completedMatches, onToggleComplete, onAddRound, openedAt, onRoundOpened, speechPitch, speechRate, onEditRound }: ScheduleTableProps) {
  const [selectedRound, setSelectedRound] = useState<Round | null>(null);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const { speak, stop, isSpeaking } = useSpeech(speechPitch, speechRate);

  // ラウンド編集用の状態
  const [editedRound, setEditedRound] = useState<Round | null>(null);
  const [swapTarget, setSwapTarget] = useState<number | null>(null);
  const [changedPlayers, setChangedPlayers] = useState<Set<number>>(new Set());
  const [isSelectedRoundEditable, setIsSelectedRoundEditable] = useState(false);

  // 選択ラウンドが変わったら編集状態をリセット
  useEffect(() => {
    setEditedRound(null);
    setChangedPlayers(new Set());
    setSwapTarget(null);
  }, [selectedRound]);

  // schedule更新時にダイアログ表示中のラウンドを最新データに同期
  useEffect(() => {
    if (!selectedRound) return;
    const updated = schedule.rounds.find((r) => r.roundNumber === selectedRound.roundNumber);
    if (updated) {
      setSelectedRound(updated);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.rounds]);

  // ダイアログ表示中のみ30秒ごとに現在時刻を更新
  useEffect(() => {
    if (!selectedRound) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [selectedRound]);

  const isOverdue =
    selectedRound != null &&
    openedAt[`${selectedRound.roundNumber}`] != null &&
    now - openedAt[`${selectedRound.roundNumber}`].getTime() > 3 * 60 * 1000;

  // ダイアログが閉じたら読み上げを停止
  useEffect(() => {
    if (!selectedRound) stop();
  }, [selectedRound, stop]);

  const handleDialogClose = () => {
    setSelectedRound(null);
    setEditedRound(null);
    setChangedPlayers(new Set());
    setSwapTarget(null);
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
    const wasCompleted = completedMatches.has(roundId);
    onToggleComplete(roundId);
    onRoundOpened(roundId);
    setSelectedRound(round);
    setIsSelectedRoundEditable(!wasCompleted && !!onEditRound);
  };

  // ダイアログ内で表示するラウンドデータ（編集中なら編集版を使用）
  const displayRound = editedRound ?? selectedRound;

  // プレイヤー番号タップ → スワップ選択ダイアログを開く
  const handlePlayerTap = (playerNumber: number) => {
    if (!isSelectedRoundEditable) return;
    setSwapTarget(playerNumber);
  };

  // スワップ実行
  const handleSwap = (fromPlayer: number, toPlayer: number) => {
    const round = editedRound ?? selectedRound;
    if (!round) return;
    const newMatches = round.matches.map((m) => ({
      pairA: {
        player1: swapPlayer(m.pairA.player1, fromPlayer, toPlayer),
        player2: swapPlayer(m.pairA.player2, fromPlayer, toPlayer),
      },
      pairB: {
        player1: swapPlayer(m.pairB.player1, fromPlayer, toPlayer),
        player2: swapPlayer(m.pairB.player2, fromPlayer, toPlayer),
      },
    }));
    const newResting = round.restingPlayers
      .map((p) => swapPlayer(p, fromPlayer, toPlayer))
      .sort((a, b) => a - b);
    setEditedRound({ ...round, matches: newMatches, restingPlayers: newResting });
    setChangedPlayers((prev) => new Set([...prev, fromPlayer, toPlayer]));
    setSwapTarget(null);
  };

  // 再生成実行
  const handleRegenerate = () => {
    if (!editedRound || !onEditRound || !selectedRound) return;
    const roundIndex = schedule.rounds.findIndex((r) => r.roundNumber === selectedRound.roundNumber);
    if (roundIndex === -1) return;
    onEditRound(roundIndex, editedRound);
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
                            label={<><Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairA.player1}</Box>,{" "}<Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairA.player2}</Box></>}
                            sx={{ flex: 1, bgcolor: scheduleColors.teamA, fontSize: "1.25rem", fontWeight: 700, height: 36, fontVariantNumeric: "tabular-nums" }}
                          />
                          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                            vs
                          </Typography>
                          <Chip
                            label={<><Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairB.player1}</Box>,{" "}<Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairB.player2}</Box></>}
                            sx={{ flex: 1, bgcolor: scheduleColors.teamB, fontSize: "1.25rem", fontWeight: 700, height: 36, fontVariantNumeric: "tabular-nums" }}
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
                      label={<><Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairA.player1}</Box>,{" "}<Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairA.player2}</Box></>}
                      sx={{ flex: 1, bgcolor: scheduleColors.teamA, fontSize: "1.25rem", fontWeight: 700, height: 36, fontVariantNumeric: "tabular-nums" }}
                    />
                    <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 600 }}>
                      vs
                    </Typography>
                    <Chip
                      label={<><Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairB.player1}</Box>,{" "}<Box component="span" sx={{ display: "inline-block", minWidth: "2ch", textAlign: "center" }}>{match.pairB.player2}</Box></>}
                      sx={{ flex: 1, bgcolor: scheduleColors.teamB, fontSize: "1.25rem", fontWeight: 700, height: 36, fontVariantNumeric: "tabular-nums" }}
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
        slotProps={{ paper: { sx: { mx: { xs: 1, sm: 4 }, ...(isOverdue && { bgcolor: scheduleColors.dialogOverdue }) } } }}
      >
        {selectedRound && displayRound && (
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
              {displayRound.matches.map((match, idx) => {
                const playerNumberSx = (playerNum: number) => ({
                  display: "inline-block",
                  minWidth: "2ch",
                  textAlign: "center" as const,
                  ...(isSelectedRoundEditable && {
                    cursor: "pointer",
                    borderRadius: 1,
                    "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
                  }),
                  ...(changedPlayers.has(playerNum) && {
                    outline: "2px solid",
                    outlineColor: "warning.main",
                    borderRadius: 1,
                  }),
                });
                const onPlayerClick = isSelectedRoundEditable
                  ? (playerNum: number) => (e: React.MouseEvent) => { e.stopPropagation(); handlePlayerTap(playerNum); }
                  : undefined;
                return (
                  <Box key={idx} sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      コート {idx + 1}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          flex: 1,
                          bgcolor: scheduleColors.teamA,
                          borderRadius: 2,
                          px: { xs: 1, sm: 1.5 },
                          py: 1,
                          fontSize: "clamp(2.5rem, 8vw, 4rem)",
                          fontWeight: 700,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <Box component="span" onClick={onPlayerClick?.(match.pairA.player1)} sx={playerNumberSx(match.pairA.player1)}>{match.pairA.player1}</Box>
                        ,
                        <Box component="span" onClick={onPlayerClick?.(match.pairA.player2)} sx={playerNumberSx(match.pairA.player2)}>{match.pairA.player2}</Box>
                      </Box>
                      <Typography sx={{ fontSize: "1rem", color: "text.secondary", fontWeight: 600 }}>vs</Typography>
                      <Box
                        sx={{
                          flex: 1,
                          bgcolor: scheduleColors.teamB,
                          borderRadius: 2,
                          px: { xs: 1, sm: 1.5 },
                          py: 1,
                          fontSize: "clamp(2.5rem, 8vw, 4rem)",
                          fontWeight: 700,
                          textAlign: "center",
                          whiteSpace: "nowrap",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        <Box component="span" onClick={onPlayerClick?.(match.pairB.player1)} sx={playerNumberSx(match.pairB.player1)}>{match.pairB.player1}</Box>
                        ,
                        <Box component="span" onClick={onPlayerClick?.(match.pairB.player2)} sx={playerNumberSx(match.pairB.player2)}>{match.pairB.player2}</Box>
                      </Box>
                    </Box>
                  </Box>
                );
              })}
              {displayRound.restingPlayers && displayRound.restingPlayers.length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                    休憩
                  </Typography>
                  <Box sx={{ display: "flex", justifyContent: "center", gap: 0.5, flexWrap: "wrap" }}>
                    {displayRound.restingPlayers.map((p, i) => (
                      <Box key={p} sx={{ display: "inline-flex", alignItems: "center" }}>
                        <Typography
                          component="span"
                          onClick={isSelectedRoundEditable ? (e: React.MouseEvent) => { e.stopPropagation(); handlePlayerTap(p); } : undefined}
                          sx={{
                            fontSize: "2rem",
                            fontWeight: 700,
                            color: "text.secondary",
                            ...(isSelectedRoundEditable && {
                              cursor: "pointer",
                              borderRadius: 1,
                              "&:hover": { bgcolor: "rgba(0,0,0,0.08)" },
                            }),
                            ...(changedPlayers.has(p) && {
                              outline: "2px solid",
                              outlineColor: "warning.main",
                              borderRadius: 1,
                            }),
                          }}
                        >
                          {p}
                        </Typography>
                        {i < displayRound.restingPlayers.length - 1 && (
                          <Typography component="span" sx={{ fontSize: "2rem", fontWeight: 700, color: "text.secondary", mx: 0.25 }}>
                            ,
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Box>
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
              {editedRound && onEditRound && (
                <Button variant="contained" color="primary" startIcon={<SwapHorizIcon />} onClick={handleRegenerate}>
                  再生成
                </Button>
              )}
              <Button onClick={handleDialogClose}>閉じる</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* プレイヤー番号選択グリッドダイアログ */}
      <Dialog open={swapTarget !== null} onClose={() => setSwapTarget(null)}>
        <DialogTitle>変更先を選択</DialogTitle>
        <DialogContent>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, pt: 0.5 }}>
            {schedule.activePlayers.map((p) => (
              <Button
                key={p}
                variant={p === swapTarget ? "contained" : "outlined"}
                disabled={p === swapTarget}
                onClick={() => handleSwap(swapTarget!, p)}
                sx={{ minWidth: 48, minHeight: 48, fontSize: "1.2rem", fontWeight: 700 }}
              >
                {p}
              </Button>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSwapTarget(null)}>キャンセル</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
