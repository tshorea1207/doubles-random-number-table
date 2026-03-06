import { useState, useEffect, useMemo, useRef, FormEvent } from "react";
import {
  Box,
  Slider,
  Button,
  Chip,
  Typography,
  Paper,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,

  Stack,
  Tooltip,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import type { ScheduleParams, RegenerationParams, FixedPair, Schedule } from "../types/schedule";

import { normalizeFixedPair, validateFixedPairs } from "../utils/fixedPairs";

// 固定ペアの色（単色）
const PAIR_COLOR = '#1565c0';

// 設定の初期値
const DEFAULTS: { courts: number; players: number; rounds: number; w1: number; w2: number; w3: number } = {
  courts: 4,
  players: 16,
  rounds: 15,
  w1: 1.0,
  w2: 0.5,
  w3: 2.0,
};

type PairSelectionState =
  | { mode: 'inactive' }
  | { mode: 'selecting'; firstPlayer: null }
  | { mode: 'selecting'; firstPlayer: number };

interface ScheduleFormProps {
  onGenerate: (params: ScheduleParams) => void;
  onRegenerate: (params: RegenerationParams) => void;
  onCancel: () => void;
  onClear: () => void;
  isGenerating: boolean;
  schedule: Schedule | null;
  completedMatches: Set<string>;
  fixedPairs: FixedPair[];
  onFixedPairsChange: (pairs: FixedPair[]) => void;
  speechPitch: number;
  onSpeechPitchChange: (pitch: number) => void;
  speechRate: number;
  onSpeechRateChange: (rate: number) => void;
}

export function ScheduleForm({ onGenerate, onRegenerate, onCancel, onClear, isGenerating, schedule, completedMatches, fixedPairs, onFixedPairsChange, speechPitch, onSpeechPitchChange, speechRate, onSpeechRateChange }: ScheduleFormProps) {
  const [courts, setCourts] = useState(DEFAULTS.courts);
  const [players, setPlayers] = useState(DEFAULTS.players);
  const [rounds, setRounds] = useState(DEFAULTS.rounds);
  const [w1, setW1] = useState(DEFAULTS.w1);
  const [w2, setW2] = useState(DEFAULTS.w2);
  const [w3, setW3] = useState(DEFAULTS.w3);
  const [helpTarget, setHelpTarget] = useState<"w1" | "w2" | "w3" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);

  // 参加者管理state（ParticipantSettingsDialogから移植）
  const [pendingAdds, setPendingAdds] = useState<number[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<number[]>([]);
  const [pairSelection, setPairSelection] = useState<PairSelectionState>({ mode: 'inactive' });
  const [showPlayerGrid, setShowPlayerGrid] = useState(false);
  const prevActivePlayersRef = useRef<number[] | null>(null);

  // 参加人数変更時に無効な固定ペアを削除（生成後は handleSubmit でフィルタするためスキップ）
  useEffect(() => {
    if (schedule) return;
    const validPairs = fixedPairs.filter((fp) => fp.player1 <= players && fp.player2 <= players);
    if (validPairs.length !== fixedPairs.length) {
      onFixedPairsChange(validPairs);
    }
  }, [players, schedule, fixedPairs, onFixedPairsChange]);

  // スケジュール変更時: activePlayersが変化した場合のみpending stateをリセット
  useEffect(() => {
    if (schedule) {
      const prev = prevActivePlayersRef.current;
      const activePlayersChanged = !prev ||
        prev.length !== schedule.activePlayers.length ||
        prev.some((p, i) => p !== schedule.activePlayers[i]);

      if (activePlayersChanged) {
        setPendingAdds([]);
        setPendingRemoves([]);
        setPairSelection({ mode: 'inactive' });
        setPlayers(schedule.activePlayers.length);
      }
      prevActivePlayersRef.current = schedule.activePlayers;
    }
  }, [schedule]);

  // --- 参加者管理の計算値（ParticipantSettingsDialogから移植） ---

  const currentActivePlayers = schedule?.activePlayers ?? [];

  // スケジュール再生成後に離脱したプレイヤーを検出
  const removedPlayers = useMemo(() => {
    if (!schedule) return [];
    const activeSet = new Set(schedule.activePlayers);
    const allKnown = new Set<number>();
    for (let p = 1; p <= schedule.players; p++) allKnown.add(p);
    for (const round of schedule.rounds) {
      for (const match of round.matches) {
        allKnown.add(match.pairA.player1);
        allKnown.add(match.pairA.player2);
        allKnown.add(match.pairB.player1);
        allKnown.add(match.pairB.player2);
      }
      for (const p of round.restingPlayers) allKnown.add(p);
    }
    return [...allKnown].filter(p => !activeSet.has(p)).sort((a, b) => a - b);
  }, [schedule]);

  // グリッドに表示するプレイヤー一覧
  const gridPlayers = useMemo(() => {
    if (schedule) {
      const all = [...currentActivePlayers, ...pendingAdds, ...removedPlayers];
      return [...new Set(all)].sort((a, b) => a - b);
    }
    return Array.from({ length: players }, (_, i) => i + 1);
  }, [schedule, currentActivePlayers, players, pendingAdds, removedPlayers]);

  // 変更適用後のアクティブプレイヤー
  const newActivePlayers = useMemo(() => {
    return [
      ...currentActivePlayers.filter(p => !pendingRemoves.includes(p)),
      ...pendingAdds,
    ].sort((a, b) => a - b);
  }, [currentActivePlayers, pendingAdds, pendingRemoves]);

  // プレイヤー → 固定ペアインデックスのマップ（色分け用）
  const playerPairMap = useMemo(() => {
    const map = new Map<number, number>();
    fixedPairs.forEach((fp, idx) => {
      map.set(fp.player1, idx);
      map.set(fp.player2, idx);
    });
    return map;
  }, [fixedPairs]);

  // ペア選択可能なプレイヤー（アクティブかつ未ペア）
  const pairSelectablePlayers = useMemo(() => {
    const usedInPairs = new Set<number>();
    fixedPairs.forEach(fp => {
      usedInPairs.add(fp.player1);
      usedInPairs.add(fp.player2);
    });

    const activePlayers = schedule
      ? [...currentActivePlayers.filter(p => !pendingRemoves.includes(p)), ...pendingAdds]
      : Array.from({ length: players }, (_, i) => i + 1);

    return new Set(activePlayers.filter(p => !usedInPairs.has(p)));
  }, [fixedPairs, schedule, currentActivePlayers, pendingAdds, pendingRemoves, players]);

  // 選択可能プレイヤーが2人未満になったらペア選択モードを自動終了
  useEffect(() => {
    if (pairSelection.mode === 'selecting' && pairSelectablePlayers.size < 2) {
      setPairSelection({ mode: 'inactive' });
      setShowPlayerGrid(false);
    }
  }, [pairSelection.mode, pairSelectablePlayers.size]);

  // 消化済みラウンド
  const completedRoundsList = useMemo(() => {
    if (!schedule) return [];
    return schedule.rounds.filter(r => completedMatches.has(String(r.roundNumber)));
  }, [schedule, completedMatches]);

  const completedCount = completedRoundsList.length;
  const totalRounds = schedule?.rounds.length ?? 0;
  const remainingRounds = totalRounds - completedCount;

  // バリデーション
  const effectiveCourts = courts;
  const playersEnough = newActivePlayers.length >= effectiveCourts * 4;

  // 次のプレイヤー番号
  const nextPlayerNumber = useMemo(() => {
    const allKnown = [...currentActivePlayers, ...pendingAdds, ...removedPlayers];
    return allKnown.length > 0 ? Math.max(...allKnown) + 1 : 1;
  }, [currentActivePlayers, pendingAdds, removedPlayers]);

  // 固定ペアバリデーション
  const effectivePlayersCount = schedule
    ? Math.max(...currentActivePlayers, ...pendingAdds, ...removedPlayers, 0)
    : players;
  const fixedPairsValidation = validateFixedPairs(fixedPairs, effectivePlayersCount);

  // --- ハンドラー ---

  // スライダー変更: 生成前は単純に値を設定、生成後は差分で pendingAdds/pendingRemoves を調整
  const handlePlayersSliderChange = (_: Event, value: number | number[]) => {
    const newValue = value as number;

    if (!schedule) {
      setPlayers(newValue);
      return;
    }

    // 絶対値ベースで pendingAdds / pendingRemoves を再計算
    // currentActivePlayers と removedPlayers は schedule 由来で安定 → stale closure の影響なし
    const activeCount = currentActivePlayers.length;

    if (newValue >= activeCount) {
      // 全アクティブプレイヤーを維持 + 不足分を新規追加
      setPendingRemoves([]);
      const addsNeeded = newValue - activeCount;
      if (addsNeeded === 0) {
        setPendingAdds([]);
      } else {
        const allKnown = [...currentActivePlayers, ...removedPlayers];
        let nextNum = allKnown.length > 0 ? Math.max(...allKnown) + 1 : 1;
        const newAdds: number[] = [];
        for (let i = 0; i < addsNeeded; i++) {
          newAdds.push(nextNum++);
        }
        setPendingAdds(newAdds);
      }
    } else {
      // アクティブプレイヤーから番号の大きい順に削除
      setPendingAdds([]);
      const removesNeeded = activeCount - newValue;
      const sorted = [...currentActivePlayers].sort((a, b) => b - a);
      setPendingRemoves(sorted.slice(0, removesNeeded));
    }

    setPlayers(newValue);
  };

  const handlePlayerTap = (player: number) => {
    if (pairSelection.mode === 'selecting') {
      handlePairSelectionTap(player);
      return;
    }

    // 生成前はグリッドは参加者トグル不可
    if (!schedule) return;

    if (pendingAdds.includes(player)) {
      setPendingAdds(prev => prev.filter(p => p !== player));
      setPlayers(prev => prev - 1);
    } else if (pendingRemoves.includes(player)) {
      setPendingRemoves(prev => prev.filter(p => p !== player));
      setPlayers(prev => prev + 1);
    } else if (currentActivePlayers.includes(player)) {
      setPendingRemoves(prev => [...prev, player]);
      setPlayers(prev => prev - 1);
    } else if (removedPlayers.includes(player)) {
      // 離脱したプレイヤーの復帰
      setPendingAdds(prev => [...prev, player]);
      setPlayers(prev => prev + 1);
    }
  };

  const handlePairSelectionTap = (player: number) => {
    if (!pairSelectablePlayers.has(player)) return;

    if (pairSelection.mode !== 'selecting') return;

    if (pairSelection.firstPlayer === null) {
      setPairSelection({ mode: 'selecting', firstPlayer: player });
    } else if (pairSelection.firstPlayer === player) {
      setPairSelection({ mode: 'selecting', firstPlayer: null });
    } else {
      const newPair = normalizeFixedPair(pairSelection.firstPlayer, player);
      onFixedPairsChange([...fixedPairs, newPair]);
      // 選択モードを維持し、次のペア選択に備える
      setPairSelection({ mode: 'selecting', firstPlayer: null });
    }
  };

  const handleAddPlayer = () => {
    setPendingAdds(prev => [...prev, nextPlayerNumber]);
    setPlayers(prev => prev + 1);
  };

  const handleRemoveFixedPair = (index: number) => {
    onFixedPairsChange(fixedPairs.filter((_, i) => i !== index));
  };

  // --- ボタンスタイル計算 ---

  const getButtonSx = (player: number) => {
    const isPendingRemove = pendingRemoves.includes(player);
    const isPendingAdd = pendingAdds.includes(player);
    const isRemoved = removedPlayers.includes(player);
    const pairIndex = playerPairMap.get(player);
    const isInPair = pairIndex !== undefined;
    const isFirstSelected = pairSelection.mode === 'selecting'
      && pairSelection.firstPlayer === player;
    const isSelectableForPair = pairSelection.mode === 'selecting'
      && pairSelectablePlayers.has(player);
    const isInPairSelectionMode = pairSelection.mode === 'selecting';

    const base = {
      minWidth: 48,
      minHeight: 48,
      fontSize: '1.2rem',
      fontWeight: 700,
    };

    if (isFirstSelected) {
      return { ...base, bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' } };
    }
    if (isPendingRemove || isRemoved) {
      return {
        ...base,
        opacity: 0.5,
        borderColor: 'grey.400',
        color: 'text.disabled',
      };
    }
    if (isPendingAdd) {
      return { ...base, bgcolor: 'success.main', color: 'success.contrastText', '&:hover': { bgcolor: 'success.dark' } };
    }
    if (isInPairSelectionMode && !isSelectableForPair) {
      return { ...base, opacity: 0.4 };
    }
    if (isInPair) {
      return { ...base, bgcolor: PAIR_COLOR, color: '#fff', '&:hover': { bgcolor: '#0d47a1' } };
    }
    return base;
  };

  const getButtonVariant = (player: number): 'contained' | 'outlined' => {
    const isPendingAdd = pendingAdds.includes(player);
    const isFirstSelected = pairSelection.mode === 'selecting'
      && pairSelection.firstPlayer === player;
    const isInPair = playerPairMap.has(player);

    if (isFirstSelected || isPendingAdd || isInPair) return 'contained';
    return 'outlined';
  };

  const isButtonDisabled = (player: number) => {
    const isInPairSelectionMode = pairSelection.mode === 'selecting';
    const isSelectableForPair = pairSelectablePlayers.has(player);
    const isFirstSelected = pairSelection.mode === 'selecting'
      && pairSelection.firstPlayer === player;

    if (isInPairSelectionMode && !isSelectableForPair && !isFirstSelected) return true;
    if (!schedule && pairSelection.mode === 'inactive') return true;
    return false;
  };

  // --- フォーム送信（生成 or 再生成） ---

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (schedule) {
      // 再生成パス: 消化済みラウンドを保持し、残りを再生成
      const newFixedPairs = fixedPairs.filter(
        fp => newActivePlayers.includes(fp.player1) && newActivePlayers.includes(fp.player2)
      );
      onFixedPairsChange(newFixedPairs);
      onRegenerate({
        courtsCount: courts,
        completedRounds: completedRoundsList,
        activePlayers: newActivePlayers,
        remainingRoundsCount: remainingRounds,
        weights: { w1, w2, w3 },
        fixedPairs: newFixedPairs,
      });
      setPendingAdds([]);
      setPendingRemoves([]);
      setPairSelection({ mode: 'inactive' });
    } else {
      // 新規生成パス
      onGenerate({
        courtsCount: courts,
        playersCount: players,
        roundsCount: rounds,
        weights: { w1, w2, w3 },
        fixedPairs,
      });
    }
  };

  // バリデーション
  const playersValid = players >= courts * 4;
  const isValid = playersValid && fixedPairsValidation.isValid;
  const errorMessage = !playersValid ? `参加人数は ${courts * 4} 人以上が必要です` : "";

  // 送信ボタンの有効/無効判定
  const isPairSelecting = pairSelection.mode === 'selecting';
  const canSubmit = schedule
    ? (playersEnough && !isGenerating && !isPairSelecting)
    : (isValid && !isGenerating && !isPairSelecting);

  // 休憩者数の計算
  const restingCount = Math.max(0, players - courts * 4);
  const restingMessage = restingCount > 0 ? `毎ラウンド ${restingCount} 人が休憩` : "";

  // 全設定を初期値にリセット
  const handleClear = () => {
    setCourts(DEFAULTS.courts);
    setPlayers(DEFAULTS.players);
    setRounds(DEFAULTS.rounds);
    setW1(DEFAULTS.w1);
    setW2(DEFAULTS.w2);
    setW3(DEFAULTS.w3);
    setPendingAdds([]);
    setPendingRemoves([]);
    setPairSelection({ mode: 'inactive' });
    setShowPlayerGrid(false);
    onClear();
  };

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2 } }}>
        <Typography variant="h6">スケジュール設定</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            color="error"
            onClick={() => setClearConfirmOpen(true)}
            disabled={isGenerating}
          >
            クリア
          </Button>
          <Tooltip title="詳細設定">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TuneIcon />}
                onClick={() => setAdvancedOpen(true)}
                disabled={isGenerating}
                sx={{
                  height: "100%",
                  minWidth: { xs: "auto", sm: undefined },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  詳細設定
                </Box>
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* コート数 */}
          <Grid item xs={12} sm={6} order={{ xs: 1, sm: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, pb: 2.5 }}>
              <Typography sx={{ whiteSpace: "nowrap", minWidth: "7em" }}>
                コート数: {courts}
              </Typography>
              <Slider
                value={courts}
                onChange={(_, value) => setCourts(value as number)}
                min={1}
                max={8}
                step={1}
                marks={[
                  { value: 1, label: "1" },
                  { value: 2, label: "2" },
                  { value: 4, label: "4" },
                  { value: 8, label: "8" },
                ]}
                valueLabelDisplay="auto"
                disabled={isGenerating}
                sx={{ mb: 0 }}
              />
            </Box>
          </Grid>

          {/* 参加人数 */}
          <Grid item xs={12} sm={6} order={{ xs: 2, sm: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 2, pb: 2.5 }}>
              <Typography sx={{ whiteSpace: "nowrap", minWidth: "7em" }}>
                参加人数: {players}
              </Typography>
              <Slider
                value={players}
                onChange={handlePlayersSliderChange}
                min={4}
                max={32}
                step={1}
                marks={[
                  { value: 4, label: "4" },
                  { value: 8, label: "8" },
                  { value: 16, label: "16" },
                  { value: 32, label: "32" },
                ]}
                valueLabelDisplay="auto"
                disabled={isGenerating}
                sx={{ mb: 0 }}
              />
            </Box>
            {errorMessage && (
              <Typography variant="caption" color="error">
                {errorMessage}
              </Typography>
            )}
            {!errorMessage && restingMessage && (
              <Typography variant="caption" color="text.secondary">
                {restingMessage}
              </Typography>
            )}
          </Grid>

          {/* === 詳細設定セクション === */}
          <Grid item xs={12} order={3}>
            {/* ヘッダー行: ラベル + ボタン */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2">詳細設定</Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowPlayerGrid(prev => !prev)}
                disabled={isGenerating || pairSelection.mode === 'selecting'}
              >
                追加/削除
              </Button>
              {pairSelection.mode === 'inactive' && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setPairSelection({ mode: 'selecting', firstPlayer: null });
                    setShowPlayerGrid(true);
                  }}
                  disabled={isGenerating || pairSelectablePlayers.size < 2}
                >
                  固定ペア
                </Button>
              )}
              {pairSelection.mode === 'selecting' && (
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={() => {
                    setPairSelection({ mode: 'inactive' });
                    setShowPlayerGrid(false);
                  }}
                >
                  OK
                </Button>
              )}
            </Box>

            {/* プレイヤーグリッド（トグルまたはペア選択モード時に表示） */}
            {(showPlayerGrid || pairSelection.mode === 'selecting') && (
              <Box sx={{ mt: 1 }}>

                {/* 5列グリッド */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, pt: 0.5 }}>
                  {gridPlayers.map(p => (
                    <Button
                      key={p}
                      variant={getButtonVariant(p)}
                      disabled={isButtonDisabled(p)}
                      onClick={() => handlePlayerTap(p)}
                      sx={getButtonSx(p)}
                    >
                      {p}
                    </Button>
                  ))}
                  {/* 追加ボタン（生成後のみ） */}
                  {schedule && pairSelection.mode === 'inactive' && (
                    <Button
                      variant="outlined"
                      color="success"
                      onClick={handleAddPlayer}
                      disabled={isGenerating}
                      sx={{ minWidth: 48, minHeight: 48, fontSize: '1.2rem', fontWeight: 700 }}
                    >
                      +
                    </Button>
                  )}
                </Box>

                {/* 生成後: タップでトグルの説明 */}
                {schedule && pairSelection.mode === 'inactive' && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    タップで参加/不参加を切り替え
                  </Typography>
                )}
              </Box>
            )}

            {/* 固定ペアチップ（常に表示） */}
            {fixedPairs.length > 0 && (
              <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 1 }}>
                {fixedPairs.map((pair, index) => (
                  <Chip
                    key={index}
                    label={`${pair.player1} & ${pair.player2}`}
                    onDelete={() => handleRemoveFixedPair(index)}
                    variant="outlined"
                    sx={{
                      borderColor: PAIR_COLOR,
                      color: PAIR_COLOR,
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Stack>
            )}

          </Grid>

          {/* 送信ボタン */}
          <Grid item xs={12} order={4}>
            {isGenerating ? (
              <Button type="button" variant="contained" color="error" size="large" fullWidth onClick={onCancel}>
                生成停止
              </Button>
            ) : (
              <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={!canSubmit}>
                スケジュール生成
              </Button>
            )}
          </Grid>
        </Grid>
      </form>

      {/* クリア確認ダイアログ */}
      <Dialog open={clearConfirmOpen} onClose={() => setClearConfirmOpen(false)}>
        <DialogTitle>設定のリセット</DialogTitle>
        <DialogContent>
          <Typography>すべての設定を初期値にリセットしますか？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearConfirmOpen(false)}>キャンセル</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              handleClear();
              setClearConfirmOpen(false);
            }}
          >
            リセット
          </Button>
        </DialogActions>
      </Dialog>

      {/* 詳細設定ダイアログ */}
      <Dialog open={advancedOpen} onClose={() => setAdvancedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>詳細設定</DialogTitle>
        <DialogContent>
          {/* ラウンド数 */}
          <Box sx={{ mt: 1, mb: 3 }}>
            <Typography gutterBottom>ラウンド数: {rounds}</Typography>
            <Slider
              value={rounds}
              onChange={(_, value) => setRounds(value as number)}
              min={1}
              max={20}
              step={1}
              marks={[
                { value: 1, label: "1" },
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 20, label: "20" },
              ]}
              valueLabelDisplay="auto"
              disabled={isGenerating}
            />
          </Box>

          {/* 重み W1 */}
          <Box sx={{ mt: 1, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W1 (ペア回数): {w1.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w1")} aria-label="W1の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w1}
              onChange={(_, value) => setW1(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 1, label: "1.0" },
                { value: 10, label: "10" },
              ]}
            />
          </Box>

          {/* 重み W2 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W2 (対戦回数): {w2.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w2")} aria-label="W2の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w2}
              onChange={(_, value) => setW2(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 0.5, label: "0.5" },
                { value: 10, label: "10" },
              ]}
            />
          </Box>

          {/* 重み W3 */}
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W3 (休憩回数): {w3.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w3")} aria-label="W3の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w3}
              onChange={(_, value) => setW3(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 2, label: "2.0" },
                { value: 10, label: "10" },
              ]}
              disabled={restingCount === 0}
            />
            {restingCount === 0 && (
              <Typography variant="caption" color="text.secondary">
                休憩者がいないため無効です
              </Typography>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            計算式: 総合スコア = ペア偏差×W1 + 対戦偏差×W2 + 休憩偏差×W3
            <br />
            スコアが小さいほど公平な組み合わせです。
          </Typography>

          {/* 読み上げ速度 */}
          <Box sx={{ mt: 3, pt: 2, borderTop: 1, borderColor: "divider" }}>
            <Typography gutterBottom>読み上げ速度: {speechRate.toFixed(1)}</Typography>
            <Slider
              value={speechRate}
              onChange={(_, value) => onSpeechRateChange(value as number)}
              min={0.5}
              max={4.0}
              step={0.1}
              marks={[
                { value: 0.5, label: "0.5" },
                { value: 2.0, label: "2.0" },
                { value: 4.0, label: "4.0" },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>

          {/* 読み上げピッチ */}
          <Box sx={{ mt: 2 }}>
            <Typography gutterBottom>読み上げピッチ: {speechPitch.toFixed(1)}</Typography>
            <Slider
              value={speechPitch}
              onChange={(_, value) => onSpeechPitchChange(value as number)}
              min={0.1}
              max={2.0}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 1.0, label: "1.0" },
                { value: 2.0, label: "2.0" },
              ]}
              valueLabelDisplay="auto"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 重み解説ダイアログ */}
      <Dialog open={helpTarget !== null} onClose={() => setHelpTarget(null)}>
        <DialogTitle>
          {helpTarget === "w1" && "W1（ペア回数）について"}
          {helpTarget === "w2" && "W2（対戦回数）について"}
          {helpTarget === "w3" && "W3（休憩回数）について"}
        </DialogTitle>
        <DialogContent>
          {helpTarget === "w1" && (
            <Typography>
              同じ人とペアを組む回数の偏りをどれだけ重視するかを設定します。
              値を大きくすると、全員がなるべく均等にペアを組むことが優先されます。
              <br />
              <br />
              推奨値: 1.0
            </Typography>
          )}
          {helpTarget === "w2" && (
            <Typography>
              同じ人と対戦する回数の偏りをどれだけ重視するかを設定します。
              値を大きくすると、全員がなるべく均等に対戦することが優先されます。
              <br />
              <br />
              推奨値: 0.5
            </Typography>
          )}
          {helpTarget === "w3" && (
            <Typography>
              休憩する回数の偏りをどれだけ重視するかを設定します。 値を大きくすると、全員がなるべく均等に休憩することが優先されます。
              <br />
              <br />
              ※参加人数がコート数×4と等しい場合は休憩者がいないため無効です。
              <br />
              <br />
              推奨値: 2.0
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpTarget(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
