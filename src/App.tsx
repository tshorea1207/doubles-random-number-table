import { useState, useCallback, useEffect, useRef } from "react";
import { AppBar, Toolbar, Container, Typography, Box, LinearProgress } from "@mui/material";
import { useScheduleGenerator } from "./hooks/useScheduleGenerator";
import { ScheduleForm } from "./components/ScheduleForm";
import { ScheduleTable } from "./components/ScheduleTable";
import { EvaluationDisplay } from "./components/EvaluationDisplay";
import { PlayerStatsTable } from "./components/PlayerStatsTable";
import { PlayerChangePanel } from "./components/PlayerChangePanel";
import type { ScheduleParams, RegenerationParams } from "./types/schedule";

function App() {
  const { schedule, isGenerating, progress, error, generate, regenerate, partialSchedule, cancel } = useScheduleGenerator();
  const displaySchedule = schedule ?? partialSchedule;
  const [completedMatches, setCompletedMatches] = useState<Set<string>>(new Set());
  const [openedAt, setOpenedAt] = useState<Record<string, Date>>({});
  const [lastParams, setLastParams] = useState<ScheduleParams | null>(null);
  const [playerChangeOpen, setPlayerChangeOpen] = useState(false);

  // 新規生成か再生成かを区別するためのフラグ
  const isRegenerating = useRef(false);

  // ラウンドダイアログ初回オープン時刻を記録
  const handleRoundOpened = useCallback((roundId: string) => {
    setOpenedAt((prev) => {
      if (prev[roundId]) return prev; // 初回のみ記録
      return { ...prev, [roundId]: new Date() };
    });
  }, []);

  // トグルハンドラー
  const handleToggleComplete = useCallback((matchId: string) => {
    setCompletedMatches((prev) => {
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
      setOpenedAt({});
    }
  }, [isGenerating]);

  const handleGenerate = useCallback(
    (params: ScheduleParams) => {
      setLastParams(params);
      isRegenerating.current = false;
      generate(params);
    },
    [generate],
  );

  const handleRegenerate = useCallback(
    (params: RegenerationParams) => {
      isRegenerating.current = true;
      regenerate(params);
    },
    [regenerate],
  );

  const handleAddRound = useCallback(() => {
    if (!schedule || !lastParams) return;
    isRegenerating.current = true;
    regenerate({
      courtsCount: schedule.courts,
      completedRounds: schedule.rounds,
      activePlayers: schedule.activePlayers,
      remainingRoundsCount: 1,
      weights: lastParams.weights,
      fixedPairs: schedule.fixedPairs,
    });
  }, [schedule, lastParams, regenerate]);

  return (
    <>
      {/* ヘッダー */}
      <AppBar position="static" sx={{ borderRadius: 0 }}>
        <Toolbar variant="dense">
          <Typography variant="h6" component="h1" sx={{ fontWeight: "bold" }}>
            ダブルスガチャシミュレータ
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 2, sm: 4 }, px: { xs: 1, sm: 3 } }}>
        {/* 入力フォーム */}
        <ScheduleForm
          onGenerate={handleGenerate}
          onCancel={cancel}
          isGenerating={isGenerating}
          hasSchedule={!isGenerating && !!schedule && !!lastParams}
          onPlayerChangeClick={() => setPlayerChangeOpen(true)}
        />

        {/* 進捗付きローディング状態 */}
        <Box sx={{ my: 4, visibility: isGenerating ? "visible" : "hidden" }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {progress
              ? `ラウンド ${progress.currentRound} / ${progress.totalRounds} 生成中 - 評価 ${progress.currentEvaluations.toLocaleString()} / ${progress.totalEvaluations.toLocaleString()} (${progress.percentage}% 完了)`
              : "生成を準備中..."}
          </Typography>
          <LinearProgress key={String(isGenerating)} variant={progress ? "determinate" : "indeterminate"} value={progress?.percentage || 0} />
        </Box>

        {/* エラー状態 */}
        {error && (
          <Typography color="error" sx={{ my: 2 }}>
            エラー: {error}
          </Typography>
        )}

        {/* 結果 */}
        {displaySchedule && (
          <>
            <ScheduleTable
              schedule={displaySchedule}
              completedMatches={completedMatches}
              onToggleComplete={handleToggleComplete}
              onAddRound={!isGenerating && schedule && lastParams ? handleAddRound : undefined}
              openedAt={openedAt}
              onRoundOpened={handleRoundOpened}
            />
            {schedule && (
              <Box sx={{ visibility: isGenerating ? "hidden" : "visible" }}>
                <EvaluationDisplay evaluation={schedule.evaluation} />
              </Box>
            )}
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
            {schedule && (
              <Box sx={{ visibility: isGenerating ? "hidden" : "visible" }}>
                <PlayerStatsTable schedule={schedule} />
              </Box>
            )}
          </>
        )}
      </Container>
    </>
  );
}

export default App;
