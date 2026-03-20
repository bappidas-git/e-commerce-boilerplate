// =============================================================================
// API Base URL Configuration
// =============================================================================
//
// TO SWITCH FROM JSON SERVER TO PRODUCTION LARAVEL API:
// ======================================================
//   1. In .env, set: REACT_APP_API_URL=https://your-laravel-api.com/api/v1
//   2. In .env, set: REACT_APP_USE_MOCK_API=false
//   3. Restart the dev server.
//
// That's it. No other code changes required.
// =============================================================================

// Development / Mock API URL (JSON Server)
export const MOCK_API_URL = "http://localhost:3001";

// Determine which URL to use
const getBaseURL = () => {
  if (process.env.REACT_APP_USE_MOCK_API === "true") {
    return MOCK_API_URL;
  }
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  if (process.env.NODE_ENV === "development") {
    return MOCK_API_URL;
  }
  return process.env.REACT_APP_API_URL || MOCK_API_URL;
};

const BASE_URL = getBaseURL();

// Flag to detect mock API (JSON Server) mode
export const IS_MOCK_API =
  BASE_URL === MOCK_API_URL ||
  process.env.REACT_APP_USE_MOCK_API === "true";

export const API_VERSION = "v1";

if (process.env.NODE_ENV === "development") {
  console.log(`[API] Mode: ${IS_MOCK_API ? "JSON Server (Mock)" : "Production API"}`);
  console.log(`[API] Base URL: ${BASE_URL}`);
}

export default BASE_URL;
