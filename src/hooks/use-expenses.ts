import { useCallback, useEffect, useState } from "react";
import { fetchExpenses, type ExpensePage } from "../services/expenses";

export function useExpenses(search: string, category: string) {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<ExpensePage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setResult(await fetchExpenses({ search, category, page }));
    } catch (cause) {
      console.error("Unable to load expenses", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load expenses.");
    } finally {
      setIsLoading(false);
    }
  }, [category, page, search]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(0);
  }, [category, search]);

  return {
    expenses: result?.expenses ?? [],
    total: result?.total ?? 0,
    totalAmount: result?.totalAmount ?? 0,
    page,
    pageSize: 25,
    isLoading,
    error,
    refresh,
    setPage,
  };
}
