import { useState } from 'react';
import { Box, Typography, Chip, Paper, Collapse, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import type { Evaluation } from '../types/schedule';

interface EvaluationDisplayProps {
  evaluation: Evaluation;
}

export function EvaluationDisplay({ evaluation }: EvaluationDisplayProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const isIdeal = evaluation.pairStdDev === 0 && evaluation.oppoStdDev === 0 && evaluation.restStdDev === 0;
  const hasRestingPlayers = evaluation.restStdDev > 0;

  const getQualityColor = (score: number): string => {
    if (score < 0.5) return theme.palette.success.main;
    if (score < 1.0) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      {/* ヘッダー行: 常時表示 */}
      <Box
        sx={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="h6" sx={{ flex: 1 }}>
          評価結果
        </Typography>

        {isIdeal && (
          <Chip
            icon={<CheckCircleIcon />}
            label="理想解！"
            color="success"
            size="small"
            sx={{ mr: 2 }}
          />
        )}

        <Box sx={{
          borderLeft: 3,
          borderColor: getQualityColor(evaluation.totalScore),
          pl: 1.5,
          mr: 1,
        }}>
          <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.2 }}>
            総合スコア
          </Typography>
          <Typography
            variant="h6"
            sx={{ color: getQualityColor(evaluation.totalScore), lineHeight: 1.2 }}
          >
            {evaluation.totalScore.toFixed(4)}
          </Typography>
        </Box>

        <IconButton size="small" aria-label={expanded ? '詳細を閉じる' : '詳細を表示'}>
          {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        </IconButton>
      </Box>

      {/* 展開時: 詳細指標 */}
      <Collapse in={expanded}>
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', sm: hasRestingPlayers ? 'repeat(4, 1fr)' : 'repeat(3, 1fr)' },
          gap: 2,
          mt: 2,
          pt: 2,
          borderTop: 1,
          borderColor: 'divider',
        }}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              ペア回数の標準偏差
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {evaluation.pairStdDev.toFixed(4)}
            </Typography>
          </Box>

          <Box>
            <Typography variant="body2" color="text.secondary">
              対戦回数の標準偏差
            </Typography>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {evaluation.oppoStdDev.toFixed(4)}
            </Typography>
          </Box>

          {hasRestingPlayers && (
            <Box>
              <Typography variant="body2" color="text.secondary">
                休憩回数の標準偏差
              </Typography>
              <Typography variant="h6" sx={{ mt: 1 }}>
                {evaluation.restStdDev.toFixed(4)}
              </Typography>
            </Box>
          )}

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

        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            値が小さいほど公平な組み合わせです。理想解は両方の標準偏差が 0 になります。
          </Typography>
        </Box>
      </Collapse>
    </Paper>
  );
}
