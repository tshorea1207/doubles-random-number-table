import { useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Popover,
  Stack,
  Typography,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { Schedule, RegenerationParams, FixedPair } from '../types/schedule';
import { normalizeFixedPair, validateFixedPairs } from '../utils/fixedPairs';

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

interface ParticipantSettingsDialogProps {
  open: boolean;
  onClose: () => void;
  fixedPairs: FixedPair[];
  onFixedPairsChange: (pairs: FixedPair[]) => void;
  playersCount: number;
  courtsCount: number;
  schedule: Schedule | null;
  completedRounds: Set<string>;
  isGenerating: boolean;
  weights: { w1: number; w2: number; w3: number };
  onRegenerate: (params: RegenerationParams) => void;
}

export function ParticipantSettingsDialog({
  open,
  onClose,
  fixedPairs,
  onFixedPairsChange,
  playersCount,
  courtsCount,
  schedule,
  completedRounds,
  isGenerating,
  weights,
  onRegenerate,
}: ParticipantSettingsDialogProps) {
  const [pendingAdds, setPendingAdds] = useState<number[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<number[]>([]);
  const [pairSelection, setPairSelection] = useState<PairSelectionState>({ mode: 'inactive' });
  const [helpAnchorEl, setHelpAnchorEl] = useState<HTMLElement | null>(null);

  const currentActivePlayers = schedule?.activePlayers ?? [];

  // グリッドに表示するプレイヤー一覧
  const gridPlayers = useMemo(() => {
    if (schedule) {
      const all = [...currentActivePlayers, ...pendingAdds];
      return [...new Set(all)].sort((a, b) => a - b);
    }
    return Array.from({ length: playersCount }, (_, i) => i + 1);
  }, [schedule, currentActivePlayers, playersCount, pendingAdds]);

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
      : Array.from({ length: playersCount }, (_, i) => i + 1);

    return new Set(activePlayers.filter(p => !usedInPairs.has(p)));
  }, [fixedPairs, schedule, currentActivePlayers, pendingAdds, pendingRemoves, playersCount]);

  // 消化済みラウンド
  const completedRoundsList = useMemo(() => {
    if (!schedule) return [];
    return schedule.rounds.filter(r => completedRounds.has(String(r.roundNumber)));
  }, [schedule, completedRounds]);

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
  const effectiveCourts = schedule?.courts ?? courtsCount;
  const playersEnough = newActivePlayers.length >= effectiveCourts * 4;
  const canRegenerate = hasPendingChanges && playersEnough && !isGenerating;

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
    : playersCount;
  const validation = validateFixedPairs(fixedPairs, effectivePlayersCount, effectiveCourts);

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
    }
  };

  const handleAddPlayer = () => {
    setPendingAdds(prev => [...prev, nextPlayerNumber]);
  };

  const handleRemoveFixedPair = (index: number) => {
    onFixedPairsChange(fixedPairs.filter((_, i) => i !== index));
  };

  const handleRegenerate = () => {
    if (!schedule) return;

    const newFixedPairs = fixedPairs.filter(
      fp => newActivePlayers.includes(fp.player1) && newActivePlayers.includes(fp.player2)
    );

    onFixedPairsChange(newFixedPairs);

    onRegenerate({
      courtsCount: schedule.courts,
      completedRounds: completedRoundsList,
      activePlayers: newActivePlayers,
      remainingRoundsCount: remainingRounds,
      weights,
      fixedPairs: newFixedPairs,
    });

    setPendingAdds([]);
    setPendingRemoves([]);
    setPairSelection({ mode: 'inactive' });
    onClose();
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

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {schedule ? '参加者・固定ペア設定' : '固定ペア設定'}
      </DialogTitle>
      <DialogContent>
        {/* === プレイヤーグリッド === */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {schedule ? '参加者' : 'プレイヤー'}
          </Typography>

          {/* ペア選択モード時のバナー */}
          {pairSelection.mode === 'selecting' && (
            <Alert
              severity="info"
              action={
                <Button size="small" onClick={() => setPairSelection({ mode: 'inactive' })}>
                  キャンセル
                </Button>
              }
              sx={{ mb: 1 }}
            >
              {pairSelection.firstPlayer !== null
                ? `プレイヤー ${pairSelection.firstPlayer} のペア相手を選択`
                : '固定ペアにする2人を選択してください'}
            </Alert>
          )}

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

        <Divider sx={{ my: 2 }} />

        {/* === 固定ペアセクション === */}
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <Typography variant="subtitle2">固定ペア（任意）</Typography>
            <IconButton
              size="small"
              onClick={(e) => setHelpAnchorEl(e.currentTarget)}
              sx={{ p: 0.25 }}
            >
              <HelpOutlineIcon sx={{ fontSize: 18 }} />
            </IconButton>
            <Popover
              open={Boolean(helpAnchorEl)}
              anchorEl={helpAnchorEl}
              onClose={() => setHelpAnchorEl(null)}
              anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
              <Typography sx={{ p: 1.5 }} variant="body2">
                固定ペアは全ラウンドで常に一緒にプレイします
              </Typography>
            </Popover>
          </Box>

          {/* 現在の固定ペアをチップで表示 */}
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

          {/* ペア追加ボタン */}
          {pairSelectablePlayers.size >= 2 && pairSelection.mode === 'inactive' && (
            <Button
              variant="outlined"
              size="small"
              onClick={() => setPairSelection({ mode: 'selecting', firstPlayer: null })}
              disabled={isGenerating}
            >
              ペアを追加
            </Button>
          )}

          {/* 選択可能なプレイヤーがいない場合 */}
          {pairSelectablePlayers.size < 2 && fixedPairs.length > 0 && pairSelection.mode === 'inactive' && (
            <Typography variant="caption" color="text.secondary">
              全てのプレイヤーが固定ペアに割り当て済みです
            </Typography>
          )}

          {/* 警告メッセージ */}
          {validation.warnings?.map((warning, i) => (
            <Alert severity="warning" sx={{ mt: 1 }} key={i}>
              {warning}
            </Alert>
          ))}
        </Box>

        {/* === 変更内容と再生成（生成後 & 変更ありの場合のみ） === */}
        {schedule && hasPendingChanges && (
          <>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>変更内容:</Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {pendingAdds.map(p => (
                  <Chip
                    key={`add-${p}`}
                    label={`+ ${p}`}
                    onDelete={() => setPendingAdds(prev => prev.filter(x => x !== p))}
                    variant="outlined"
                    sx={{
                      borderColor: '#2e7d32',
                      borderWidth: 2,
                      color: '#2e7d32',
                      fontWeight: 600,
                    }}
                  />
                ))}
                {pendingRemoves.map(p => (
                  <Chip
                    key={`rm-${p}`}
                    label={`- ${p}`}
                    onDelete={() => setPendingRemoves(prev => prev.filter(x => x !== p))}
                    variant="outlined"
                    sx={{
                      borderColor: '#d32f2f',
                      borderWidth: 2,
                      color: '#d32f2f',
                      fontWeight: 600,
                    }}
                  />
                ))}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                変更後: {newActivePlayers.length}人
                {newRestingCount > 0 && ` (毎ラウンド ${newRestingCount}人が休憩)`}
              </Typography>

              {!playersEnough && (
                <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                  参加者数が{effectiveCourts * 4}人以上必要です
                </Typography>
              )}

              {pendingRemoves.length > 0 && fixedPairs.some(
                fp => pendingRemoves.includes(fp.player1) || pendingRemoves.includes(fp.player2)
              ) && (
                <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                  ※ 離脱プレイヤーを含む固定ペアは自動的に解除されます
                </Typography>
              )}
            </Box>

            <Button
              variant="contained"
              onClick={handleRegenerate}
              disabled={!canRegenerate}
              fullWidth
            >
              {remainingRounds > 0
                ? `変更を適用してラウンド ${completedCount + 1}〜${totalRounds} を再生成`
                : '変更を適用'}
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
