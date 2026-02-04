import { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Stack,
  Typography,
  Alert,
} from '@mui/material';
import type { FixedPair } from '../types/schedule';
import { normalizeFixedPair, validateFixedPairs } from '../utils/fixedPairs';

interface FixedPairsInputProps {
  playersCount: number;
  courtsCount: number;
  fixedPairs: FixedPair[];
  onChange: (pairs: FixedPair[]) => void;
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
}: FixedPairsInputProps) {
  const [player1, setPlayer1] = useState<number | ''>('');
  const [player2, setPlayer2] = useState<number | ''>('');

  // 既に固定ペアに含まれているプレイヤーを取得
  const usedPlayers = new Set<number>();
  fixedPairs.forEach((fp) => {
    usedPlayers.add(fp.player1);
    usedPlayers.add(fp.player2);
  });

  // 選択可能なプレイヤー（固定ペアに含まれていないプレイヤー）
  const availablePlayers = Array.from(
    { length: playersCount },
    (_, i) => i + 1
  ).filter((p) => !usedPlayers.has(p));

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
      <Typography variant="subtitle2" gutterBottom>
        固定ペア（任意）
      </Typography>

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

      {/* ヘルパーテキスト */}
      <Typography
        variant="caption"
        color="text.secondary"
        sx={{ mt: 1, display: 'block' }}
      >
        固定ペアは全ラウンドで常に一緒にプレイします
      </Typography>
    </Box>
  );
}
