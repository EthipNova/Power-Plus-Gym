import { useCallback, useEffect, useState } from "react";
import { fetchReportCategoryRows, type ReportCategoryRow } from "../services/report-categories";

export function useReportCategories() {
  const [rows, setRows] = useState<ReportCategoryRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setRows(await fetchReportCategoryRows());
    } catch (cause) {
      console.error("Unable to load report categories", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load report categories.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refresh]);

  return { rows, isLoading, error, refresh };
}
