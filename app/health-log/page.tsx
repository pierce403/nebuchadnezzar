'use client';

import { useMemo } from "react";
import { Card } from "@/components/card";
import { HealthTimeline } from "@/components/health-timeline";
import { StatusPill } from "@/components/status-pill";
import { useSettings } from "@/components/settings-context";
import { useHealthPoller } from "@/lib/useHealthPoller";
import { formatNumber } from "@/lib/utils";

export default function HealthLogPage() {
  const { settings } = useSettings();
  const entries = useHealthPoller(settings.pollIntervalMs);

  const latest = useMemo(
    () => (entries.length ? entries[entries.length - 1] : undefined),
    [entries],
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Health log</h1>
        <p className="text-sm text-slate-400">
          Rolling timeline of health, balance, and provider readiness.
        </p>
      </div>

      <Card title="Latest snapshot">
        {latest ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <StatusPill tone={latest.health ? "success" : "danger"}>
              {latest.health?.status || "offline"}
            </StatusPill>
            <span className="text-slate-300">
              {formatNumber(
                latest.balance?.mor?.balance ||
                  latest.balance?.tokens?.find(
                    (t) => t.symbol?.toLowerCase() === "mor",
                  )?.balance,
                3,
              )}{" "}
              MOR
            </span>
            <span className="text-slate-400">
              Providers: {latest.providers?.length ?? 0}
            </span>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            Waiting for the first poll. Make sure the base URL is configured.
          </p>
        )}
      </Card>

      <Card title="Timeline">
        <HealthTimeline
          entries={entries}
          minMorBalance={settings.minMorBalance}
        />
      </Card>
    </div>
  );
}
