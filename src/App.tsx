import { useState, useCallback, useEffect } from 'react';
import { Container, Typography, Box, LinearProgress } from '@mui/material';
import { useScheduleGenerator } from './hooks/useScheduleGenerator';
import { ScheduleForm } from './components/ScheduleForm';
import { ScheduleTable } from './components/ScheduleTable';
import { EvaluationDisplay } from './components/EvaluationDisplay';
import { PlayerStatsTable } from './components/PlayerStatsTable';

function App() {
  const { schedule, isGenerating, progress, error, generate, partialSchedule } = useScheduleGenerator();
  const displaySchedule = schedule ?? partialSchedule;
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
      {/* ヘッダー */}
      <Typography variant="h3" component="h1" gutterBottom>
        テニス ダブルス組み合わせ最適化
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        貪欲法アルゴリズムを使用して、公平なダブルスの対戦表を自動生成します
      </Typography>

      {/* 入力フォーム */}
      <ScheduleForm onGenerate={generate} isGenerating={isGenerating} />

      {/* 進捗付きローディング状態 */}
      {isGenerating && (
        <Box sx={{ my: 4 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {progress
              ? `ラウンド ${progress.currentRound} / ${progress.totalRounds} 生成中 - 評価 ${progress.currentEvaluations.toLocaleString()} / ${progress.totalEvaluations.toLocaleString()} (${progress.percentage}% 完了)`
              : '生成を準備中...'}
          </Typography>
          <LinearProgress
            variant={progress ? 'determinate' : 'indeterminate'}
            value={progress?.percentage || 0}
          />
        </Box>
      )}

      {/* エラー状態 */}
      {error && (
        <Typography color="error" sx={{ my: 2 }}>
          エラー: {error}
        </Typography>
      )}

      {/* 結果 */}
      {displaySchedule && (
        <>
          {!isGenerating && schedule && (
            <EvaluationDisplay evaluation={schedule.evaluation} />
          )}
          <ScheduleTable
            schedule={displaySchedule}
            completedMatches={completedMatches}
            onToggleComplete={handleToggleComplete}
          />
          {!isGenerating && schedule && (
            <PlayerStatsTable schedule={schedule} />
          )}
        </>
      )}
    </Container>
  );
}

export default App;
