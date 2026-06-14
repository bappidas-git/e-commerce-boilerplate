import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import apiService from "../services/api";
import { normalizeDealsConfig, DEFAULT_DEALS_CONFIG } from "../utils/dealsConfig";

// =============================================================================
// DealsConfigContext
// =============================================================================
// Single shared source for the admin-managed Special Offers configuration on the
// storefront. The nav (Header / SidebarMenu / Footer) reads `enabled` to show or
// hide the "Today's Deals" entry, and the Special Offers page reads the full
// `config`. Like the category menu, it refetches when the tab regains focus so
// changes the admin makes appear without a hard reload.
// =============================================================================

const DealsConfigContext = createContext({
  config: DEFAULT_DEALS_CONFIG,
  enabled: true,
  loading: true,
  refresh: () => {},
});

export const useDealsConfig = () => useContext(DealsConfigContext);

export const DealsConfigProvider = ({ children }) => {
  const [config, setConfig] = useState(DEFAULT_DEALS_CONFIG);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const raw = await apiService.deals.getConfig();
      if (mountedRef.current) setConfig(normalizeDealsConfig(raw));
    } catch (error) {
      console.error("Failed to load deals config:", error);
      // Leave the last-known (or default) config in place rather than breaking
      // the nav/page.
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      mountedRef.current = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const value = {
    config,
    enabled: config.enabled !== false,
    loading,
    refresh: load,
  };

  return (
    <DealsConfigContext.Provider value={value}>
      {children}
    </DealsConfigContext.Provider>
  );
};
