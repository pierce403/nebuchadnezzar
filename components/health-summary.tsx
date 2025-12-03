import { BlockchainBalance, Bid, Model, Provider, ReadinessDetails, RouterHealth } from "@/lib/types";
import { formatNumber, formatUptime } from "@/lib/utils";
import { Card } from "./card";
import { StatusPill } from "./status-pill";

interface HealthSummaryProps {
  readiness: ReadinessDetails;
  health?: RouterHealth;
  balance?: BlockchainBalance;
  provider?: Provider;
  models?: Model[];
  bids?: Bid[];
  minMorBalance: number;
}

function readinessTone(label: ReadinessDetails["label"]) {
  switch (label) {
    case "Ready":
      return "success";
    case "Degraded":
      return "warn";
    default:
      return "danger";
  }
}

function morBalance(balance?: BlockchainBalance) {
  return (
    balance?.mor?.balance ??
    balance?.tokens?.find((t) => t.symbol?.toLowerCase() === "mor")
      ?.balance ??
    0
  );
}

export function HealthSummary({
  readiness,
  health,
  balance,
  provider,
  models,
  bids,
  minMorBalance,
}: HealthSummaryProps) {
  const tone = readinessTone(readiness.label);
  const isOnline = Boolean(health && (health.status || health.uptime));
  const mor = morBalance(balance);
  const activeModels = models?.length ?? provider?.models?.length ?? 0;
  const activeBids =
    bids?.length ?? provider?.bids?.length ?? 0;

  return (
    <Card
      title="Readiness"
      description="Quick view of router health, balance, and advertised models/bids."
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-bold text-slate-50">
              {readiness.score}%
            </span>
            <StatusPill tone={tone}>{readiness.label}</StatusPill>
          </div>
          {readiness.reasons.length > 0 && (
            <ul className="mt-2 text-sm text-slate-300">
              {readiness.reasons.map((r) => (
                <li key={r} className="flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                  {r}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="h-2 flex-1 rounded-full bg-slate-800">
          <div
            className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-sky-500 transition-all"
            style={{ width: `${readiness.score}%` }}
            aria-label={`Readiness ${readiness.score}%`}
          />
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card
          className="bg-slate-900/40"
          title="Router"
          description={health?.version || "Unknown version"}
        >
          <div className="flex items-center justify-between text-sm">
            <StatusPill tone={isOnline ? "success" : "danger"}>
              {isOnline ? "Online" : "Offline"}
            </StatusPill>
            <span className="text-slate-300">
              {formatUptime(
                health?.uptimeSeconds ??
                  (health?.uptime ? Number(health.uptime) : undefined),
              )}
            </span>
          </div>
        </Card>

        <Card
          className="bg-slate-900/40"
          title="MOR Balance"
          description={`Min ${formatNumber(minMorBalance, 2)} MOR`}
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-lg font-semibold text-slate-50">
              {formatNumber(mor, 3)} MOR
            </span>
            <StatusPill tone={mor >= minMorBalance ? "success" : "warn"}>
              {mor >= minMorBalance ? "Healthy" : "Low"}
            </StatusPill>
          </div>
        </Card>

        <Card
          className="bg-slate-900/40"
          title="Models"
          description="Registered under this provider"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-lg font-semibold text-slate-50">
              {activeModels}
            </span>
            <StatusPill tone={activeModels > 0 ? "success" : "warn"}>
              {activeModels > 0 ? "Advertised" : "Missing"}
            </StatusPill>
          </div>
        </Card>

        <Card
          className="bg-slate-900/40"
          title="Bids"
          description="Active bids for provider"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-lg font-semibold text-slate-50">
              {activeBids}
            </span>
            <StatusPill tone={activeBids > 0 ? "success" : "warn"}>
              {activeBids > 0 ? "Active" : "None"}
            </StatusPill>
          </div>
        </Card>
      </div>
    </Card>
  );
}
