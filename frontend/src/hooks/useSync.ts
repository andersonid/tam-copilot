import { useState, useCallback } from "react";
import api from "../services/api";

type SyncDomain = "entitlements" | "contacts" | "clusters" | "cases" | "lifecycle" | "all";

interface SyncResult {
  synced: number;
  domain: string;
  account_id: number;
  results?: Record<string, number>;
}

/**
 * Hook for triggering on-demand sync from Red Hat APIs.
 * Returns the trigger function, loading state, and last result.
 */
export function useSync(accountId: number | null) {
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const triggerSync = useCallback(
    async (domain: SyncDomain) => {
      if (!accountId) return;
      setSyncing(true);
      setError(null);
      try {
        const { data } = await api.post<SyncResult>(
          `/v1/accounts/${accountId}/sync/${domain}`
        );
        setLastResult(data);
        return data;
      } catch (err: any) {
        const msg = err.response?.data?.detail || err.message || "Sync failed";
        setError(msg);
        return null;
      } finally {
        setSyncing(false);
      }
    },
    [accountId]
  );

  return { triggerSync, syncing, lastResult, error };
}
