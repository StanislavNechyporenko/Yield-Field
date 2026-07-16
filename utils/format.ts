export function formatTVL(tvl: number): string {
  if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
  if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
  if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(1)}K`;
  return `$${tvl.toFixed(0)}`;
}

export function formatUSD(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  });
}

export function formatAmount(value: number, asset: string): string {
  const formatted = value.toLocaleString('en-US', {
    maximumFractionDigits: value >= 100 ? 2 : 4,
  });
  return `${formatted} ${asset}`;
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/** "Aave V3" → "AV", "Kintsu" → "KI" — avatar initials per the design. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const letters =
    words.length >= 2 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}
