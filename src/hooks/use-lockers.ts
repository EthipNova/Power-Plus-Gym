import { useCallback, useEffect, useState } from "react";
import { fetchLockerData, type LockerData } from "../services/lockers";

export function useLockers() {
  const [data, setData] = useState<LockerData>({ lockers: [], assignments: [], customers: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setData(await fetchLockerData()); }
    catch (cause) { console.error("Unable to load lockers", cause); setError(cause instanceof Error ? cause.message : "Unable to load lockers."); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);
  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === "visible") void refresh(); };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.removeEventListener("focus", onVisible); document.removeEventListener("visibilitychange", onVisible); };
  }, [refresh]);

  return { ...data, isLoading, error, refresh };
}
