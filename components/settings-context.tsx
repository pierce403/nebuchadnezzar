'use client';

import {
  PropsWithChildren,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { buildDefaultSettings, sanitizeBaseUrl } from "@/lib/config";
import { SETTINGS_STORAGE_KEY, Settings } from "@/lib/settings";

interface SettingsContextValue {
  settings: Settings;
  hydrated: boolean;
  updateSettings: (next: Partial<Settings>) => void;
  resetSettings: () => void;
}

const SettingsContext = createContext<SettingsContextValue | undefined>(
  undefined,
);

const baseDefaults = buildDefaultSettings();

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<Settings>(baseDefaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Settings>;
        setSettings((prev) => mergeSettings(prev, parsed));
      }
    } catch (err) {
      console.warn("Failed to load settings from localStorage", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  const updateSettings = (next: Partial<Settings>) => {
    setSettings((prev) => {
      const merged = mergeSettings(prev, next);
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  };

  const resetSettings = () => {
    setSettings(baseDefaults);
    if (typeof window !== "undefined") {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
    }
  };

  const value = useMemo(
    () => ({ settings, hydrated, updateSettings, resetSettings }),
    [settings, hydrated],
  );

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error("useSettings must be used within SettingsProvider");
  }
  return ctx;
}

function mergeSettings(
  current: Settings,
  next: Partial<Settings>,
): Settings {
  return {
    ...current,
    ...next,
    readinessRules: {
      ...current.readinessRules,
      ...(next.readinessRules || {}),
    },
    baseUrl: sanitizeBaseUrl(next.baseUrl ?? current.baseUrl ?? ""),
  };
}
