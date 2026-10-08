import { useCallback, useEffect, useState } from "react";
import { fetchPayments, type PaymentPage } from "../services/payments";

export function usePayments(search: string, status: string, method: string) {
  const [page, setPage] = useState(0);
  const [result, setResult] = useState<PaymentPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      setResult(await fetchPayments({ search, status, method, page }));
    } catch (cause) {
      console.error("Unable to load payments", cause);
      setError(cause instanceof Error ? cause.message : "Unable to load payments.");
    } finally {
      setIsLoading(false);
    }
  }, [method, page, search, status]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(0);
  }, [method, search, status]);

  return {
    payments: result?.payments ?? [],
    total: result?.total ?? 0,
    paidRevenue: result?.paidRevenue ?? 0,
    page,
    pageSize: 25,
    isLoading,
    error,
    refresh,
    setPage,
  };
}
