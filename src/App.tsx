import { useState, useCallback, useEffect } from 'react';
import { Container, Typography, Box, LinearProgress } from '@mui/material';
import { useScheduleGenerator } from './hooks/useScheduleGenerator';
import { ScheduleForm } from './components/ScheduleForm';
import { ScheduleTable } from './components/ScheduleTable';
import { EvaluationDisplay } from './components/EvaluationDisplay';
import { PlayerStatsTable } from './components/PlayerStatsTable';

function App() {
  const { schedule, isGenerating, progress, error, generate } = useScheduleGenerator();
  const [completedMatches, setCompletedMatches] = useState<Set<string>>(new Set());

  // トグルハンドラー
  const handleToggleComplete = useCallback((matchId: string) => {
    setCompletedMatches(prev => {
      const newSet = new Set(prev);
      if (newSet.has(matchId)) {
        newSet.delete(matchId);
      } else {
        newSet.add(matchId);
      }
      return newSet;
    });
  }, []);

  // 生成開始時に消化済み状態をリセット
  useEffect(() => {
    if (isGenerating) {
      setCompletedMatches(new Set());
    }
  }, [isGenerating]);

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header */}
      <Typography variant="h3" component="h1" gutterBottom>
        テニス ダブルス組み合わせ最適化
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        貪欲法アルゴリズムを使用して、公平なダブルスの対戦表を自動生成します
      </Typography>

      {/* Input Form */}
      <ScheduleForm onGenerate={generate} isGenerating={isGenerating} />

      {/* Loading State with Progress */}
      {isGenerating && (
        <Box sx={{ my: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {progress
              ? `評価 ${progress.currentEvaluations.toLocaleString()} / ${progress.totalEvaluations.toLocaleString()} (${progress.percentage}% 完了)`
              : '生成を準備中...'}
          </Typography>
          <LinearProgress
            variant={progress ? 'determinate' : 'indeterminate'}
            value={progress?.percentage || 0}
          />
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          エラー: {error}
        </Typography>
      )}

      {/* Results */}
      {schedule && !isGenerating && (
        <>
          <EvaluationDisplay evaluation={schedule.evaluation} />
          <ScheduleTable
            schedule={schedule}
            completedMatches={completedMatches}
            onToggleComplete={handleToggleComplete}
          />
          <PlayerStatsTable schedule={schedule} />
        </>
      )}
    </Container>
  );
}

export default App;
