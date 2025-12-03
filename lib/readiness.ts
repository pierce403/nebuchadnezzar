import { Settings } from "./settings";
import { Bid, BlockchainBalance, Model, Provider, ReadinessDetails, RouterHealth } from "./types";

interface ReadinessInput {
  health?: RouterHealth;
  balance?: BlockchainBalance;
  providers?: Provider[];
  models?: Model[];
  bids?: Bid[];
  primaryProviderId?: string;
  settings: Settings;
}

function isHealthOk(health?: RouterHealth) {
  if (!health) return false;
  if (health.status) {
    return ["ok", "healthy", "up"].includes(health.status.toLowerCase());
  }
  return (health.uptime ?? health.uptimeSeconds ?? 0) > 0;
}

function isBalanceOk(balance: BlockchainBalance | undefined, minMor: number) {
  if (!balance) return false;
  const morBalance =
    balance.mor?.balance ??
    (balance.tokens || []).find(
      (t) => t.symbol?.toLowerCase() === "mor",
    )?.balance ??
    0;
  return morBalance >= minMor;
}

function findPrimaryProvider(
  providers: Provider[] | undefined,
  primaryId?: string,
  wallet?: string,
) {
  if (!providers || !providers.length) return undefined;
  if (primaryId) {
    const match = providers.find((p) => p.id === primaryId);
    if (match) return match;
  }
  if (wallet) {
    const lower = wallet.toLowerCase();
    const match = providers.find(
      (p) => p.address?.toLowerCase() === lower || p.id?.toLowerCase() === lower,
    );
    if (match) return match;
  }
  return providers[0];
}

export function computeReadiness({
  health,
  balance,
  providers,
  models,
  bids,
  primaryProviderId,
  settings,
}: ReadinessInput): ReadinessDetails {
  const checks: Array<{ ok: boolean; reason: string }> = [];
  const rules = settings.readinessRules;
  const provider = findPrimaryProvider(
    providers,
    primaryProviderId,
    settings.walletAddress,
  );

  if (rules.requireHealth) {
    const ok = isHealthOk(health);
    checks.push({
      ok,
      reason: ok ? "Router healthy" : "Router offline or unhealthy",
    });
  }

  if (rules.requireBalance) {
    const ok = isBalanceOk(balance, settings.minMorBalance);
    checks.push({
      ok,
      reason: ok ? "MOR balance above threshold" : "Low MOR balance",
    });
  }

  if (rules.requireModel) {
    const modelsForProvider = models?.filter(
      (m) => !provider || !m.providerId || m.providerId === provider.id,
    );
    const ok = Boolean(modelsForProvider && modelsForProvider.length > 0);
    checks.push({
      ok,
      reason: ok ? "Model registered" : "No registered models",
    });
  }

  if (rules.requireBid) {
    const hasBids =
      bids?.length ||
      provider?.bids?.length ||
      providers?.some((p) => p.bids && p.bids.length > 0);
    const ok = Boolean(hasBids);
    checks.push({
      ok,
      reason: ok ? "Active bid present" : "No active bids",
    });
  }

  const activeRules = checks.length || 1;
  const passed = checks.filter((c) => c.ok).length;
  const score = Math.round((passed / activeRules) * 100);

  let label: ReadinessDetails["label"] = "Not Ready";
  if (score >= 90) label = "Ready";
  else if (score >= 50) label = "Degraded";

  const reasons = checks.filter((c) => !c.ok).map((c) => c.reason);
  return { score, label, reasons };
}
