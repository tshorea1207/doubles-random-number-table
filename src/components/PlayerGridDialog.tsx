import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
} from "@mui/material";

interface PlayerGridDialogProps {
  open: boolean;
  swapTarget: number | null;
  activePlayers: number[];
  onSwap: (fromPlayer: number, toPlayer: number) => void;
  onClose: () => void;
}

export function PlayerGridDialog({ open, swapTarget, activePlayers, onSwap, onClose }: PlayerGridDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>変更先を選択</DialogTitle>
      <DialogContent>
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 1, pt: 0.5 }}>
          {activePlayers.map((p) => (
            <Button
              key={p}
              variant={p === swapTarget ? "contained" : "outlined"}
              disabled={p === swapTarget}
              onClick={() => onSwap(swapTarget!, p)}
              sx={{ minWidth: 48, minHeight: 48, fontSize: "1.2rem", fontWeight: 700 }}
            >
              {p}
            </Button>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>キャンセル</Button>
      </DialogActions>
    </Dialog>
  );
}
