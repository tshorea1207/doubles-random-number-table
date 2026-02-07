import { useState, useEffect, FormEvent } from 'react';
import {
  Box,
  TextField,
  Slider,
  Button,
  Typography,
  Paper,
  Grid,
} from '@mui/material';
import type { ScheduleParams, FixedPair } from '../types/schedule';
import { useBenchmarkCalibration } from '../hooks/useBenchmarkCalibration';
import { FixedPairsInput } from './FixedPairsInput';
import { validateFixedPairs } from '../utils/fixedPairs';

interface ScheduleFormProps {
  onGenerate: (params: ScheduleParams) => void;
  isGenerating: boolean;
}

export function ScheduleForm({ onGenerate, isGenerating }: ScheduleFormProps) {
  const [courts, setCourts] = useState(2);
  const [players, setPlayers] = useState(8);
  const [rounds, setRounds] = useState(7);
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(0.5);
  const [w3, setW3] = useState(2.0);
  const [fixedPairs, setFixedPairs] = useState<FixedPair[]>([]);

  // ハードウェア性能に基づく動的キャリブレーション係数
  const { coefficient } = useBenchmarkCalibration();

  // 参加人数変更時に無効な固定ペアを削除
  useEffect(() => {
    const validPairs = fixedPairs.filter(
      (fp) => fp.player1 <= players && fp.player2 <= players
    );
    if (validPairs.length !== fixedPairs.length) {
      setFixedPairs(validPairs);
    }
  }, [players, fixedPairs]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onGenerate({
      courtsCount: courts,
      playersCount: players,
      roundsCount: rounds,
      weights: { w1, w2, w3 },
      fixedPairs,
    });
  };

  // バリデーション
  const playersValid = players >= courts * 4;
  const fixedPairsValidation = validateFixedPairs(fixedPairs, players, courts);
  const isValid = playersValid && fixedPairsValidation.isValid;
  const errorMessage = !playersValid ? `参加人数は ${courts * 4} 人以上が必要です` : '';

  // 休憩者数の計算
  const restingCount = Math.max(0, players - courts * 4);
  const restingMessage = restingCount > 0
    ? `毎ラウンド ${restingCount} 人が休憩`
    : '';

  // 設定に基づいて生成時間を推定
  const estimateTime = (): string => {
    if (!isValid) return '';

    // 計算量に基づく経験式
    // 基本計算量はコート数とプレイヤー数に対して指数的に増加
    const baseComplexity = Math.pow(players / 4, courts * 1.5);
    const roundFactor = Math.max(rounds - 1, 1);

    // 推定秒数（ハードウェアに基づいて動的にキャリブレーション）
    let seconds = (baseComplexity * roundFactor * coefficient);

    // 出力をフォーマット
    if (seconds < 1) {
      return '< 1秒';
    } else if (seconds < 60) {
      return `約${Math.round(seconds)}秒`;
    } else if (seconds < 300) {
      const minutes = Math.round(seconds / 60);
      return `約${minutes}分`;
    } else {
      return '5分以上';
    }
  };

  const estimatedTime = estimateTime();

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        スケジュール設定
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={3}>
          {/* コート数 */}
          <Grid item xs={12} sm={4}>
            <TextField
              label="コート数"
              type="number"
              value={courts}
              onChange={(e) => setCourts(Number(e.target.value))}
              inputProps={{ min: 1, max: 4 }}
              fullWidth
              helperText="1-4 コート"
            />
          </Grid>

          {/* 参加人数 */}
          <Grid item xs={12} sm={4}>
            <TextField
              label="参加人数"
              type="number"
              value={players}
              onChange={(e) => setPlayers(Number(e.target.value))}
              inputProps={{ min: 4, max: 16 }}
              fullWidth
              error={!isValid}
              helperText={errorMessage || restingMessage || '4-16 人'}
            />
          </Grid>

          {/* ラウンド数 */}
          <Grid item xs={12} sm={4}>
            <TextField
              label="ラウンド数"
              type="number"
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              inputProps={{ min: 1, max: 10 }}
              fullWidth
              helperText="1-10 ラウンド"
            />
          </Grid>

          {/* 重み W1 */}
          <Grid item xs={12} sm={4}>
            <Typography gutterBottom>
              重み W1 (ペア回数): {w1.toFixed(1)}
            </Typography>
            <Slider
              value={w1}
              onChange={(_, value) => setW1(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: '0.1' },
                { value: 1, label: '1.0' },
                { value: 10, label: '10' },
              ]}
            />
          </Grid>

          {/* 重み W2 */}
          <Grid item xs={12} sm={4}>
            <Typography gutterBottom>
              重み W2 (対戦回数): {w2.toFixed(1)}
            </Typography>
            <Slider
              value={w2}
              onChange={(_, value) => setW2(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: '0.1' },
                { value: 0.5, label: '0.5' },
                { value: 10, label: '10' },
              ]}
            />
          </Grid>

          {/* 重み W3 */}
          <Grid item xs={12} sm={4}>
            <Typography gutterBottom>
              重み W3 (休憩回数): {w3.toFixed(1)}
            </Typography>
            <Slider
              value={w3}
              onChange={(_, value) => setW3(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: '0.1' },
                { value: 2, label: '2.0' },
                { value: 10, label: '10' },
              ]}
              disabled={restingCount === 0}
            />
          </Grid>

          {/* 固定ペア */}
          <Grid item xs={12}>
            <FixedPairsInput
              playersCount={players}
              courtsCount={courts}
              fixedPairs={fixedPairs}
              onChange={setFixedPairs}
            />
          </Grid>

          {/* 送信ボタン */}
          <Grid item xs={12}>
            <Button
              type="submit"
              variant="contained"
              color="primary"
              size="large"
              fullWidth
              disabled={!isValid || isGenerating}
            >
              {isGenerating
                ? '生成中...'
                : estimatedTime
                ? `スケジュール生成 (${estimatedTime})`
                : 'スケジュール生成'}
            </Button>
          </Grid>
        </Grid>
      </form>

      {/* 情報メッセージ */}
      <Box sx={{ mt: 2 }}>
        <Typography variant="caption" color="text.secondary">
          推奨: 2面コート。3面以上は計算時間が増加します。
        </Typography>
      </Box>
    </Paper>
  );
}
