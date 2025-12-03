'use client';

import { useEffect, useState } from "react";
import { ProvidersTable } from "@/components/providers-table";
import { useSettings } from "@/components/settings-context";
import { useApiClient } from "@/lib/useApiClient";
import { Model, Provider } from "@/lib/types";

export default function ProvidersPage() {
  const api = useApiClient();
  const { settings } = useSettings();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [providersRes, modelsRes] = await Promise.all([
        api.getProviders(),
        api.getModels(),
      ]);
      if (cancelled) return;
      if (!providersRes.ok || !modelsRes.ok) {
        setError(
          providersRes.error ||
            modelsRes.error ||
            "Failed to load providers.",
        );
      }
      setProviders(providersRes.data || []);
      setModels(modelsRes.data || []);
      setLoading(false);
    };
    load();
    const interval = setInterval(load, Math.max(15000, settings.pollIntervalMs));
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api, settings.pollIntervalMs]);

  const fetchBids = async (providerId: string) => {
    if (!api) return { ok: false, error: "API not configured" };
    return api.getProviderBids(providerId);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Providers</h1>
        <p className="text-sm text-slate-400">
          Providers, models, and bids as returned by the proxy router.
        </p>
      </div>

      <ProvidersTable
        providers={providers}
        models={models}
        fetchBids={fetchBids}
        primaryWallet={settings.walletAddress}
        loading={loading}
        error={error}
      />
    </div>
  );
}
