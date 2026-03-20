// =====================================================================
// GLOBAL COLOR THEME — Edit this file to restyle the entire storefront
// =====================================================================
// All colors used by the front-end come from here. The admin panel uses
// its own hardcoded palette and is NOT affected by changes to this file.
//
// HOW TO USE:
//   1. Change the hex values below.
//   2. Save the file — hot-reload picks up the changes instantly in dev.
//   3. Rebuild for production: `npm run build`.
// =====================================================================

// ---------------------
// LIGHT MODE PALETTE
// ---------------------
export const LIGHT = {
  // Primary brand color — used for buttons, links, active states
  primary: {
    main:  "#667eea",
    light: "#8b9af3",
    dark:  "#4c5ed0",
  },
  // Secondary accent color — used for badges, chips, secondary buttons
  secondary: {
    main:  "#f093fb",
    light: "#f4b3fc",
    dark:  "#d673e0",
  },
  // Page and component backgrounds
  background: {
    default: "#f5f7fa",
    paper:   "#ffffff",
  },
  // Text colors
  text: {
    primary:   "#1a202c",
    secondary: "#4a5568",
  },
  // Gradient used for contained buttons, hero section, etc.
  gradient: {
    primary:        "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    primaryReverse: "linear-gradient(135deg, #764ba2 0%, #667eea 100%)",
    // Hero background gradient
    hero: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)",
  },
  // Body background applied on initial HTML load (before React mounts)
  bodyBackground: "linear-gradient(135deg, #f5f7fa 0%, #ffffff 100%)",
};

// ---------------------
// DARK MODE PALETTE
// ---------------------
export const DARK = {
  primary: {
    main:  "#a855f7",
    light: "#c084fc",
    dark:  "#9333ea",
  },
  secondary: {
    main:  "#ec4899",
    light: "#f472b6",
    dark:  "#db2777",
  },
  background: {
    default: "#0a0e27",
    paper:   "#1a1f3a",
  },
  text: {
    primary:   "#f5f7fa",
    secondary: "#a0aec0",
  },
  gradient: {
    primary:        "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
    primaryReverse: "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
    hero: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
  },
  bodyBackground: "linear-gradient(135deg, #0a0e27 0%, #1a1f3a 100%)",
};
