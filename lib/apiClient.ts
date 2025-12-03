import { Settings } from "./settings";
import {
  ApiResult,
  Bid,
  BlockchainBalance,
  Model,
  Provider,
  RouterConfig,
  RouterHealth,
  TokenBalance,
} from "./types";

const DEFAULT_TIMEOUT = 8000;
const WEI = 1_000_000_000_000_000_000n;

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

function fromWei(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    if (typeof value === "bigint") return Number(value) / Number(WEI);
    if (typeof value === "number") {
      // Assume wei if the value is large; otherwise return as-is.
      return value > 1_000_000 ? value / Number(WEI) : value;
    }
    const str = String(value).trim();
    if (!str) return undefined;
    if (/^\d+$/.test(str)) {
      const asBig = BigInt(str);
      return Number(asBig) / Number(WEI);
    }
    const asNum = Number(str);
    return Number.isFinite(asNum) ? asNum : undefined;
  } catch {
    return undefined;
  }
}

function normalizeBalancePayload(data: unknown): BlockchainBalance {
  const obj = (data && typeof data === "object"
    ? (data as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const address =
    (obj.address as string | undefined) ||
    (obj.Address as string | undefined) ||
    (obj.wallet as string | undefined) ||
    (obj.Wallet as string | undefined);

  const morValue =
    obj.mor ?? obj.MOR ?? obj.Mor ?? (obj as Record<string, unknown>).MOR_BALANCE;
  const ethValue = obj.eth ?? obj.ETH ?? obj.Eth;

  const morBalance = fromWei(morValue);
  const ethBalance = fromWei(ethValue);

  const tokens: TokenBalance[] = [];
  if (morBalance !== undefined) tokens.push({ symbol: "MOR", balance: morBalance });
  if (ethBalance !== undefined) tokens.push({ symbol: "ETH", balance: ethBalance });

  const extraTokens =
    (Array.isArray(obj.tokens) ? obj.tokens : undefined) ||
    (Array.isArray(obj.Tokens) ? obj.Tokens : undefined) ||
    [];

  for (const token of extraTokens as Array<Record<string, unknown>>) {
    const symbol =
      (token.symbol as string | undefined) ||
      (token.Symbol as string | undefined) ||
      (token.token as string | undefined);
    const balance = fromWei(
      token.balance ?? token.Balance ?? token.amount ?? token.Amount,
    );
    if (symbol && balance !== undefined) {
      tokens.push({ symbol, balance });
    }
  }

  const allowanceRaw =
    (obj.allowance as Record<string, unknown> | undefined) ||
    (obj.Allowance as Record<string, unknown> | undefined);

  const allowance =
    allowanceRaw &&
    (allowanceRaw.approved !== undefined || allowanceRaw.amount !== undefined)
      ? {
          approved: Boolean(
            allowanceRaw.approved ?? allowanceRaw.Approved ?? allowanceRaw.isApproved,
          ),
          amount: fromWei(allowanceRaw.amount ?? allowanceRaw.Amount),
        }
      : undefined;

  return {
    address,
    mor: morBalance !== undefined ? { symbol: "MOR", balance: morBalance } : undefined,
    eth: ethBalance !== undefined ? { symbol: "ETH", balance: ethBalance } : undefined,
    tokens,
    allowance,
  };
}

function normalizeProvider(raw: unknown): Provider | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const address =
    (obj.address as string | undefined) ||
    (obj.Address as string | undefined) ||
    (obj.Provider as string | undefined) ||
    (obj.Id as string | undefined);
  const stake = fromWei(obj.stake ?? obj.Stake);
  return {
    id:
      (obj.id as string | undefined) ||
      (obj.Id as string | undefined) ||
      address ||
      "",
    address: address || "",
    stake,
    status: (obj.status as string | undefined) || (obj.Status as string | undefined),
    isRegistered:
      Boolean(obj.isRegistered ?? obj.IsRegistered ?? obj.Active ?? obj.active) &&
      Boolean(!obj.IsDeleted),
    active: Boolean(obj.active ?? obj.Active),
    metadata: obj,
  };
}

function normalizeModel(raw: unknown): Model | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    id:
      (obj.id as string | undefined) ||
      (obj.Id as string | undefined) ||
      (obj.modelId as string | undefined) ||
      "",
    providerId:
      (obj.providerId as string | undefined) ||
      (obj.ProviderId as string | undefined) ||
      (obj.Owner as string | undefined) ||
      (obj.owner as string | undefined),
    stake: fromWei(obj.stake ?? obj.Stake),
    feePerSecond: fromWei(obj.fee ?? obj.Fee),
    priceFloor: fromWei(obj.priceFloor ?? obj.PriceFloor),
    tags:
      (Array.isArray(obj.tags) ? obj.tags : undefined) ||
      (Array.isArray(obj.Tags) ? obj.Tags : undefined) ||
      [],
    metadata: obj,
  };
}

function normalizeBid(raw: unknown): Bid | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  return {
    id: (obj.id as string | undefined) || (obj.Id as string | undefined) || "",
    providerId:
      (obj.providerId as string | undefined) ||
      (obj.Provider as string | undefined) ||
      (obj.provider as string | undefined),
    modelId:
      (obj.modelId as string | undefined) ||
      (obj.ModelId as string | undefined) ||
      (obj.ModelAgentId as string | undefined),
    pricePerSecond: fromWei(obj.pricePerSecond ?? obj.PricePerSecond),
    status: (obj.status as string | undefined) || (obj.Status as string | undefined),
    createdAt:
      (obj.createdAt as string | undefined) || (obj.CreatedAt as string | undefined),
    metadata: obj,
  };
}

export function createApiClient(settings: Settings) {
  const baseUrl = (settings.baseUrl || "").replace(/\/+$/, "");
  const auth = buildAuthHeader(settings);
  const headers = auth ? { Authorization: auth } : undefined;

  function unwrapArray<T>(value: unknown, key: string): T[] {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const nested = obj[key];
      if (Array.isArray(nested)) return nested as T[];
    }
    return [];
  }

  async function normalizeArray<T>(
    promise: Promise<ApiResult<unknown>>,
    key: string,
  ): Promise<ApiResult<T[]>> {
    const res = await promise;
    if (!res.ok) return res as ApiResult<T[]>;
    return { ok: true, data: unwrapArray<T>(res.data, key) };
  }

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
    getBalance: async () => {
      const res = await request<unknown>("/blockchain/balance");
      if (!res.ok) return res as ApiResult<BlockchainBalance>;
      return { ok: true, data: normalizeBalancePayload(res.data) };
    },
    getProviders: async () => {
      const res = await request<unknown>("/blockchain/providers");
      if (!res.ok) return res as ApiResult<Provider[]>;
      const list = unwrapArray<unknown>(res.data, "providers")
        .map(normalizeProvider)
        .filter(Boolean) as Provider[];
      return { ok: true, data: list };
    },
    getModels: async () => {
      const res = await request<unknown>("/blockchain/models");
      if (!res.ok) return res as ApiResult<Model[]>;
      const list = unwrapArray<unknown>(res.data, "models")
        .map(normalizeModel)
        .filter(Boolean) as Model[];
      return { ok: true, data: list };
    },
    getProviderBids: async (providerId: string) => {
      const res = await request<unknown>(`/blockchain/providers/${providerId}/bids`);
      if (!res.ok) return res as ApiResult<Bid[]>;
      const list = unwrapArray<unknown>(res.data, "bids")
        .map(normalizeBid)
        .filter(Boolean) as Bid[];
      return { ok: true, data: list };
    },
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
