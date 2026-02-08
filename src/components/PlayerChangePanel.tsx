import { useState, useMemo } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Typography,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import type { Schedule, RegenerationParams } from '../types/schedule';

interface PlayerChangePanelProps {
  schedule: Schedule;
  completedRounds: Set<string>;
  isGenerating: boolean;
  weights: { w1: number; w2: number; w3: number };
  onRegenerate: (params: RegenerationParams) => void;
}

export function PlayerChangePanel({
  schedule,
  completedRounds,
  isGenerating,
  weights,
  onRegenerate,
}: PlayerChangePanelProps) {
  const [pendingAdds, setPendingAdds] = useState<number[]>([]);
  const [pendingRemoves, setPendingRemoves] = useState<number[]>([]);
  const [removeTarget, setRemoveTarget] = useState<number | ''>('');

  const currentActivePlayers = schedule.activePlayers;

  // 変更適用後のアクティブプレイヤー
  const newActivePlayers = useMemo(() => {
    return [
      ...currentActivePlayers.filter(p => !pendingRemoves.includes(p)),
      ...pendingAdds,
    ].sort((a, b) => a - b);
  }, [currentActivePlayers, pendingAdds, pendingRemoves]);

  // 消化済みラウンド数
  const completedRoundsList = useMemo(() => {
    return schedule.rounds.filter(r => completedRounds.has(String(r.roundNumber)));
  }, [schedule.rounds, completedRounds]);

  const completedCount = completedRoundsList.length;
  const totalRounds = schedule.rounds.length;
  const remainingRounds = totalRounds - completedCount;

  // 離脱候補（現在アクティブかつ追加予定でないプレイヤー）
  const removeCandidates = currentActivePlayers.filter(
    p => !pendingRemoves.includes(p)
  );

  // バリデーション
  const hasPendingChanges = pendingAdds.length > 0 || pendingRemoves.length > 0;
  const playersEnough = newActivePlayers.length >= schedule.courts * 4;
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
    // 除外プレイヤーを含む固定ペアを自動削除
    const newFixedPairs = schedule.fixedPairs.filter(
      fp => newActivePlayers.includes(fp.player1) && newActivePlayers.includes(fp.player2)
    );

    onRegenerate({
      courtsCount: schedule.courts,
      completedRounds: completedRoundsList,
      activePlayers: newActivePlayers,
      remainingRoundsCount: remainingRounds,
      weights,
      fixedPairs: newFixedPairs,
    });

    // 変更をリセット
    setPendingAdds([]);
    setPendingRemoves([]);
    setRemoveTarget('');
  };

  // 休憩者数の計算
  const newRestingCount = Math.max(0, newActivePlayers.length - schedule.courts * 4);

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        参加者の変更
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        現在の参加者: {currentActivePlayers.join(', ')} ({currentActivePlayers.length}人)
        {' / '}消化済み: {completedCount} / {totalRounds} ラウンド
      </Typography>

      {/* 追加ボタン */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          startIcon={<PersonAddIcon />}
          onClick={handleAdd}
          disabled={isGenerating}
          size="small"
        >
          参加者を追加 (プレイヤー {nextPlayerNumber})
        </Button>

        {/* 離脱セレクト + ボタン */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
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
              参加者数が{schedule.courts * 4}人以上必要です
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
    </Paper>
  );
}
