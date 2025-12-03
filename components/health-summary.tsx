"use client";

import { BlockchainBalance, Bid, Model, Provider, ReadinessDetails, RouterHealth } from "@/lib/types";
import { formatNumber, formatUptime, shortAddress } from "@/lib/utils";
import QRCode from "qrcode";
import { useRef, useState } from "react";
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
  walletAddress?: string;
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
  walletAddress,
}: HealthSummaryProps) {
  const tone = readinessTone(readiness.label);
  const isOnline = Boolean(health && (health.status || health.uptime));
  const mor = morBalance(balance);
  const activeModels = models?.length ?? provider?.models?.length ?? 0;
  const activeBids =
    bids?.length ?? provider?.bids?.length ?? 0;
  const [showQr, setShowQr] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const qrRequestId = useRef(0);

  const toggleQr = async () => {
    if (showQr) {
      setShowQr(false);
      return;
    }

    setShowQr(true);
    const target = walletAddress?.trim();
    if (!target) {
      setQrError("Set a wallet in Settings to generate a QR code.");
      setQrDataUrl(null);
      return;
    }

    setQrError(null);
    setQrDataUrl(null);
    const payload = target.startsWith("ethereum:") ? target : `ethereum:${target}`;
    const requestId = qrRequestId.current + 1;
    qrRequestId.current = requestId;

    try {
      const data = await QRCode.toDataURL(payload, { margin: 1, width: 240 });
      if (qrRequestId.current === requestId) {
        setQrDataUrl(data);
      }
    } catch {
      if (qrRequestId.current === requestId) {
        setQrError("Unable to generate QR code right now.");
      }
    }
  };

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
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-lg font-semibold text-slate-50">
                {formatNumber(mor, 3)} MOR
              </span>
              <StatusPill tone={mor >= minMorBalance ? "success" : "warn"}>
                {mor >= minMorBalance ? "Healthy" : "Low"}
              </StatusPill>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="truncate">
                {walletAddress
                  ? `Wallet ${shortAddress(walletAddress, 6)}`
                  : "Set wallet in Settings"}
              </span>
              <button
                type="button"
                className="rounded-md border border-sky-400/50 px-2 py-1 text-xs font-medium text-sky-200 transition hover:border-sky-300 hover:text-sky-50 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-600"
                onClick={toggleQr}
                disabled={!walletAddress}
              >
                {showQr ? "Hide QR" : "Fund via QR"}
              </button>
            </div>
          </div>
          {showQr && (
            <div className="mt-3 rounded-md border border-white/10 bg-slate-950/70 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="text-xs text-slate-300">
                  <p className="font-semibold text-slate-100">
                    Scan to fund MOR
                  </p>
                  <p className="mt-1 break-all text-slate-400">
                    {walletAddress || "Add a wallet address first."}
                  </p>
                </div>
                <button
                  type="button"
                  className="text-xs text-slate-400 transition hover:text-slate-200"
                  onClick={() => setShowQr(false)}
                >
                  Close
                </button>
              </div>
              <div className="mt-3 flex items-center justify-center rounded-md bg-slate-900/80 p-3">
                {qrError && (
                  <span className="text-xs text-rose-300">{qrError}</span>
                )}
                {!qrError && (
                  <>
                    {qrDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={qrDataUrl}
                        alt="Wallet QR code"
                        className="h-48 w-48 rounded-md border border-white/5 bg-slate-950 p-2"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">
                        Generating QR…
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
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
