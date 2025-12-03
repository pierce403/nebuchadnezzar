import { Settings } from "./settings";
import {
  ApiResult,
  Bid,
  BlockchainBalance,
  Model,
  Provider,
  RouterConfig,
  RouterHealth,
} from "./types";

const DEFAULT_TIMEOUT = 8000;

function buildAuthHeader(settings: Settings) {
  if (!settings.username) return undefined;
  const token =
    typeof btoa === "function"
      ? btoa(`${settings.username}:${settings.password || ""}`)
      : Buffer.from(`${settings.username}:${settings.password || ""}`).toString(
          "base64",
        );
  return `Basic ${token}`;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      onTimeout();
      reject(new Error("Request timed out"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export function createApiClient(settings: Settings) {
  const baseUrl = (settings.baseUrl || "").replace(/\/+$/, "");
  const auth = buildAuthHeader(settings);
  const headers = auth ? { Authorization: auth } : undefined;

  async function request<T>(
    pathOrUrl: string,
    init?: RequestInit & { timeoutMs?: number },
  ): Promise<ApiResult<T>> {
    const timeoutMs = init?.timeoutMs ?? DEFAULT_TIMEOUT;
    const target =
      pathOrUrl.startsWith("http") || pathOrUrl.startsWith("https")
        ? pathOrUrl
        : `${baseUrl}${pathOrUrl}`;

    if (!target) {
      return { ok: false, error: "Proxy Router base URL is not configured." };
    }

    try {
      const controller = new AbortController();
      const fetchPromise = fetch(target, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          ...(headers || {}),
          ...(init?.headers || {}),
        },
        signal: controller.signal,
      });

      const response = await withTimeout(
        fetchPromise,
        timeoutMs,
        () => controller.abort(),
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        return {
          ok: false,
          status: response.status,
          error:
            errorText ||
            `Request failed (${response.status} ${response.statusText})`,
        };
      }

      const data = (await response.json().catch(() => null)) as T;
      return { ok: true, data };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown network error";
      return { ok: false, error: message };
    }
  }

  return {
    getHealth: () => request<RouterHealth>("/healthcheck"),
    getBalance: () => request<BlockchainBalance>("/blockchain/balance"),
    getProviders: () => request<Provider[]>("/blockchain/providers"),
    getModels: () => request<Model[]>("/blockchain/models"),
    getProviderBids: (providerId: string) =>
      request<Bid[]>(`/blockchain/providers/${providerId}/bids`),
    getConfig: () => {
      const configUrl =
        settings.configUrl ||
        (baseUrl ? `${baseUrl}/config` : "/config");
      return request<RouterConfig>(configUrl);
    },
    getUnderlyingLumerinConfig: () => {
      const configUrl =
        settings.lumerinConfigUrl && settings.lumerinConfigUrl.trim().length
          ? settings.lumerinConfigUrl
          : baseUrl
            ? `${baseUrl.replace(/:\d+$/, ":8080")}/config`
            : "";
      return request<Record<string, unknown>>(configUrl);
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
