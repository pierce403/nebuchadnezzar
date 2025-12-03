'use client';

import { SettingsForm } from "@/components/settings-form";
import { useSettings } from "@/components/settings-context";

export default function SettingsPage() {
  const { settings, updateSettings, resetSettings, hydrated } = useSettings();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-slate-50">Settings</h1>
        <p className="text-sm text-slate-400">
          Configure the proxy router base URL, credentials, and readiness
          thresholds. Values persist in this browser only.
        </p>
      </div>

      {hydrated ? (
        <SettingsForm
          settings={settings}
          onChange={updateSettings}
          onReset={resetSettings}
        />
      ) : (
        <p className="text-sm text-slate-400">Loading saved settings…</p>
      )}
    </div>
  );
}
