import { Container, Typography, Box, CircularProgress } from '@mui/material';
import { useScheduleGenerator } from './hooks/useScheduleGenerator';
import { ScheduleForm } from './components/ScheduleForm';
import { ScheduleTable } from './components/ScheduleTable';
import { EvaluationDisplay } from './components/EvaluationDisplay';
import { PlayerStatsTable } from './components/PlayerStatsTable';

function App() {
  const { schedule, isGenerating, error, generate } = useScheduleGenerator();

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

      {/* Loading State */}
      {isGenerating && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
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
          <ScheduleTable schedule={schedule} />
          <PlayerStatsTable schedule={schedule} />
        </>
      )}
    </Container>
  );
}

export default App;
