import { useMemo, useState } from "react";
import { ApiResult, Bid, Model, Provider } from "@/lib/types";
import { cn, formatNumber, shortAddress } from "@/lib/utils";
import { Card } from "./card";
import { StatusPill } from "./status-pill";

interface ProvidersTableProps {
  providers: Provider[];
  models?: Model[];
  fetchBids?: (providerId: string) => Promise<ApiResult<Bid[]>>;
  primaryWallet?: string;
  loading?: boolean;
  error?: string | null;
}

export function ProvidersTable({
  providers,
  models,
  fetchBids,
  primaryWallet,
  loading,
  error,
}: ProvidersTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [bids, setBids] = useState<Record<string, Bid[]>>({});
  const [loadingBids, setLoadingBids] = useState<Record<string, boolean>>({});
  const [bidError, setBidError] = useState<string | null>(null);

  const walletLower = primaryWallet?.toLowerCase();

  const providersSorted = useMemo(
    () =>
      [...providers].sort((a, b) => {
        if (walletLower && a.address?.toLowerCase() === walletLower) return -1;
        if (walletLower && b.address?.toLowerCase() === walletLower) return 1;
        return (b.stake || 0) - (a.stake || 0);
      }),
    [providers, walletLower],
  );

  const handleExpand = async (provider: Provider) => {
    if (expanded === provider.id) {
      setExpanded(null);
      return;
    }
    setExpanded(provider.id);
    if (!fetchBids || bids[provider.id]) return;
    setLoadingBids((prev) => ({ ...prev, [provider.id]: true }));
    setBidError(null);
    const response = await fetchBids(provider.id);
    if (response.ok && response.data) {
      setBids((prev) => ({ ...prev, [provider.id]: response.data! }));
    } else {
      setBidError(response.error || "Unable to load bids");
    }
    setLoadingBids((prev) => ({ ...prev, [provider.id]: false }));
  };

  return (
    <Card
      title="Providers"
      description="Registered providers with stakes, models, and bids."
    >
      {error && (
        <div className="mb-3 rounded-md bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          {error}
        </div>
      )}
      <div className="overflow-hidden rounded-lg border border-white/5">
        <table className="w-full text-left text-sm text-slate-200">
          <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">Provider</th>
              <th className="px-4 py-3">Stake</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Models</th>
              <th className="px-4 py-3">Bids</th>
              <th className="px-4 py-3 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {providersSorted.map((provider) => {
              const providerModels =
                models?.filter((m) => m.providerId === provider.id) ||
                provider.models ||
                [];
              const providerBids = bids[provider.id] || provider.bids || [];
              const isPrimary =
                provider.address?.toLowerCase() === walletLower ||
                provider.id?.toLowerCase() === walletLower;
              return (
                <tr
                  key={provider.id}
                  className={cn(
                    "bg-slate-900/40",
                    expanded === provider.id ? "bg-slate-900/70" : "",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-50">
                        {shortAddress(provider.address || provider.id)}
                      </span>
                      {isPrimary && (
                        <StatusPill tone="info" className="ml-1">
                          Primary
                        </StatusPill>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {formatNumber(provider.stake ?? 0, 3)} MOR
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill
                      tone={
                        provider.active || provider.isRegistered
                          ? "success"
                          : "warn"
                      }
                    >
                      {provider.active || provider.isRegistered
                        ? "Registered"
                        : "Inactive"}
                    </StatusPill>
                  </td>
                  <td className="px-4 py-3">{providerModels.length}</td>
                  <td className="px-4 py-3">{providerBids.length}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      className="text-sm text-sky-300 hover:text-sky-200"
                      onClick={() => handleExpand(provider)}
                    >
                      {expanded === provider.id ? "Hide" : "Inspect"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {!providers.length && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-slate-400"
                >
                  {loading
                    ? "Loading providers..."
                    : "No providers returned by the router."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {providersSorted.map((provider) => {
        if (expanded !== provider.id) return null;
        const providerModels =
          models?.filter((m) => m.providerId === provider.id) ||
          provider.models ||
          [];
        const providerBids = bids[provider.id] || provider.bids || [];
        return (
          <div
            key={`${provider.id}-details`}
            className="mt-4 rounded-lg border border-white/10 bg-slate-950/40 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-slate-100">
                  Provider {shortAddress(provider.address || provider.id, 6)}
                </h4>
                <p className="text-sm text-slate-400">
                  Stake {formatNumber(provider.stake ?? 0, 3)} MOR
                </p>
              </div>
              {loadingBids[provider.id] && (
                <span className="text-xs text-slate-400">Loading bids…</span>
              )}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-md border border-white/5 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">
                    Models
                  </span>
                  <span className="text-xs text-slate-400">
                    {providerModels.length} total
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  {providerModels.length === 0 && (
                    <p className="text-slate-400">No models registered.</p>
                  )}
                  {providerModels.map((model) => (
                    <div
                      key={model.id}
                      className="rounded border border-white/5 bg-slate-900/70 px-2 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-50">
                          {model.id}
                        </span>
                        <StatusPill tone="info">
                          Stake {formatNumber(model.stake ?? 0, 3)} MOR
                        </StatusPill>
                      </div>
                      <p className="text-xs text-slate-400">
                        Fee {formatNumber(model.feePerSecond ?? 0, 6)} / sec
                      </p>
                      {model.tags && model.tags.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1 text-[11px] text-slate-300">
                          {model.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded bg-slate-800 px-2 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-white/5 bg-white/5 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-100">
                    Bids
                  </span>
                  <span className="text-xs text-slate-400">
                    {providerBids.length} total
                  </span>
                </div>
                {bidError && (
                  <p className="text-xs text-rose-200">{bidError}</p>
                )}
                <div className="space-y-2 text-sm">
                  {providerBids.length === 0 && (
                    <p className="text-slate-400">No active bids.</p>
                  )}
                  {providerBids.map((bid) => (
                    <div
                      key={bid.id}
                      className="rounded border border-white/5 bg-slate-900/70 px-2 py-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-50">
                          {bid.modelId || bid.id}
                        </span>
                        <StatusPill tone="success">
                          {formatNumber(bid.pricePerSecond ?? 0, 6)} / sec
                        </StatusPill>
                      </div>
                      {bid.status && (
                        <p className="text-xs text-slate-400">{bid.status}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
