import { useState, useEffect, useMemo, FormEvent } from "react";
import {
  Alert,
  Box,
  Slider,
  Button,
  Chip,
  Divider,
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

// 固定ペアの色パレット（最大8色）
const PAIR_COLORS = [
  '#1565c0', // blue
  '#e65100', // orange
  '#2e7d32', // green
  '#7b1fa2', // purple
  '#c62828', // red
  '#00838f', // teal
  '#4e342e', // brown
  '#37474f', // blue-grey
];

type PairSelectionState =
  | { mode: 'inactive' }
  | { mode: 'selecting'; firstPlayer: null }
  | { mode: 'selecting'; firstPlayer: number };

interface ScheduleFormProps {
  onGenerate: (params: ScheduleParams) => void;
  onRegenerate: (params: RegenerationParams) => void;
  onCancel: () => void;
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

export function ScheduleForm({ onGenerate, onRegenerate, onCancel, isGenerating, schedule, completedMatches, fixedPairs, onFixedPairsChange, speechPitch, onSpeechPitchChange, speechRate, onSpeechRateChange }: ScheduleFormProps) {
  const [courts, setCourts] = useState(4);
  const [players, setPlayers] = useState(16);
  const [rounds, setRounds] = useState(15);
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(0.5);
  const [w3, setW3] = useState(2.0);
  const [helpTarget, setHelpTarget] = useState<"w1" | "w2" | "w3" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // 参加者管理state（ParticipantSettingsDialogから移植）
  const [pendingAdds, setPendingAdds] = useState<number[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<number[]>([]);
  const [pairSelection, setPairSelection] = useState<PairSelectionState>({ mode: 'inactive' });
  const [showPlayerGrid, setShowPlayerGrid] = useState(false);

  // 参加人数変更時に無効な固定ペアを削除
  useEffect(() => {
    const validPairs = fixedPairs.filter((fp) => fp.player1 <= players && fp.player2 <= players);
    if (validPairs.length !== fixedPairs.length) {
      onFixedPairsChange(validPairs);
    }
  }, [players, fixedPairs, onFixedPairsChange]);

  // スケジュール変更時にpending stateをリセット
  useEffect(() => {
    if (schedule) {
      setPendingAdds([]);
      setPendingRemoves([]);
      setPairSelection({ mode: 'inactive' });
    }
  }, [schedule]);

  // --- 参加者管理の計算値（ParticipantSettingsDialogから移植） ---

  const currentActivePlayers = schedule?.activePlayers ?? [];

  // グリッドに表示するプレイヤー一覧
  const gridPlayers = useMemo(() => {
    if (schedule) {
      const all = [...currentActivePlayers, ...pendingAdds];
      return [...new Set(all)].sort((a, b) => a - b);
    }
    return Array.from({ length: players }, (_, i) => i + 1);
  }, [schedule, currentActivePlayers, players, pendingAdds]);

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

  // 消化済みラウンド
  const completedRoundsList = useMemo(() => {
    if (!schedule) return [];
    return schedule.rounds.filter(r => completedMatches.has(String(r.roundNumber)));
  }, [schedule, completedMatches]);

  const completedCount = completedRoundsList.length;
  const totalRounds = schedule?.rounds.length ?? 0;
  const remainingRounds = totalRounds - completedCount;

  // 固定ペアの変更検知
  const fixedPairsChanged = useMemo(() => {
    if (!schedule) return false;
    const orig = schedule.fixedPairs;
    if (orig.length !== fixedPairs.length) return true;
    return orig.some((fp, i) =>
      fp.player1 !== fixedPairs[i]?.player1 || fp.player2 !== fixedPairs[i]?.player2
    );
  }, [schedule, fixedPairs]);

  // バリデーション
  const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.length > 0 || fixedPairsChanged;
  const effectiveCourts = schedule?.courts ?? courts;
  const playersEnough = newActivePlayers.length >= effectiveCourts * 4;

  const newRestingCount = schedule
    ? Math.max(0, newActivePlayers.length - schedule.courts * 4)
    : 0;

  // 次のプレイヤー番号
  const nextPlayerNumber = useMemo(() => {
    const allKnown = [...currentActivePlayers, ...pendingAdds];
    return allKnown.length > 0 ? Math.max(...allKnown) + 1 : 1;
  }, [currentActivePlayers, pendingAdds]);

  // 固定ペアバリデーション
  const effectivePlayersCount = schedule
    ? Math.max(...currentActivePlayers, ...pendingAdds, 0)
    : players;
  const fixedPairsValidation = validateFixedPairs(fixedPairs, effectivePlayersCount, effectiveCourts);

  // --- ハンドラー ---

  const handlePlayerTap = (player: number) => {
    if (pairSelection.mode === 'selecting') {
      handlePairSelectionTap(player);
      return;
    }

    // 生成前はグリッドは参加者トグル不可
    if (!schedule) return;

    if (pendingAdds.includes(player)) {
      setPendingAdds(prev => prev.filter(p => p !== player));
    } else if (pendingRemoves.includes(player)) {
      setPendingRemoves(prev => prev.filter(p => p !== player));
    } else if (currentActivePlayers.includes(player)) {
      setPendingRemoves(prev => [...prev, player]);
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
      setPairSelection({ mode: 'inactive' });
      setShowPlayerGrid(false);
    }
  };

  const handleAddPlayer = () => {
    setPendingAdds(prev => [...prev, nextPlayerNumber]);
  };

  const handleRemoveFixedPair = (index: number) => {
    onFixedPairsChange(fixedPairs.filter((_, i) => i !== index));
  };

  // --- ボタンスタイル計算 ---

  const getButtonSx = (player: number) => {
    const isPendingRemove = pendingRemoves.includes(player);
    const isPendingAdd = pendingAdds.includes(player);
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
    if (isPendingRemove) {
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
      const color = PAIR_COLORS[pairIndex % PAIR_COLORS.length];
      return { ...base, borderColor: color, borderWidth: 2.5, color, '&:hover': { borderColor: color, borderWidth: 2.5 } };
    }
    return base;
  };

  const getButtonVariant = (player: number): 'contained' | 'outlined' => {
    const isPendingAdd = pendingAdds.includes(player);
    const isFirstSelected = pairSelection.mode === 'selecting'
      && pairSelection.firstPlayer === player;

    if (isFirstSelected || isPendingAdd) return 'contained';
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
    if (schedule && hasPendingChanges) {
      // 再生成パス: 消化済みラウンドを保持し、残りを再生成
      const newFixedPairs = fixedPairs.filter(
        fp => newActivePlayers.includes(fp.player1) && newActivePlayers.includes(fp.player2)
      );
      onFixedPairsChange(newFixedPairs);
      onRegenerate({
        courtsCount: schedule.courts,
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
  const canSubmit = schedule && hasPendingChanges
    ? (playersEnough && !isGenerating)
    : (isValid && !isGenerating);

  // 休憩者数の計算
  const restingCount = Math.max(0, players - courts * 4);
  const restingMessage = restingCount > 0 ? `毎ラウンド ${restingCount} 人が休憩` : "";


  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2 } }}>
        <Typography variant="h6">スケジュール設定</Typography>
        <Tooltip title="詳細設定">
          <span>
            <Button
              variant="outlined"
              size="small"
              startIcon={<TuneIcon />}
              onClick={() => setAdvancedOpen(true)}
              disabled={isGenerating}
              sx={{
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
                onChange={(_, value) => setPlayers(value as number)}
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
                disabled={isGenerating}
              >
                追加/削除
              </Button>
              {pairSelectablePlayers.size >= 2 && pairSelection.mode === 'inactive' && (
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => {
                    setPairSelection({ mode: 'selecting', firstPlayer: null });
                    setShowPlayerGrid(true);
                  }}
                  disabled={isGenerating}
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
                  キャンセル
                </Button>
              )}
            </Box>

            {/* 固定ペアチップ（常に表示） */}
            {fixedPairs.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
                {fixedPairs.map((pair, index) => (
                  <Chip
                    key={index}
                    label={`${pair.player1} & ${pair.player2}`}
                    onDelete={() => handleRemoveFixedPair(index)}
                    variant="outlined"
                    sx={{
                      borderColor: PAIR_COLORS[index % PAIR_COLORS.length],
                      borderWidth: 2,
                      color: PAIR_COLORS[index % PAIR_COLORS.length],
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Stack>
            )}

            {/* 固定ペア警告メッセージ */}
            {fixedPairsValidation.warnings?.map((warning, i) => (
              <Alert severity="warning" sx={{ mt: 1 }} key={i}>
                {warning}
              </Alert>
            ))}

            {/* プレイヤーグリッド（トグルまたはペア選択モード時に表示） */}
            {(showPlayerGrid || pairSelection.mode === 'selecting') && (
              <Box sx={{ mt: 1 }}>

                {/* 5列グリッド */}
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 1, pt: 0.5 }}>
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
