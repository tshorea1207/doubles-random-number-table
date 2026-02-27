import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import type { Schedule, RegenerationParams, FixedPair } from '../types/schedule';
import { FixedPairsInput } from './FixedPairsInput';


interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  // 固定ペア
  fixedPairs: FixedPair[];
  onFixedPairsChange: (pairs: FixedPair[]) => void;
  // フォームの現在値（生成前用）
  playersCount: number;
  courtsCount: number;
  // スケジュール（生成後はnon-null）
  schedule: Schedule | null;
  completedRounds: Set<string>;
  isGenerating: boolean;
  weights: { w1: number; w2: number; w3: number };
  onRegenerate: (params: RegenerationParams) => void;
}

export function SettingsDialog({
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
}: SettingsDialogProps) {
  const [pendingAdds, setPendingAdds] = useState<number[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<number[]>([]);
  const [removeTarget, setRemoveTarget] = useState<number | ''>('');

  const currentActivePlayers = schedule?.activePlayers ?? [];

  // 変更適用後のアクティブプレイヤー
  const newActivePlayers = useMemo(() => {
    return [
      ...currentActivePlayers.filter(p => !pendingRemoves.includes(p)),
      ...pendingAdds,
    ].sort((a, b) => a - b);
  }, [currentActivePlayers, pendingAdds, pendingRemoves]);

  // 消化済みラウンド
  const completedRoundsList = useMemo(() => {
    if (!schedule) return [];
    return schedule.rounds.filter(r => completedRounds.has(String(r.roundNumber)));
  }, [schedule, completedRounds]);

  const completedCount = completedRoundsList.length;
  const totalRounds = schedule?.rounds.length ?? 0;
  const remainingRounds = totalRounds - completedCount;

  // 離脱候補
  const removeCandidates = currentActivePlayers.filter(
    p => !pendingRemoves.includes(p)
  );

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

  // 追加時の次のプレイヤー番号
  const nextPlayerNumber = useMemo(() => {
    const allKnown = [...currentActivePlayers, ...pendingAdds];
    return allKnown.length > 0 ? Math.max(...allKnown) + 1 : 1;
  }, [currentActivePlayers, pendingAdds]);

  const handleAdd = () => {
    setPendingAdds(prev => [...prev, nextPlayerNumber]);
  };

  const handleRemove = () => {
    if (removeTarget === '') return;
    setPendingRemoves(prev => [...prev, removeTarget]);
    setRemoveTarget('');
  };

  const handleCancelAdd = (player: number) => {
    setPendingAdds(prev => prev.filter(p => p !== player));
  };

  const handleCancelRemove = (player: number) => {
    setPendingRemoves(prev => prev.filter(p => p !== player));
  };

  const handleRegenerate = () => {
    if (!schedule) return;

    // 除外プレイヤーを含む固定ペアを自動フィルタ
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
    setRemoveTarget('');
    onClose();
  };

  const newRestingCount = schedule
    ? Math.max(0, newActivePlayers.length - schedule.courts * 4)
    : 0;

  // FixedPairsInput 用のパラメータ
  const effectivePlayersCount = schedule
    ? Math.max(...currentActivePlayers, ...pendingAdds, 0)
    : playersCount;

  // 生成後はアクティブプレイヤー（+ 追加予定）を渡す
  const activePlayersForFixedPairs = schedule
    ? [...currentActivePlayers.filter(p => !pendingRemoves.includes(p)), ...pendingAdds].sort((a, b) => a - b)
    : undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {schedule ? '参加者・固定ペア設定' : '固定ペア設定'}
      </DialogTitle>
      <DialogContent>
        {/* 固定ペア設定（常に表示） */}
        <Box sx={{ mt: 1 }}>
          <FixedPairsInput
            playersCount={effectivePlayersCount}
            courtsCount={effectiveCourts}
            fixedPairs={fixedPairs}
            onChange={onFixedPairsChange}
            activePlayers={activePlayersForFixedPairs}
          />
        </Box>

        {/* 参加者の変更（スケジュール生成後のみ） */}
        {schedule && (
          <>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" gutterBottom>
              参加者の変更
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              現在の参加者: {currentActivePlayers.join(', ')} ({currentActivePlayers.length}人)
              {' / '}消化済み: {completedCount} / {totalRounds} ラウンド
            </Typography>

            {/* 追加・離脱コントロール */}
            <Box sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mb: 2,
            }}>
              <Button
                variant="outlined"
                startIcon={<PersonAddIcon />}
                onClick={handleAdd}
                disabled={isGenerating}
                size="small"
              >
                参加者を追加 (プレイヤー {nextPlayerNumber})
              </Button>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                <FormControl size="small" sx={{ flex: 1, minWidth: 160 }}>
                  <InputLabel>離脱するプレイヤー</InputLabel>
                  <Select
                    value={removeTarget}
                    onChange={(e) => setRemoveTarget(e.target.value as number | '')}
                    label="離脱するプレイヤー"
                    disabled={isGenerating || removeCandidates.length === 0}
                  >
                    {removeCandidates.map(p => (
                      <MenuItem key={p} value={p}>プレイヤー {p}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="outlined"
                  color="warning"
                  startIcon={<PersonRemoveIcon />}
                  onClick={handleRemove}
                  disabled={isGenerating || removeTarget === ''}
                  size="small"
                >
                  除外
                </Button>
              </Box>
            </Box>

            {/* 変更内容の表示 */}
            {hasPendingChanges && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>変更内容:</Typography>
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                  {pendingAdds.map(p => (
                    <Chip
                      key={`add-${p}`}
                      label={`+ プレイヤー ${p}`}
                      color="success"
                      size="small"
                      onDelete={() => handleCancelAdd(p)}
                    />
                  ))}
                  {pendingRemoves.map(p => (
                    <Chip
                      key={`remove-${p}`}
                      label={`- プレイヤー ${p}`}
                      color="error"
                      size="small"
                      onDelete={() => handleCancelRemove(p)}
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

                {/* 除外により無効になる固定ペアの警告 */}
                {pendingRemoves.length > 0 && fixedPairs.some(
                  fp => pendingRemoves.includes(fp.player1) || pendingRemoves.includes(fp.player2)
                ) && (
                  <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
                    ※ 離脱プレイヤーを含む固定ペアは自動的に解除されます
                  </Typography>
                )}
              </Box>
            )}

            {/* 再生成ボタン */}
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

            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              ※消化済みラウンド（グレー行）は保持されます
            </Typography>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>閉じる</Button>
      </DialogActions>
    </Dialog>
  );
}
