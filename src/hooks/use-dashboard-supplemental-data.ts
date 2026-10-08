import { useCallback, useEffect, useState } from "react";
import {
  fetchMemberCategoryBreakdown,
  fetchFinancialTrend,
  fetchSteamDashboardData,
  type MemberCategoryBreakdown,
  type FinancialTrendPoint,
  type SteamDashboardData,
} from "../services/dashboard";

export function useDashboardSupplementalData() {
  const [steam, setSteam] = useState<SteamDashboardData | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<MemberCategoryBreakdown[] | null>(null);
  const [financialTrend, setFinancialTrend] = useState<FinancialTrendPoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trendError, setTrendError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setTrendError(null);

    const [steamResult, categoryResult, trendResult] = await Promise.allSettled([
      fetchSteamDashboardData(),
      fetchMemberCategoryBreakdown(),
      fetchFinancialTrend(),
    ]);

    if (steamResult.status === "fulfilled") setSteam(steamResult.value);
    if (categoryResult.status === "fulfilled") setCategoryBreakdown(categoryResult.value);
    if (trendResult.status === "fulfilled") setFinancialTrend(trendResult.value);

    const rejected = [steamResult, categoryResult].find(result => result.status === "rejected");
    if (rejected?.status === "rejected") {
      const cause = rejected.reason;
      console.error("Unable to load dashboard supplemental data", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load dashboard activity.");
    }
    if (trendResult.status === "rejected") {
      console.error("Unable to load dashboard financial trend", trendResult.reason);
      setTrendError(trendResult.reason instanceof Error ? trendResult.reason.message : "Unable to load financial trend.");
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    const refreshInterval = window.setInterval(() => void refresh(), 30_000);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.clearInterval(refreshInterval);
    };
  }, [refresh]);

  return { steam, categoryBreakdown, financialTrend, isLoading, error, trendError, refresh };
}