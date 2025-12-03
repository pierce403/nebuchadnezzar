'use client';

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/card";
import { HealthSummary } from "@/components/health-summary";
import { StatusPill } from "@/components/status-pill";
import { useSettings } from "@/components/settings-context";
import { useApiClient } from "@/lib/useApiClient";
import { computeReadiness } from "@/lib/readiness";
import {
  Bid,
  BlockchainBalance,
  Model,
  Provider,
  RouterHealth,
} from "@/lib/types";
import { formatNumber, formatUptime, shortAddress } from "@/lib/utils";

export default function Home() {
  const { settings, hydrated } = useSettings();
  const api = useApiClient();
  const [health, setHealth] = useState<RouterHealth | undefined>(undefined);
  const [balance, setBalance] = useState<BlockchainBalance | undefined>(
    undefined,
  );
  const [providers, setProviders] = useState<Provider[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [bids, setBids] = useState<Bid[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [setupStatus, setSetupStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [setupOutput, setSetupOutput] = useState<string | null>(null);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      setError(null);
      const [healthRes, balanceRes, providersRes, modelsRes] =
        await Promise.all([
          api.getHealth(),
          api.getBalance(),
          api.getProviders(),
          api.getModels(),
        ]);

      if (cancelled) return;

      if (!healthRes.ok || !balanceRes.ok || !providersRes.ok || !modelsRes.ok) {
        setError(
          healthRes.error ||
            balanceRes.error ||
            providersRes.error ||
            modelsRes.error ||
            "Unable to reach proxy router.",
        );
      }

      setHealth(healthRes.data);
      setBalance(balanceRes.data);
      setProviders(providersRes.data || []);
      setModels(modelsRes.data || []);

      const primary = selectPrimaryProvider(
        providersRes.data || [],
        settings.walletAddress,
      );
      if (primary) {
        const bidsRes = await api.getProviderBids(primary.id);
        if (!cancelled) {
          if (bidsRes.ok) {
            setBids(bidsRes.data || []);
          } else {
            setError((prev) => prev || bidsRes.error || null);
          }
        }
      } else {
        setBids([]);
      }
      setLoading(false);
    };

    fetchData();
    const interval = setInterval(
      fetchData,
      Math.max(10000, settings.pollIntervalMs),
    );
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [api, settings.pollIntervalMs, settings.walletAddress]);

  const primaryProvider = useMemo(
    () => selectPrimaryProvider(providers, settings.walletAddress),
    [providers, settings.walletAddress],
  );

  const readiness = computeReadiness({
    health,
    balance,
    providers,
    models,
    bids,
    primaryProviderId: primaryProvider?.id,
    settings,
  });

  const morBalance =
    balance?.mor?.balance ??
    balance?.tokens?.find((t) => t.symbol?.toLowerCase() === "mor")?.balance ??
    0;

  const ethBalance =
    balance?.eth?.balance ??
    balance?.tokens?.find((t) => t.symbol?.toLowerCase() === "eth")?.balance ??
    undefined;

  const runSetup = async () => {
    setSetupStatus("running");
    setSetupOutput(null);
    try {
      const res = await fetch("/api/setup", { method: "POST" });
      const data = await res.json();
      setSetupOutput(data?.output || "");
      setSetupStatus(data?.ok ? "success" : "error");
    } catch (err) {
      setSetupStatus("error");
      setSetupOutput(
        err instanceof Error ? err.message : "Setup failed unexpectedly.",
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-50">
            DGX Proxy Router
          </h1>
          <p className="text-sm text-slate-400">
            Health, readiness, and balance snapshot for Morpheus / Lumerin.
          </p>
        </div>
        <StatusPill tone={api ? "success" : "warn"}>
          {settings.baseUrl || "Set base URL in Settings"}
        </StatusPill>
      </div>

      {!hydrated && (
        <Card className="bg-slate-900/60 text-sm text-slate-300">
          Loading settings…
        </Card>
      )}

      {hydrated && (
        <>
          {hydrated && !loading && (!health || health.status === "Offline") && (
            <Card
              className="border-amber-500/40 bg-amber-500/10"
              title="Health check failed"
              description="Follow these steps to get the dashboard working:"
            >
              <ul className="space-y-1 text-sm text-amber-100">
                <li>1) Confirm the proxy router is running and bound to {settings.baseUrl || "your configured host"}.</li>
                <li>2) Open Settings and verify the base URL, port, and any basic auth match the router.</li>
                <li>3) If running locally, ensure the process listens on the same interface (e.g., localhost).</li>
                <li>4) Click “Run setup & verify” below to auto-install deps and try starting the proxy router locally.</li>
                <li>5) Restart the router service, then refresh this page.</li>
              </ul>
            </Card>
          )}

          <Card
            className="border border-white/10 bg-slate-900/60"
            title="Setup & diagnostics"
            description="Auto-install dependencies, copy .env defaults, and check the router health endpoint."
          >
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={runSetup}
                  disabled={setupStatus === "running"}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {setupStatus === "running"
                    ? "Running setup..."
                    : "Run setup & verify"}
                </button>
                {setupStatus === "success" && (
                  <StatusPill tone="success">Setup complete</StatusPill>
                )}
                {setupStatus === "error" && (
                  <StatusPill tone="danger">Setup encountered issues</StatusPill>
                )}
                {setupStatus === "idle" && (
                  <StatusPill tone="warn">Awaiting setup</StatusPill>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Runs <code>setup.sh</code> in this project. Full log is saved to <code>logs/setup.log</code>.
              </p>
              {setupOutput && (
                <pre className="max-h-64 overflow-auto rounded-md border border-white/10 bg-slate-950 p-3 text-xs text-slate-100">
                  {setupOutput}
                </pre>
              )}
            </div>
          </Card>

          <HealthSummary
            readiness={readiness}
            health={health}
            balance={balance}
            provider={primaryProvider}
            models={models.filter(
              (m) => !primaryProvider || m.providerId === primaryProvider.id,
            )}
            bids={bids}
            minMorBalance={settings.minMorBalance}
            walletAddress={settings.walletAddress}
          />

          {error && (
            <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            <Card
              className="lg:col-span-2"
              title="Wallet & Tokens"
              description="Balances returned by /blockchain/balance."
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <BalanceRow
                  label="MOR"
                  value={morBalance}
                  threshold={settings.minMorBalance}
                />
                <BalanceRow label="ETH (Arbitrum)" value={ethBalance} />
              </div>
              {balance?.allowance && (
                <div className="mt-3 text-sm text-slate-300">
                  Allowance:{" "}
                  {balance.allowance.approved ? (
                    <StatusPill tone="success">Approved</StatusPill>
                  ) : (
                    <StatusPill tone="warn">Not approved</StatusPill>
                  )}
                  {balance.allowance.amount !== undefined && (
                    <span className="ml-2 text-slate-400">
                      {formatNumber(balance.allowance.amount, 3)}
                    </span>
                  )}
                </div>
              )}
            </Card>

            <Card
              title="Router"
              description="Healthcheck and uptime from /healthcheck."
            >
              <div className="flex items-center justify-between text-sm">
                <StatusPill tone={health ? "success" : "danger"}>
                  {health?.status || "Offline"}
                </StatusPill>
                <span className="text-slate-300">
                  {formatUptime(
                    health?.uptimeSeconds ??
                      (health?.uptime ? Number(health.uptime) : undefined),
                  )}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Version: {health?.version || "unknown"}
              </p>
            </Card>
          </div>

          <Card
            title="Primary provider"
            description="Stake, models, and bids for your provider wallet."
          >
            {primaryProvider ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-slate-100">
                      {shortAddress(
                        primaryProvider.address || primaryProvider.id,
                        6,
                      )}
                    </p>
                    <p className="text-xs text-slate-400">
                      Stake {formatNumber(primaryProvider.stake ?? 0, 3)} MOR
                    </p>
                  </div>
                  <StatusPill
                    tone={
                      primaryProvider.isRegistered || primaryProvider.active
                        ? "success"
                        : "warn"
                    }
                  >
                    {primaryProvider.isRegistered || primaryProvider.active
                      ? "Registered"
                      : "Not registered"}
                  </StatusPill>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  <InfoBlock
                    label="Models"
                    value={
                      models.filter(
                        (m) => m.providerId === primaryProvider.id,
                      ).length || primaryProvider.models?.length || 0
                    }
                  />
                  <InfoBlock label="Bids" value={bids.length} />
                  <InfoBlock label="Status" value={primaryProvider.status} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">
                No provider matched the configured wallet. Set one in Settings.
              </p>
            )}
          </Card>
        </>
      )}

      {loading && (
        <p className="text-sm text-slate-400">Refreshing router metrics…</p>
      )}
    </div>
  );
}

function selectPrimaryProvider(
  providers: Provider[],
  wallet?: string,
): Provider | undefined {
  if (!providers.length) return undefined;
  if (!wallet) return providers[0];
  const lower = wallet.toLowerCase();
  return (
    providers.find(
      (p) =>
        p.address?.toLowerCase() === lower || p.id?.toLowerCase() === lower,
    ) || providers[0]
  );
}

function BalanceRow({
  label,
  value,
  threshold,
}: {
  label: string;
  value?: number;
  threshold?: number;
}) {
  const tone =
    threshold !== undefined && value !== undefined && value < threshold
      ? "warn"
      : "success";
  return (
    <div className="rounded-lg border border-white/5 bg-slate-950/40 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <StatusPill tone={value === undefined ? "warn" : tone}>
          {value !== undefined ? `${formatNumber(value, 4)}` : "Unknown"}
        </StatusPill>
      </div>
      {threshold !== undefined && (
        <p className="mt-1 text-xs text-slate-500">
          Min {formatNumber(threshold, 3)}
        </p>
      )}
    </div>
  );
}

function InfoBlock({
  label,
  value,
}: {
  label: string;
  value?: string | number;
}) {
  return (
    <div className="rounded-md border border-white/5 bg-slate-950/50 p-2">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-lg font-semibold text-slate-50">
        {value ?? "—"}
      </p>
    </div>
  );
}
