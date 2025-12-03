export interface RouterHealth {
  status?: string;
  version?: string;
  uptime?: number;
  uptimeSeconds?: number;
  message?: string;
  timestamp?: string;
}

export interface RouterConfig {
  host?: string;
  port?: number;
  network?: string;
  mode?: string;
  environment?: string;
  chainId?: number;
  contracts?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface TokenBalance {
  symbol: string;
  balance: number;
  formatted?: string;
}

export interface BlockchainBalance {
  address?: string;
  mor?: TokenBalance;
  eth?: TokenBalance;
  tokens?: TokenBalance[];
  allowance?: {
    approved?: boolean;
    amount?: number;
  };
  [key: string]: unknown;
}

export interface Provider {
  id: string;
  address: string;
  stake?: number;
  status?: string;
  isRegistered?: boolean;
  active?: boolean;
  models?: Model[];
  bids?: Bid[];
  metadata?: Record<string, unknown>;
}

export interface Model {
  id: string;
  providerId?: string;
  stake?: number;
  feePerSecond?: number;
  priceFloor?: number;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface Bid {
  id: string;
  providerId?: string;
  modelId?: string;
  pricePerSecond?: number;
  status?: string;
  createdAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  status?: number;
}

export interface HealthSnapshot {
  ts: Date;
  health?: RouterHealth;
  balance?: BlockchainBalance;
  providers?: Provider[];
  models?: Model[];
  error?: string;
}

export interface ReadinessDetails {
  score: number;
  label: "Ready" | "Degraded" | "Not Ready";
  reasons: string[];
}
