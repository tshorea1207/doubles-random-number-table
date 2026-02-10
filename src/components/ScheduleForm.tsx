import { useState, useEffect, FormEvent } from "react";
import {
  Box,
  Slider,
  Button,
  Typography,
  Paper,
  Grid,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Badge,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import GroupIcon from "@mui/icons-material/Group";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import type { ScheduleParams, FixedPair } from "../types/schedule";
import { useBenchmarkCalibration } from "../hooks/useBenchmarkCalibration";
import { FixedPairsInput } from "./FixedPairsInput";
import { validateFixedPairs } from "../utils/fixedPairs";

interface ScheduleFormProps {
  onGenerate: (params: ScheduleParams) => void;
  onCancel: () => void;
  isGenerating: boolean;
  hasSchedule?: boolean;
  onPlayerChangeClick?: () => void;
}

export function ScheduleForm({ onGenerate, onCancel, isGenerating, hasSchedule, onPlayerChangeClick }: ScheduleFormProps) {
  const [courts, setCourts] = useState(4);
  const [players, setPlayers] = useState(16);
  const [rounds, setRounds] = useState(15);
  const [w1, setW1] = useState(1.0);
  const [w2, setW2] = useState(0.5);
  const [w3, setW3] = useState(2.0);
  const [fixedPairs, setFixedPairs] = useState<FixedPair[]>([]);
  const [helpTarget, setHelpTarget] = useState<"w1" | "w2" | "w3" | null>(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [fixedPairsOpen, setFixedPairsOpen] = useState(false);

  // ハードウェア性能に基づく動的キャリブレーション係数
  const { coefficient } = useBenchmarkCalibration();

  // 参加人数変更時に無効な固定ペアを削除
  useEffect(() => {
    const validPairs = fixedPairs.filter((fp) => fp.player1 <= players && fp.player2 <= players);
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
  const errorMessage = !playersValid ? `参加人数は ${courts * 4} 人以上が必要です` : "";

  // 休憩者数の計算
  const restingCount = Math.max(0, players - courts * 4);
  const restingMessage = restingCount > 0 ? `毎ラウンド ${restingCount} 人が休憩` : "";

  // 設定に基づいて生成時間を推定
  const estimateTime = (): string => {
    if (!isValid) return "";

    const baseComplexity = Math.pow(players / 4, courts * 1.5);
    const roundFactor = Math.max(rounds - 1, 1);

    let seconds = baseComplexity * roundFactor * coefficient;

    if (seconds < 1) {
      return "< 1秒";
    } else if (seconds < 60) {
      return `約${Math.round(seconds)}秒`;
    } else if (seconds < 300) {
      const minutes = Math.round(seconds / 60);
      return `約${minutes}分`;
    } else {
      return "5分以上";
    }
  };

  const estimatedTime = estimateTime();

  return (
    <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 3 }}>
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: { xs: 1, sm: 2 } }}>
        <Typography variant="h6">スケジュール設定</Typography>
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
          <Tooltip title="参加者の変更">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<PersonAddIcon />}
                onClick={onPlayerChangeClick}
                disabled={!hasSchedule || isGenerating}
                sx={{
                  minWidth: { xs: "auto", sm: undefined },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  参加者の変更
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title={fixedPairs.length > 0 ? `固定ペア (${fixedPairs.length}組)` : "固定ペア"}>
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={
                  fixedPairs.length > 0 ? (
                    <Badge badgeContent={fixedPairs.length} color="primary">
                      <GroupIcon />
                    </Badge>
                  ) : (
                    <GroupIcon />
                  )
                }
                onClick={() => setFixedPairsOpen(true)}
                disabled={isGenerating}
                sx={{
                  minWidth: { xs: "auto", sm: undefined },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  {fixedPairs.length > 0 ? `固定ペア (${fixedPairs.length}組)` : "固定ペア"}
                </Box>
              </Button>
            </span>
          </Tooltip>
          <Tooltip title="詳細設定">
            <span>
              <Button
                variant="outlined"
                size="small"
                startIcon={<TuneIcon />}
                onClick={() => setAdvancedOpen(true)}
                disabled={isGenerating}
                sx={{
                  minWidth: { xs: "auto", sm: undefined },
                  "& .MuiButton-startIcon": { mr: { xs: 0, sm: 1 } },
                }}
              >
                <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
                  詳細設定
                </Box>
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={{ xs: 2, sm: 3 }}>
          {/* コート数 */}
          <Grid item xs={6} sm={4} order={{ xs: 1, sm: 1 }}>
            <Typography gutterBottom>コート数: {courts}</Typography>
            <Slider
              value={courts}
              onChange={(_, value) => setCourts(value as number)}
              min={1}
              max={8}
              step={1}
              marks={[
                { value: 1, label: "1" },
                { value: 2, label: "2" },
                { value: 4, label: "4" },
                { value: 8, label: "8" },
              ]}
              valueLabelDisplay="auto"
              disabled={isGenerating}
            />
          </Grid>

          {/* ラウンド数 */}
          <Grid item xs={6} sm={4} order={{ xs: 2, sm: 3 }}>
            <Typography gutterBottom>ラウンド数: {rounds}</Typography>
            <Slider
              value={rounds}
              onChange={(_, value) => setRounds(value as number)}
              min={1}
              max={20}
              step={1}
              marks={[
                { value: 1, label: "1" },
                { value: 5, label: "5" },
                { value: 10, label: "10" },
                { value: 20, label: "20" },
              ]}
              valueLabelDisplay="auto"
              disabled={isGenerating}
            />
          </Grid>

          {/* 参加人数 */}
          <Grid item xs={12} sm={4} order={{ xs: 3, sm: 2 }}>
            <Typography gutterBottom>参加人数: {players}</Typography>
            <Slider
              value={players}
              onChange={(_, value) => setPlayers(value as number)}
              min={4}
              max={32}
              step={1}
              marks={[
                { value: 4, label: "4" },
                { value: 8, label: "8" },
                { value: 16, label: "16" },
                { value: 32, label: "32" },
              ]}
              valueLabelDisplay="auto"
              disabled={isGenerating}
            />
            {errorMessage && (
              <Typography variant="caption" color="error">
                {errorMessage}
              </Typography>
            )}
            {!errorMessage && restingMessage && (
              <Typography variant="caption" color="text.secondary">
                {restingMessage}
              </Typography>
            )}
          </Grid>

          {/* 送信ボタン */}
          <Grid item xs={12} order={4}>
            {isGenerating ? (
              <Button type="button" variant="contained" color="error" size="large" fullWidth onClick={onCancel}>
                生成停止
              </Button>
            ) : (
              <Button type="submit" variant="contained" color="primary" size="large" fullWidth disabled={!isValid}>
                {estimatedTime ? `スケジュール生成 (${estimatedTime})` : "スケジュール生成"}
              </Button>
            )}
          </Grid>
        </Grid>
      </form>

      {/* 固定ペアダイアログ */}
      <Dialog open={fixedPairsOpen} onClose={() => setFixedPairsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>固定ペア設定</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1 }}>
            <FixedPairsInput playersCount={players} courtsCount={courts} fixedPairs={fixedPairs} onChange={setFixedPairs} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setFixedPairsOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 詳細設定ダイアログ */}
      <Dialog open={advancedOpen} onClose={() => setAdvancedOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>詳細設定</DialogTitle>
        <DialogContent>
          {/* 重み W1 */}
          <Box sx={{ mt: 1, mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W1 (ペア回数): {w1.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w1")} aria-label="W1の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w1}
              onChange={(_, value) => setW1(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 1, label: "1.0" },
                { value: 10, label: "10" },
              ]}
            />
          </Box>

          {/* 重み W2 */}
          <Box sx={{ mb: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W2 (対戦回数): {w2.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w2")} aria-label="W2の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w2}
              onChange={(_, value) => setW2(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 0.5, label: "0.5" },
                { value: 10, label: "10" },
              ]}
            />
          </Box>

          {/* 重み W3 */}
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center" }}>
              <Typography gutterBottom sx={{ mb: 0 }}>
                重み W3 (休憩回数): {w3.toFixed(1)}
              </Typography>
              <IconButton size="small" onClick={() => setHelpTarget("w3")} aria-label="W3の説明を表示" sx={{ ml: 0.5 }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Box>
            <Slider
              value={w3}
              onChange={(_, value) => setW3(value as number)}
              min={0.1}
              max={10}
              step={0.1}
              marks={[
                { value: 0.1, label: "0.1" },
                { value: 2, label: "2.0" },
                { value: 10, label: "10" },
              ]}
              disabled={restingCount === 0}
            />
            {restingCount === 0 && (
              <Typography variant="caption" color="text.secondary">
                休憩者がいないため無効です
              </Typography>
            )}
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
            計算式: 総合スコア = ペア偏差×W1 + 対戦偏差×W2 + 休憩偏差×W3
            <br />
            スコアが小さいほど公平な組み合わせです。
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAdvancedOpen(false)}>閉じる</Button>
        </DialogActions>
      </Dialog>

      {/* 重み解説ダイアログ */}
      <Dialog open={helpTarget !== null} onClose={() => setHelpTarget(null)}>
        <DialogTitle>
          {helpTarget === "w1" && "W1（ペア回数）について"}
          {helpTarget === "w2" && "W2（対戦回数）について"}
          {helpTarget === "w3" && "W3（休憩回数）について"}
        </DialogTitle>
        <DialogContent>
          {helpTarget === "w1" && (
            <Typography>
              同じ人とペアを組む回数の偏りをどれだけ重視するかを設定します。
              値を大きくすると、全員がなるべく均等にペアを組むことが優先されます。
              <br />
              <br />
              推奨値: 1.0
            </Typography>
          )}
          {helpTarget === "w2" && (
            <Typography>
              同じ人と対戦する回数の偏りをどれだけ重視するかを設定します。
              値を大きくすると、全員がなるべく均等に対戦することが優先されます。
              <br />
              <br />
              推奨値: 0.5
            </Typography>
          )}
          {helpTarget === "w3" && (
            <Typography>
              休憩する回数の偏りをどれだけ重視するかを設定します。 値を大きくすると、全員がなるべく均等に休憩することが優先されます。
              <br />
              <br />
              ※参加人数がコート数×4と等しい場合は休憩者がいないため無効です。
              <br />
              <br />
              推奨値: 2.0
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHelpTarget(null)}>閉じる</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
