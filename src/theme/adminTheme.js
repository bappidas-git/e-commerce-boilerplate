import { createTheme, alpha } from "@mui/material/styles";

// =============================================================================
// Admin design system — professional, flat, minimal.
//
// The storefront theme (ThemeContext) is intentionally playful: 12-16px radii,
// gradient buttons, hover lifts, glassmorphism. The admin panel uses this
// dedicated theme instead: a restrained indigo/slate palette, 6px controls /
// 8px surfaces, hairline borders, soft tinted status badges, and uppercase
// table headers. AdminLayout and AdminLogin mount it via <ThemeProvider>, so
// nothing here leaks into the storefront.
// =============================================================================

// Status hues shared by the soft chip variants (light text on dark, deep text
// on light, with a translucent tint behind — the "badge" look used by modern
// dashboards instead of solid pill chips).
const CHIP_TONES = {
  light: {
    default: { fg: "#475569", bg: "rgba(100, 116, 139, 0.12)" },
    primary: { fg: "#4338ca", bg: "rgba(79, 70, 229, 0.10)" },
    secondary: { fg: "#475569", bg: "rgba(100, 116, 139, 0.12)" },
    success: { fg: "#047857", bg: "rgba(5, 150, 105, 0.12)" },
    warning: { fg: "#b45309", bg: "rgba(217, 119, 6, 0.12)" },
    error: { fg: "#b91c1c", bg: "rgba(220, 38, 38, 0.10)" },
    info: { fg: "#1d4ed8", bg: "rgba(37, 99, 235, 0.10)" },
  },
  dark: {
    default: { fg: "#cbd5e1", bg: "rgba(148, 163, 184, 0.16)" },
    primary: { fg: "#a5b4fc", bg: "rgba(129, 140, 248, 0.16)" },
    secondary: { fg: "#cbd5e1", bg: "rgba(148, 163, 184, 0.16)" },
    success: { fg: "#6ee7b7", bg: "rgba(52, 211, 153, 0.14)" },
    warning: { fg: "#fcd34d", bg: "rgba(251, 191, 36, 0.14)" },
    error: { fg: "#fca5a5", bg: "rgba(248, 113, 113, 0.14)" },
    info: { fg: "#93c5fd", bg: "rgba(96, 165, 250, 0.14)" },
  },
};

const buildAdminTheme = (mode) => {
  const dark = mode === "dark";
  const tones = CHIP_TONES[dark ? "dark" : "light"];

  const palette = {
    mode,
    primary: {
      main: dark ? "#818cf8" : "#4f46e5",
      dark: dark ? "#6366f1" : "#4338ca",
      light: dark ? "#a5b4fc" : "#6366f1",
      contrastText: "#ffffff",
    },
    secondary: { main: dark ? "#94a3b8" : "#64748b" },
    success: { main: dark ? "#34d399" : "#059669" },
    warning: { main: dark ? "#fbbf24" : "#d97706" },
    error: { main: dark ? "#f87171" : "#dc2626" },
    info: { main: dark ? "#60a5fa" : "#2563eb" },
    background: {
      default: dark ? "#0b1220" : "#f8fafc",
      paper: dark ? "#111927" : "#ffffff",
    },
    divider: dark ? "rgba(148, 163, 184, 0.16)" : "#e2e8f0",
    text: {
      primary: dark ? "#f1f5f9" : "#0f172a",
      secondary: dark ? "#94a3b8" : "#64748b",
      disabled: dark ? "#64748b" : "#94a3b8",
    },
    action: {
      hover: dark ? "rgba(148, 163, 184, 0.08)" : "rgba(15, 23, 42, 0.04)",
      selected: dark ? "rgba(129, 140, 248, 0.16)" : "rgba(79, 70, 229, 0.08)",
    },
  };

  // One soft-badge override per chip color, for both filled and outlined.
  const chipColorOverrides = Object.fromEntries(
    Object.entries(tones).flatMap(([key, tone]) => {
      const cap = key.charAt(0).toUpperCase() + key.slice(1);
      return [
        [`filled${cap}`, { backgroundColor: tone.bg, color: tone.fg }],
        [`outlined${cap}`, { borderColor: alpha(tone.fg, 0.4), color: tone.fg }],
      ];
    })
  );

  return createTheme({
    palette,
    shape: { borderRadius: 6 },
    typography: {
      fontFamily:
        '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", sans-serif',
      button: { textTransform: "none", fontWeight: 600 },
      // Match the compact heading scale the admin pages were laid out against
      // (the storefront theme used the same sizes).
      h4: { fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.01em" },
      h5: { fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" },
      h6: { fontSize: "1rem", fontWeight: 600 },
      subtitle2: { fontWeight: 600 },
    },
    components: {
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: 6,
            boxShadow: "none",
            "&:hover": { boxShadow: "none", transform: "none" },
          },
          containedPrimary: {
            "&:hover": { backgroundColor: palette.primary.dark },
          },
          outlined: {
            borderColor: palette.divider,
            "&:hover": {
              borderColor: dark ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
              backgroundColor: palette.action.hover,
            },
          },
          sizeSmall: {
            padding: "4px 12px",
            // compact on desktop, comfortably tappable on phones
            "@media (max-width: 768px)": { minHeight: 40 },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: { backgroundImage: "none" },
          rounded: { borderRadius: 8 },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
            border: `1px solid ${palette.divider}`,
            boxShadow: "0 1px 2px rgba(15, 23, 42, 0.05)",
            "&:hover": { transform: "none" },
          },
        },
      },
      MuiDialog: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            border: dark ? `1px solid ${palette.divider}` : "none",
            backgroundImage: "none",
          },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            border: `1px solid ${palette.divider}`,
            boxShadow: dark
              ? "0 8px 24px rgba(0, 0, 0, 0.4)"
              : "0 8px 24px rgba(15, 23, 42, 0.08)",
          },
        },
      },
      MuiMenu: {
        styleOverrides: {
          paper: {
            borderRadius: 8,
            border: `1px solid ${palette.divider}`,
            boxShadow: dark
              ? "0 8px 24px rgba(0, 0, 0, 0.4)"
              : "0 8px 24px rgba(15, 23, 42, 0.08)",
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: { borderRadius: 4, fontWeight: 600 },
          ...chipColorOverrides,
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 6,
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: dark ? "rgba(148, 163, 184, 0.4)" : "#cbd5e1",
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: palette.primary.main,
              borderWidth: "1.5px",
            },
          },
          notchedOutline: { borderColor: palette.divider },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: { borderColor: palette.divider },
          head: {
            fontWeight: 600,
            fontSize: "0.72rem",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: palette.text.secondary,
            whiteSpace: "nowrap",
            backgroundColor: dark ? "rgba(148, 163, 184, 0.04)" : "#f8fafc",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: { root: { borderRadius: 6 } },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundImage: "none" },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: { boxShadow: "none", backgroundImage: "none" },
        },
      },
      // Small icon buttons (table row actions) keep their compact desktop
      // density but stay tappable (≥40px) on touch-sized screens.
      MuiIconButton: {
        styleOverrides: {
          sizeSmall: {
            "@media (max-width: 768px)": {
              padding: 11,
            },
          },
        },
      },
      MuiSkeleton: {
        styleOverrides: { rounded: { borderRadius: 8 } },
      },
    },
  });
};

export default buildAdminTheme;
