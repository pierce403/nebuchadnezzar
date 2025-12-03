'use client';

import { FormEvent, useEffect, useState } from "react";
import { buildDefaultSettings } from "@/lib/config";
import { Settings } from "@/lib/settings";
import { Card } from "./card";

interface SettingsFormProps {
  settings: Settings;
  onChange: (next: Partial<Settings>) => void;
  onReset: () => void;
}

const defaults = buildDefaultSettings();

export function SettingsForm({
  settings,
  onChange,
  onReset,
}: SettingsFormProps) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    if (!copyMessage) return;
    const timer = setTimeout(() => setCopyMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [copyMessage]);

  const updateField = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onChange(draft);
  };

  const copyPrivateKey = async () => {
    if (!draft.walletPrivateKey) return;
    try {
      await navigator.clipboard.writeText(draft.walletPrivateKey);
      setCopyMessage("Private key copied");
    } catch {
      setCopyMessage("Copy failed");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Card
        title="Proxy Router"
        description="Base URL and credentials for the Morpheus / Lumerin proxy-router."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">API Base URL</span>
            <input
              required
              type="url"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              placeholder={defaults.baseUrl}
              value={draft.baseUrl}
              onChange={(e) => updateField("baseUrl", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Config endpoint</span>
            <input
              type="url"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              placeholder={`${draft.baseUrl}/config`}
              value={draft.configUrl || ""}
              onChange={(e) => updateField("configUrl", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Username</span>
            <input
              type="text"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              value={draft.username || ""}
              onChange={(e) => updateField("username", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Password</span>
            <input
              type="password"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              value={draft.password || ""}
              onChange={(e) => updateField("password", e.target.value)}
            />
          </label>
        </div>
      </Card>

      <Card
        title="Provider"
        description="Wallet, thresholds, and underlying Lumerin router endpoint."
      >
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Primary wallet</span>
            <input
              type="text"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              placeholder={defaults.walletAddress}
              value={draft.walletAddress || ""}
              onChange={(e) => updateField("walletAddress", e.target.value)}
            />
          </label>
          <div className="flex flex-col gap-2 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-xs text-slate-300">
            <div className="flex items-center justify-between">
              <span>
                Wallet is stored locally; auto-generated if empty.
              </span>
              <button
                type="button"
                className="rounded-md border border-white/20 px-2 py-1 text-slate-100 hover:border-white/40"
                onClick={copyPrivateKey}
                disabled={!draft.walletPrivateKey}
              >
                Copy private key
              </button>
            </div>
            {copyMessage && (
              <span className="text-emerald-300">{copyMessage}</span>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">MOR balance minimum</span>
            <input
              type="number"
              step="0.01"
              min={0}
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              value={draft.minMorBalance}
              onChange={(e) =>
                updateField("minMorBalance", Number(e.target.value))
              }
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Underlying Lumerin config URL</span>
            <input
              type="url"
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              placeholder={defaults.lumerinConfigUrl}
              value={draft.lumerinConfigUrl || ""}
              onChange={(e) => updateField("lumerinConfigUrl", e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-slate-300">Poll interval (ms)</span>
            <input
              type="number"
              min={5000}
              className="rounded-md border border-white/10 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-sky-400"
              value={draft.pollIntervalMs}
              onChange={(e) =>
                updateField("pollIntervalMs", Number(e.target.value))
              }
            />
          </label>
        </div>
      </Card>

      <Card
        title="Readiness rules"
        description="Pick which checks must pass for 100% readiness."
      >
        <div className="grid gap-2 md:grid-cols-2">
          <ToggleRow
            label="Router health must be online"
            checked={draft.readinessRules.requireHealth}
            onChange={(checked) =>
              updateField("readinessRules", {
                ...draft.readinessRules,
                requireHealth: checked,
              })
            }
          />
          <ToggleRow
            label="MOR balance above minimum"
            checked={draft.readinessRules.requireBalance}
            onChange={(checked) =>
              updateField("readinessRules", {
                ...draft.readinessRules,
                requireBalance: checked,
              })
            }
          />
          <ToggleRow
            label="At least one model registered"
            checked={draft.readinessRules.requireModel}
            onChange={(checked) =>
              updateField("readinessRules", {
                ...draft.readinessRules,
                requireModel: checked,
              })
            }
          />
          <ToggleRow
            label="At least one active bid"
            checked={draft.readinessRules.requireBid}
            onChange={(checked) =>
              updateField("readinessRules", {
                ...draft.readinessRules,
                requireBid: checked,
              })
            }
          />
        </div>
      </Card>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-sky-400"
        >
          Save settings
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-white/40"
        >
          Reset to defaults
        </button>
      </div>
    </form>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-5 w-5 rounded border border-white/20 bg-slate-900 accent-sky-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
