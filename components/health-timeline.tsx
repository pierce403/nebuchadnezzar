import { HealthSnapshot } from "@/lib/types";
import { formatNumber } from "@/lib/utils";
import { StatusPill } from "./status-pill";

interface HealthTimelineProps {
  entries: HealthSnapshot[];
  minMorBalance: number;
}

function statusTone(snapshot: HealthSnapshot, minMorBalance: number) {
  const healthOk = snapshot.health && snapshot.health.status !== "down";
  const morBalance =
    snapshot.balance?.mor?.balance ??
    snapshot.balance?.tokens?.find(
      (t) => t.symbol?.toLowerCase() === "mor",
    )?.balance ??
    0;
  const balanceOk = morBalance >= minMorBalance;
  if (healthOk && balanceOk) return "success";
  if (healthOk || balanceOk) return "warn";
  return "danger";
}

export function HealthTimeline({ entries, minMorBalance }: HealthTimelineProps) {
  return (
    <div className="space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-slate-400">
          Waiting for the first poll. Configure the router on the Settings page.
        </p>
      )}
      {entries
        .slice()
        .reverse()
        .map((entry) => {
          const tone = statusTone(entry, minMorBalance);
          const morBalance =
            entry.balance?.mor?.balance ??
            entry.balance?.tokens?.find(
              (t) => t.symbol?.toLowerCase() === "mor",
            )?.balance;
          return (
            <div
              key={entry.ts.toISOString()}
              className="flex items-center justify-between rounded-lg border border-white/5 bg-slate-900/60 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <StatusPill tone={tone}>
                  {entry.health ? entry.health.status || "online" : "offline"}
                </StatusPill>
                <div className="flex flex-col">
                  <span className="font-medium text-slate-100">
                    {entry.ts.toLocaleTimeString()}
                  </span>
                  <span className="text-xs text-slate-400">
                    Balance: {formatNumber(morBalance, 3)} MOR
                  </span>
                </div>
              </div>
              <div className="text-right text-xs text-slate-400">
                {entry.providers?.length ?? 0} providers ·{" "}
                {entry.error ? (
                  <span className="text-rose-200">{entry.error}</span>
                ) : (
                  "OK"
                )}
              </div>
            </div>
          );
        })}
    </div>
  );
}
