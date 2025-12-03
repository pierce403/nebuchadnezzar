'use client';

import { useEffect, useState } from "react";
import { Card } from "@/components/card";
import { StatusPill } from "@/components/status-pill";
import { useSettings } from "@/components/settings-context";
import { useApiClient } from "@/lib/useApiClient";
import { RouterConfig, RouterHealth } from "@/lib/types";
import { formatUptime } from "@/lib/utils";

export default function RouterPage() {
  const api = useApiClient();
  const { settings } = useSettings();
  const [health, setHealth] = useState<RouterHealth | undefined>();
  const [config, setConfig] = useState<RouterConfig | null>(null);
  const [lumerinConfig, setLumerinConfig] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!api) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [healthRes, configRes, lumerinRes] = await Promise.all([
        api.getHealth(),
        api.getConfig(),
        api.getUnderlyingLumerinConfig(),
      ]);

      if (cancelled) return;

      if (!healthRes.ok) setError((prev) => prev || healthRes.error || null);
      if (!configRes.ok) setError((prev) => prev || configRes.error || null);
      if (!lumerinRes.ok) setError((prev) => prev || lumerinRes.error || null);

      setHealth(healthRes.data);
      setConfig(configRes.data || null);
      setLumerinConfig(lumerinRes.data || null);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [api]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Router detail</h1>
        <p className="text-sm text-slate-400">
          Health and configuration pulled from /healthcheck and /config.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Healthcheck" description="Response from /healthcheck">
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
          {health?.version && (
            <p className="mt-2 text-sm text-slate-300">
              Version {health.version}
            </p>
          )}
          {health?.message && (
            <p className="mt-1 text-xs text-slate-400">{health.message}</p>
          )}
        </Card>

        <Card
          title="Morpheus router config"
          description={settings.configUrl || `${settings.baseUrl}/config`}
        >
          <ConfigGrid config={config} />
        </Card>
      </div>

      <Card
        title="Underlying Lumerin Router Config"
        description={settings.lumerinConfigUrl}
      >
        {lumerinConfig ? (
          <pre className="overflow-auto rounded-md bg-slate-950/60 p-3 text-xs text-slate-200">
            {JSON.stringify(lumerinConfig, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">
            {loading ? "Loading underlying config..." : "No config returned."}
          </p>
        )}
      </Card>

      <Card title="Raw JSON" description="Full /config payload for debugging.">
        {config ? (
          <pre className="overflow-auto rounded-md bg-slate-950/60 p-3 text-xs text-slate-200">
            {JSON.stringify(config, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-slate-400">
            {loading ? "Loading configuration…" : "No configuration received."}
          </p>
        )}
      </Card>
    </div>
  );
}

function ConfigGrid({ config }: { config: RouterConfig | null }) {
  if (!config) {
    return <p className="text-sm text-slate-400">No config returned.</p>;
  }
  const summary = [
    { label: "Host", value: config.host },
    { label: "Port", value: config.port },
    { label: "Network", value: config.network || config.environment },
    { label: "Mode", value: config.mode },
    { label: "Chain ID", value: config.chainId },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {summary.map((item) => (
        <div
          key={item.label}
          className="rounded-md border border-white/5 bg-slate-950/60 p-3"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">
            {item.label}
          </p>
          <p className="text-sm font-semibold text-slate-100">
            {item.value ?? "—"}
          </p>
        </div>
      ))}
    </div>
  );
}
