import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1565c0',
    },
    secondary: {
      main: '#2e7d32',
    },
    success: {
      main: '#4caf50',
    },
    warning: {
      main: '#ff9800',
    },
    error: {
      main: '#f44336',
    },
    background: {
      default: '#fafafa',
    },
  },
  typography: {
    h3: {
      fontSize: '1.75rem',
      '@media (min-width:600px)': {
        fontSize: '2.5rem',
      },
    },
    h6: {
      fontSize: '1.1rem',
      '@media (min-width:600px)': {
        fontSize: '1.25rem',
      },
    },
  },
  components: {
    MuiPaper: {
      defaultProps: {
        elevation: 2,
      },
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          padding: '8px 12px',
          '@media (max-width:600px)': {
            padding: '6px 8px',
            fontSize: '0.8rem',
          },
        },
      },
    },
  },
});

/** 対戦表用カスタムカラー */
export const scheduleColors = {
  teamA: '#e3f2fd',
  teamB: '#fff3e0',
  completedRow: '#bdbdbd',
  completedRowHover: '#b0b0b0',
  rowHover: '#fafafa',
};

export default theme;
