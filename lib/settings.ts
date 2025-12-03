export interface ReadinessRules {
  requireHealth: boolean;
  requireBalance: boolean;
  requireModel: boolean;
  requireBid: boolean;
}

export interface Settings {
  baseUrl: string;
  username?: string;
  password?: string;
  walletAddress?: string;
  minMorBalance: number;
  configUrl?: string;
  lumerinConfigUrl?: string;
  readinessRules: ReadinessRules;
  pollIntervalMs: number;
}

export const SETTINGS_STORAGE_KEY = "nebuchadnezzar-settings-v1";
