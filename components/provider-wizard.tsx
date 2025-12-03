'use client';

import { useMemo, useState } from "react";
import { Card } from "@/components/card";
import { StatusPill } from "@/components/status-pill";
import { BlockchainBalance, Bid, Model, Provider, RouterHealth } from "@/lib/types";
import { formatNumber, formatUptime, shortAddress } from "@/lib/utils";

type StepTone = "success" | "warn" | "danger";
type StepKey = "router" | "approve" | "provider" | "model" | "bid";

interface ProviderWizardProps {
  baseUrl?: string;
  username?: string;
  password?: string;
  walletAddress?: string;
  health?: RouterHealth;
  balance?: BlockchainBalance;
  provider?: Provider;
  models?: Model[];
  bids?: Bid[];
  minMorBalance: number;
}

interface StepState {
  status: "idle" | "running" | "success" | "error";
  message?: string;
}

const DEFAULTS = {
  spender: "0xDE819AaEE474626E3f34Ef0263373357e5a6C71b",
  approveAmountMor: 0.6,
  providerStakeMor: 0.2,
  modelStakeMor: 0.1,
  modelFeeMor: 0,
  bidPriceMorPerSec: 0.00000001,
  modelName: "DGX LLM",
};

function isHealthOk(health?: RouterHealth) {
  if (!health) return false;
  if (health.status) {
    return ["ok", "healthy", "up"].includes(health.status.toLowerCase());
  }
  return (health.uptime ?? health.uptimeSeconds ?? 0) > 0;
}

export function ProviderWizard({
  baseUrl,
  username,
  password,
  walletAddress,
  health,
  balance,
  provider,
  models = [],
  bids = [],
  minMorBalance,
}: ProviderWizardProps) {
  const [endpoint, setEndpoint] = useState("your.public.ip.or.dns:3333");
  const [spender, setSpender] = useState(DEFAULTS.spender);
  const [approveAmount, setApproveAmount] = useState(DEFAULTS.approveAmountMor);
  const [providerStake, setProviderStake] = useState(DEFAULTS.providerStakeMor);
  const [modelStake, setModelStake] = useState(DEFAULTS.modelStakeMor);
  const [modelFee, setModelFee] = useState(DEFAULTS.modelFeeMor);
  const [bidPrice, setBidPrice] = useState(DEFAULTS.bidPriceMorPerSec);
  const [modelName, setModelName] = useState(DEFAULTS.modelName);
  const [modelId, setModelId] = useState<string>(randomModelId());
  const [ipfsCid, setIpfsCid] = useState(
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  );
  const [log, setLog] = useState<string>("");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>({
    router: { status: "idle" },
    approve: { status: "idle" },
    provider: { status: "idle" },
    model: { status: "idle" },
    bid: { status: "idle" },
  });

  const morBalance =
    balance?.mor?.balance ??
    balance?.tokens?.find((t) => t.symbol?.toLowerCase() === "mor")?.balance ??
    0;
  const ethBalance =
    balance?.eth?.balance ??
    balance?.tokens?.find((t) => t.symbol?.toLowerCase() === "eth")?.balance ??
    0;

  const modelsForProvider = provider
    ? models.filter((m) => m.providerId?.toLowerCase() === provider.id?.toLowerCase())
    : [];
  const swaggerUrl = baseUrl ? `${baseUrl}/swagger/index.html` : undefined;
  const healthOk = isHealthOk(health);

  const checklist: Array<{
    title: string;
    tone: StepTone;
    detail: string;
  }> = [
    {
      title: "Router reachable",
      tone: healthOk ? "success" : "danger",
      detail: healthOk
        ? `Healthy (${formatUptime(
            health?.uptimeSeconds ??
              (health?.uptime ? Number(health.uptime) : undefined),
          )})`
        : "No /healthcheck response — run setup & verify.",
    },
    {
      title: "Wallet funded",
      tone: morBalance >= minMorBalance && ethBalance > 0 ? "success" : "warn",
      detail: `MOR: ${formatNumber(morBalance, 4)} (min ${formatNumber(minMorBalance, 3)}); ETH (for gas): ${formatNumber(ethBalance, 4)}`,
    },
    {
      title: "Provider registered",
      tone: provider ? "success" : "warn",
      detail: provider
        ? shortAddress(provider.address || provider.id || "", 6)
        : "No provider found for this wallet.",
    },
    {
      title: "Model registered",
      tone: modelsForProvider.length > 0 ? "success" : "warn",
      detail: `${modelsForProvider.length} models for provider`,
    },
    {
      title: "Active bid",
      tone: bids.length > 0 ? "success" : "warn",
      detail: bids.length > 0 ? `${bids.length} bids` : "No bids for this provider.",
    },
  ];

  const statusTone = useMemo(
    () =>
      ({
        idle: "warn",
        running: "warn",
        success: "success",
        error: "danger",
      }) as const,
    [],
  );

  const setStep = (key: StepKey, next: StepState) =>
    setSteps((prev) => ({ ...prev, [key]: next }));

  function authHeaders() {
    if (!username) return undefined;
    const token = btoa(`${username}:${password || ""}`);
    return { Authorization: `Basic ${token}` };
  }

  async function callRouter(
    path: string,
    init?: RequestInit,
  ): Promise<{ ok: boolean; data?: unknown; error?: string }> {
    if (!baseUrl) return { ok: false, error: "Set base URL in Settings first." };
    try {
      const res = await fetch(`${baseUrl}${path}`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(init?.headers || {}),
          ...(authHeaders() || {}),
        },
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        return { ok: false, error: text || `HTTP ${res.status}` };
      }
      const data = await res.json().catch(() => null);
      return { ok: true, data };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Network error" };
    }
  }

  function weiFromMor(amount: number) {
    const scaled = Math.round(amount * 1e9); // support up to 9 decimals
    return (BigInt(scaled) * 1_000_000_000n).toString();
  }

  async function startRouter() {
    setStep("router", { status: "running", message: "Starting router…" });
    try {
      const res = await fetch("/api/router/start", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
      if (!data.ok) {
        setStep("router", { status: "error", message: data.error || "Failed to start" });
      } else {
        setStep("router", { status: "success", message: data.message || "Router started" });
      }
    } catch (err) {
      setStep("router", {
        status: "error",
        message: err instanceof Error ? err.message : "Failed to start router",
      });
    }
  }

  async function runFullSetup() {
    setLog("");
    await startApprove();
    await startProvider();
    await startModel();
    await startBid();
  }

  async function startApprove() {
    setStep("approve", { status: "running", message: "Approving spend…" });
    const amountWei = weiFromMor(approveAmount);
    const qs = new URLSearchParams({ spender, amount: amountWei }).toString();
    const res = await callRouter(`/blockchain/approve?${qs}`, { method: "POST" });
    if (!res.ok) {
      setStep("approve", { status: "error", message: res.error });
      appendLog(`Approve failed: ${res.error}`);
    } else {
      setStep("approve", { status: "success", message: "Approved spend" });
      appendLog(`Approve success: ${approveAmount} MOR to ${spender}`);
    }
  }

  async function startProvider() {
    setStep("provider", { status: "running", message: "Registering provider…" });
    const body = JSON.stringify({
      addStake: weiFromMor(providerStake),
      Stake: weiFromMor(providerStake),
      endpoint,
    });
    const res = await callRouter("/blockchain/providers", {
      method: "POST",
      body,
    });
    if (!res.ok) {
      setStep("provider", { status: "error", message: res.error });
      appendLog(`Provider failed: ${res.error}`);
    } else {
      setStep("provider", { status: "success", message: "Provider registered" });
      appendLog(`Provider registered at ${endpoint}`);
    }
  }

  async function startModel() {
    setStep("model", { status: "running", message: "Registering model…" });
    const body = JSON.stringify({
      modelId,
      ipfsCID: ipfsCid,
      IpfsID: ipfsCid,
      addStake: weiFromMor(modelStake),
      Stake: weiFromMor(modelStake),
      fee: weiFromMor(modelFee),
      Fee: weiFromMor(modelFee),
      name: modelName,
      tags: ["LLM"],
      owner: walletAddress,
    });
    const res = await callRouter("/blockchain/models", { method: "POST", body });
    if (!res.ok) {
      setStep("model", { status: "error", message: res.error });
      appendLog(`Model failed: ${res.error}`);
    } else {
      setStep("model", { status: "success", message: "Model registered" });
      appendLog(`Model registered: ${modelId}`);
    }
  }

  async function startBid() {
    setStep("bid", { status: "running", message: "Creating bid…" });
    const body = JSON.stringify({
      modelID: modelId,
      pricePerSecond: weiFromMor(bidPrice),
    });
    const res = await callRouter("/blockchain/bids", { method: "POST", body });
    if (!res.ok) {
      setStep("bid", { status: "error", message: res.error });
      appendLog(`Bid failed: ${res.error}`);
    } else {
      setStep("bid", { status: "success", message: "Bid created" });
      appendLog(`Bid created for model ${modelId}`);
    }
  }

  function appendLog(line: string) {
    setLog((prev) => `${prev ? `${prev}\n` : ""}${line}`);
  }

  return (
    <Card
      className="border border-white/10 bg-slate-900/60"
      title="Provider wizard"
      description="Checklist and one-shot actions to get this DGX serving the Morpheus / Lumerin network."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <span>Wallet</span>
          <StatusPill tone={walletAddress ? "success" : "warn"}>
            {walletAddress ? shortAddress(walletAddress, 6) : "Set wallet in Settings"}
          </StatusPill>
          {swaggerUrl && (
            <a
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-emerald-300 hover:border-emerald-500 hover:text-emerald-200"
              href={swaggerUrl}
              target="_blank"
              rel="noreferrer"
            >
              Open Swagger
            </a>
          )}
          <button
            type="button"
            onClick={startRouter}
            className="rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-500 hover:text-emerald-200"
          >
            Start router
          </button>
          {steps.router.message && (
            <StatusPill tone={statusTone[steps.router.status]}>
              {steps.router.message}
            </StatusPill>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <LabeledInput
            label="Public endpoint (provider)"
            value={endpoint}
            onChange={setEndpoint}
            placeholder="ip.or.dns:3333"
          />
          <LabeledInput label="Approve spender" value={spender} onChange={setSpender} />
          <LabeledInput
            label="Approve amount (MOR)"
            type="number"
            value={approveAmount}
            onChangeNumber={setApproveAmount}
            step="0.1"
          />
          <LabeledInput
            label="Provider stake (MOR)"
            type="number"
            value={providerStake}
            onChangeNumber={setProviderStake}
            step="0.1"
          />
          <LabeledInput
            label="Model stake (MOR)"
            type="number"
            value={modelStake}
            onChangeNumber={setModelStake}
            step="0.1"
          />
          <LabeledInput
            label="Model fee (MOR)"
            type="number"
            value={modelFee}
            onChangeNumber={setModelFee}
            step="0.01"
          />
          <LabeledInput
            label="Bid price per second (MOR)"
            type="number"
            value={bidPrice}
            onChangeNumber={setBidPrice}
            step="0.00000001"
          />
          <LabeledInput label="Model name" value={modelName} onChange={setModelName} />
          <LabeledInput
            label="Model ID (32-byte hex)"
            value={modelId}
            onChange={setModelId}
            rightAction={{ label: "Random", onClick: () => setModelId(randomModelId()) }}
          />
          <LabeledInput
            label="Model ipfsCID (32-byte hex)"
            value={ipfsCid}
            onChange={setIpfsCid}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={runFullSetup}
            className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={
              steps.approve.status === "running" ||
              steps.provider.status === "running" ||
              steps.model.status === "running" ||
              steps.bid.status === "running"
            }
          >
            Run provider setup (approve → provider → model → bid)
          </button>
          <StatusPill tone={statusTone[steps.approve.status]}>
            Approve: {steps.approve.message || steps.approve.status}
          </StatusPill>
          <StatusPill tone={statusTone[steps.provider.status]}>
            Provider: {steps.provider.message || steps.provider.status}
          </StatusPill>
          <StatusPill tone={statusTone[steps.model.status]}>
            Model: {steps.model.message || steps.model.status}
          </StatusPill>
          <StatusPill tone={statusTone[steps.bid.status]}>
            Bid: {steps.bid.message || steps.bid.status}
          </StatusPill>
        </div>

        {log && (
          <pre className="max-h-48 overflow-auto rounded-md border border-white/10 bg-slate-950 p-3 text-xs text-slate-100">
            {log}
          </pre>
        )}

        <div className="space-y-2">
          {checklist.map((step) => (
            <div
              key={step.title}
              className="flex items-center justify-between rounded-md border border-white/5 bg-slate-950/50 px-3 py-2 text-sm"
            >
              <div>
                <p className="text-slate-100">{step.title}</p>
                <p className="text-xs text-slate-500">{step.detail}</p>
                {step.title === "Wallet funded" && ethBalance <= 0 && (
                  <p className="text-xs text-amber-300">
                    Add Arbitrum ETH for gas to send approve/provider/model/bid transactions.
                  </p>
                )}
              </div>
              <StatusPill tone={step.tone}>
                {step.tone === "success" ? "Done" : "Pending"}
              </StatusPill>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  onChangeNumber,
  placeholder,
  type = "text",
  step,
  rightAction,
}: {
  label: string;
  value: string | number;
  onChange?: (val: string) => void;
  onChangeNumber?: (val: number) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  rightAction?: { label: string; onClick: () => void };
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      <span>{label}</span>
      <div className="flex items-center gap-2">
        <input
          className="w-full rounded-md border border-white/10 bg-slate-950 px-2 py-1 text-sm text-slate-100 outline-none focus:border-emerald-400"
          value={value}
          type={type}
          step={step}
          onChange={(e) => {
            if (onChangeNumber) {
              const num = Number(e.target.value);
              if (!Number.isNaN(num)) onChangeNumber(num);
            }
            if (onChange) onChange(e.target.value);
          }}
          placeholder={placeholder}
        />
        {rightAction && (
          <button
            type="button"
            onClick={rightAction.onClick}
            className="rounded-md border border-white/10 px-2 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-500 hover:text-emerald-200"
          >
            {rightAction.label}
          </button>
        )}
      </div>
    </label>
  );
}

function randomModelId() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint8Array(32);
    crypto.getRandomValues(buf);
    return `0x${Array.from(buf)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return "0x" + Math.random().toString(16).slice(2).padEnd(64, "0");
}
