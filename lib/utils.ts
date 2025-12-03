export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(value?: number, digits = 2) {
  if (value === undefined || value === null || Number.isNaN(value)) return "–";
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatUptime(seconds?: number) {
  if (!seconds || Number.isNaN(seconds)) return "Unknown";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(" ");
}

export function shortAddress(address?: string, chars = 4) {
  if (!address) return "Unknown";
  if (address.length <= chars * 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}
