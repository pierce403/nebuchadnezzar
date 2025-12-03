'use client';

import { useEffect, useState } from "react";
import { useApiClient } from "./useApiClient";
import { HealthSnapshot } from "./types";
import { useSettings } from "@/components/settings-context";

export function useHealthPoller(intervalMs?: number) {
  const api = useApiClient();
  const { settings } = useSettings();
  const [entries, setEntries] = useState<HealthSnapshot[]>([]);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    async function poll() {
      while (!cancelled) {
        const ts = new Date();
        const [health, balance, providers] = await Promise.all([
          api.getHealth(),
          api.getBalance(),
          api.getProviders(),
        ]);

        setEntries((prev) => {
          const next = [
            ...prev.slice(-199),
            {
              ts,
              health: health.data,
              balance: balance.data,
              providers: providers.data,
              error: health.error || balance.error || providers.error,
            },
          ];
          return next;
        });

        await new Promise((resolve) =>
          setTimeout(resolve, intervalMs ?? settings.pollIntervalMs),
        );
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [api, intervalMs, settings.pollIntervalMs]);

  return entries;
}
