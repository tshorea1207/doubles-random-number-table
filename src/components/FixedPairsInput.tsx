import { useState } from 'react';
import {
  Box,
  FormControl,
  IconButton,
  InputLabel,
  Popover,
  Select,
  MenuItem,
  Button,
  Chip,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import type { FixedPair } from '../types/schedule';
import { normalizeFixedPair, validateFixedPairs } from '../utils/fixedPairs';

interface FixedPairsInputProps {
  playersCount: number;
  courtsCount: number;
  fixedPairs: FixedPair[];
  onChange: (pairs: FixedPair[]) => void;
  activePlayers?: number[]; // 指定時は playersCount の代わりにこのリストを使用（非連続番号対応）
}

/**
 * 固定ペア選択UIコンポーネント
 *
 * チップベースの選択UI:
 * - 2つのドロップダウンでプレイヤーを選択
 * - 「追加」ボタンでペアを追加
 * - チップの×ボタンで削除
 */
export function FixedPairsInput({
  playersCount,
  courtsCount,
  fixedPairs,
  onChange,
  activePlayers,
}: FixedPairsInputProps) {
  const [player1, setPlayer1] = useState<number | ''>('');
  const [player2, setPlayer2] = useState<number | ''>('');
  const [helpAnchorEl, setHelpAnchorEl] = useState<HTMLElement | null>(null);

  // 既に固定ペアに含まれているプレイヤーを取得
  const usedPlayers = new Set<number>();
  fixedPairs.forEach((fp) => {
    usedPlayers.add(fp.player1);
    usedPlayers.add(fp.player2);
  });

  // 選択可能なプレイヤー（固定ペアに含まれていないプレイヤー）
  const allPlayers = activePlayers ?? Array.from(
    { length: playersCount },
    (_, i) => i + 1
  );
  const availablePlayers = allPlayers.filter((p) => !usedPlayers.has(p));

  // ペアを追加
  const handleAdd = () => {
    if (player1 !== '' && player2 !== '' && player1 !== player2) {
      const newPair = normalizeFixedPair(player1, player2);
      onChange([...fixedPairs, newPair]);
      setPlayer1('');
      setPlayer2('');
    }
  };

  // ペアを削除
  const handleRemove = (index: number) => {
    const newPairs = fixedPairs.filter((_, i) => i !== index);
    onChange(newPairs);
  };

  // バリデーション結果
  const validation = validateFixedPairs(fixedPairs, playersCount, courtsCount);

  // 追加可能かどうか
  const canAdd =
    player1 !== '' &&
    player2 !== '' &&
    player1 !== player2 &&
    availablePlayers.length >= 2;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
        <Typography variant="subtitle2">
          固定ペア（任意）
        </Typography>
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
        <Stack
          direction="row"
          spacing={1}
          sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}
        >
          {fixedPairs.map((pair, index) => (
            <Chip
              key={index}
              label={`${pair.player1} & ${pair.player2}`}
              onDelete={() => handleRemove(index)}
              color="primary"
              variant="outlined"
            />
          ))}
        </Stack>
      )}

      {/* 新しいペアを追加するコントロール */}
      {availablePlayers.length >= 2 && (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <FormControl size="small" sx={{ minWidth: 70 }}>
            <InputLabel>P1</InputLabel>
            <Select
              value={player1}
              onChange={(e) => setPlayer1(e.target.value as number)}
              label="P1"
            >
              {availablePlayers.map((p) => (
                <MenuItem key={p} value={p} disabled={p === player2}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2">&</Typography>

          <FormControl size="small" sx={{ minWidth: 70 }}>
            <InputLabel>P2</InputLabel>
            <Select
              value={player2}
              onChange={(e) => setPlayer2(e.target.value as number)}
              label="P2"
            >
              {availablePlayers.map((p) => (
                <MenuItem key={p} value={p} disabled={p === player1}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            onClick={handleAdd}
            disabled={!canAdd}
            size="small"
          >
            追加
          </Button>
        </Stack>
      )}

      {/* 選択可能なプレイヤーがいない場合のメッセージ */}
      {availablePlayers.length < 2 && fixedPairs.length > 0 && (
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
  );
}
