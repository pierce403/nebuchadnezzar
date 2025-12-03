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
import { generateWallet } from "@/lib/wallet";

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

  useEffect(() => {
    if (!hydrated) return;
    if (settings.walletAddress) return;
    const generated = generateWallet();
    setSettings((prev) => {
      const merged = mergeSettings(prev, {
        walletAddress: generated.address,
        walletPrivateKey: generated.privateKey,
      });
      if (typeof window !== "undefined") {
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged));
      }
      return merged;
    });
  }, [hydrated, settings.walletAddress]);

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
  const username =
    next.username === undefined || next.username === ""
      ? current.username
      : next.username;
  const password =
    next.password === undefined || next.password === ""
      ? current.password
      : next.password;
  return {
    ...current,
    ...next,
    username,
    password,
    readinessRules: {
      ...current.readinessRules,
      ...(next.readinessRules || {}),
    },
    baseUrl: sanitizeBaseUrl(next.baseUrl ?? current.baseUrl ?? ""),
  };
}
