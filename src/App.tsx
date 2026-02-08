import { useState, useCallback, useEffect, useRef } from 'react';
import { Container, Typography, Box, LinearProgress } from '@mui/material';
import { useScheduleGenerator } from './hooks/useScheduleGenerator';
import { ScheduleForm } from './components/ScheduleForm';
import { ScheduleTable } from './components/ScheduleTable';
import { EvaluationDisplay } from './components/EvaluationDisplay';
import { PlayerStatsTable } from './components/PlayerStatsTable';
import { PlayerChangePanel } from './components/PlayerChangePanel';
import type { ScheduleParams, RegenerationParams } from './types/schedule';

function App() {
  const { schedule, isGenerating, progress, error, generate, regenerate, partialSchedule } = useScheduleGenerator();
  const displaySchedule = schedule ?? partialSchedule;
  const [completedMatches, setCompletedMatches] = useState<Set<string>>(new Set());
  const [lastParams, setLastParams] = useState<ScheduleParams | null>(null);
  const [playerChangeOpen, setPlayerChangeOpen] = useState(false);

  // 新規生成か再生成かを区別するためのフラグ
  const isRegenerating = useRef(false);

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

  // 新規生成時のみ消化済み状態をリセット（再生成時は保持）
  useEffect(() => {
    if (isGenerating && !isRegenerating.current) {
      setCompletedMatches(new Set());
    }
  }, [isGenerating]);

  const handleGenerate = useCallback((params: ScheduleParams) => {
    setLastParams(params);
    isRegenerating.current = false;
    generate(params);
  }, [generate]);

  const handleRegenerate = useCallback((params: RegenerationParams) => {
    isRegenerating.current = true;
    regenerate(params);
  }, [regenerate]);

  return (
    <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
      {/* ヘッダー */}
      <Typography variant="h3" component="h1" gutterBottom>
        テニス ダブルス組み合わせ最適化
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        貪欲法アルゴリズムを使用して、公平なダブルスの対戦表を自動生成します
      </Typography>

      {/* 入力フォーム */}
      <ScheduleForm
        onGenerate={handleGenerate}
        isGenerating={isGenerating}
        hasSchedule={!isGenerating && !!schedule && !!lastParams}
        onPlayerChangeClick={() => setPlayerChangeOpen(true)}
      />

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
          {/* 参加者変更ダイアログ */}
          {!isGenerating && schedule && lastParams && (
            <PlayerChangePanel
              open={playerChangeOpen}
              onClose={() => setPlayerChangeOpen(false)}
              schedule={schedule}
              completedRounds={completedMatches}
              isGenerating={isGenerating}
              weights={lastParams.weights}
              onRegenerate={handleRegenerate}
            />
          )}
          {!isGenerating && schedule && (
            <PlayerStatsTable schedule={schedule} />
          )}
        </>
      )}
    </Container>
  );
}

export default App;
