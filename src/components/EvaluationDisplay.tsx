import { Box, Typography, Chip, Paper } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { Evaluation } from '../types/schedule';

interface EvaluationDisplayProps {
  evaluation: Evaluation;
}

export function EvaluationDisplay({ evaluation }: EvaluationDisplayProps) {
  const isIdeal = evaluation.pairStdDev === 0 && evaluation.oppoStdDev === 0;

  // 総合スコアに基づいて品質の色を決定
  const getQualityColor = (score: number): string => {
    if (score < 0.5) return '#4caf50'; // 緑 - 優秀
    if (score < 1.0) return '#ff9800'; // オレンジ - 良好
    return '#f44336'; // 赤 - 要改善
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        評価結果
      </Typography>

      {isIdeal && (
        <Chip
          icon={<CheckCircleIcon />}
          label="理想解！"
          color="success"
          sx={{ mb: 2 }}
        />
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
        {/* ペア回数の標準偏差 */}
        <Box>
          <Typography variant="body2" color="text.secondary">
            ペア回数の標準偏差
          </Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>
            {evaluation.pairStdDev.toFixed(4)}
          </Typography>
        </Box>

        {/* 対戦回数の標準偏差 */}
        <Box>
          <Typography variant="body2" color="text.secondary">
            対戦回数の標準偏差
          </Typography>
          <Typography variant="h6" sx={{ mt: 1 }}>
            {evaluation.oppoStdDev.toFixed(4)}
          </Typography>
        </Box>

        {/* 総合スコア */}
        <Box>
          <Typography variant="body2" color="text.secondary">
            総合評価スコア
          </Typography>
          <Typography
            variant="h6"
            sx={{ mt: 1, color: getQualityColor(evaluation.totalScore) }}
          >
            {evaluation.totalScore.toFixed(4)}
          </Typography>
        </Box>
      </Box>

      {/* 説明 */}
      <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          値が小さいほど公平な組み合わせです。理想解は両方の標準偏差が 0 になります。
        </Typography>
      </Box>
    </Paper>
  );
}
