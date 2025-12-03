import { Settings } from "./settings";

function numberFromEnv(value?: string, fallback = 0): number {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const envDefaults: Settings = {
  baseUrl: process.env.NEXT_PUBLIC_MOR_PROXY_API_BASE || "http://localhost:8082",
  username: process.env.NEXT_PUBLIC_MOR_PROXY_USERNAME || "",
  password: process.env.NEXT_PUBLIC_MOR_PROXY_PASSWORD || "",
  walletAddress: process.env.NEXT_PUBLIC_MOR_WALLET_ADDRESS || "",
  walletPrivateKey: "",
  minMorBalance: numberFromEnv(process.env.NEXT_PUBLIC_MIN_MOR_BALANCE, 1),
  configUrl: process.env.NEXT_PUBLIC_MOR_PROXY_CONFIG_URL || "",
  lumerinConfigUrl: process.env.NEXT_PUBLIC_LUMERIN_CONFIG_URL || "http://localhost:8080/config",
  readinessRules: {
    requireHealth: true,
    requireBalance: true,
    requireModel: true,
    requireBid: true,
  },
  pollIntervalMs: numberFromEnv(process.env.NEXT_PUBLIC_POLL_INTERVAL_MS, 15000),
};

export function sanitizeBaseUrl(url: string) {
  return url.replace(/\s+/g, "").replace(/\/+$/, "");
}

export function buildDefaultSettings(): Settings {
  return {
    ...envDefaults,
    baseUrl: sanitizeBaseUrl(envDefaults.baseUrl || ""),
  };
}
