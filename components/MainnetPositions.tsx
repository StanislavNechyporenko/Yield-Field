'use client';

import { useEffect, useMemo } from 'react';
import { erc20Abi, formatUnits } from 'viem';
import { useAccount, useBalance, useReadContracts } from 'wagmi';
import { monadMainnet } from '@/utils/chains';
import ProtocolIcon from '@/components/ProtocolIcon';
import { formatUSD } from '@/utils/format';
import { POSITION_SOURCES, WALLET_TOKENS } from '@/utils/positions';
import type { AssetPrices } from '@/utils/types';

const erc4626Abi = [
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const IS_MAINNET = (process.env.NEXT_PUBLIC_NETWORK_MODE ?? 'mainnet') === 'mainnet';

function formatToken(value: number, symbol: string): string {
  return `${value.toLocaleString('en-US', { maximumFractionDigits: value >= 100 ? 2 : 4 })} ${symbol}`;
}

// Reads the connected wallet's receipt-token balances straight from Monad
// mainnet — no backend, no custom contract. ERC-4626 balances are converted
// to the underlying asset via convertToAssets.
export default function MainnetPositions({
  prices,
  refreshKey = 0,
}: {
  prices: AssetPrices;
  refreshKey?: number;
}) {
  const { address, isConnected } = useAccount();
  const enabled = Boolean(IS_MAINNET && isConnected && address);

  const balances = useReadContracts({
    contracts: POSITION_SOURCES.map((s) => ({
      address: s.token,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address ?? '0x0000000000000000000000000000000000000000'] as const,
      chainId: monadMainnet.id,
    })),
    query: { enabled, refetchInterval: 30_000 },
  });

  // convertToAssets reverts on the plain-ERC20 entries — their result is
  // simply ignored below, the raw balance is used instead.
  const conversions = useReadContracts({
    contracts: POSITION_SOURCES.map((s, i) => ({
      address: s.token,
      abi: erc4626Abi,
      functionName: 'convertToAssets' as const,
      args: [(balances.data?.[i]?.result as bigint | undefined) ?? 0n] as const,
      chainId: monadMainnet.id,
    })),
    query: { enabled: enabled && Boolean(balances.data) },
  });

  const firstHop = (i: number): bigint => {
    const raw = (balances.data?.[i]?.result as bigint | undefined) ?? 0n;
    if (POSITION_SOURCES[i].kind !== 'erc4626') return raw;
    return (conversions.data?.[i]?.result as bigint | undefined) ?? raw;
  };

  // Second hop for LST receipts (e.g. cshMON → shMON → MON): convert the
  // first-hop LST amount into the underlying via the LST's own vault math.
  const secondConversions = useReadContracts({
    contracts: POSITION_SOURCES.map((s, i) => ({
      address: s.secondHop?.token ?? s.token,
      abi: erc4626Abi,
      functionName: 'convertToAssets' as const,
      args: [s.secondHop ? firstHop(i) : 0n] as const,
      chainId: monadMainnet.id,
    })),
    query: { enabled: enabled && Boolean(conversions.data) },
  });

  const nativeMon = useBalance({
    address,
    chainId: monadMainnet.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const walletBalances = useReadContracts({
    contracts: WALLET_TOKENS.map((t) => ({
      address: t.token,
      abi: erc20Abi,
      functionName: 'balanceOf' as const,
      args: [address ?? '0x0000000000000000000000000000000000000000'] as const,
      chainId: monadMainnet.id,
    })),
    query: { enabled, refetchInterval: 30_000 },
  });

  // A successful zap bumps refreshKey — refetch so the new position shows
  // immediately instead of waiting for the 30s interval.
  useEffect(() => {
    if (enabled && refreshKey > 0) {
      void balances.refetch();
      void nativeMon.refetch();
      void walletBalances.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const rows = useMemo(() => {
    if (!balances.data) return [];
    return POSITION_SOURCES.map((source, i) => {
      const raw = (balances.data?.[i]?.result as bigint | undefined) ?? 0n;
      const hop1 =
        source.kind === 'erc4626'
          ? ((conversions.data?.[i]?.result as bigint | undefined) ?? raw)
          : raw;
      const final =
        source.secondHop?.kind === 'erc4626'
          ? ((secondConversions.data?.[i]?.result as bigint | undefined) ?? hop1)
          : hop1;
      const approx =
        (source.kind === 'erc20' && !source.exact) || source.secondHop?.kind === 'erc20';
      return {
        ...source,
        raw,
        approx,
        tokenAmount: Number(formatUnits(raw, source.decimals)),
        assetAmount: Number(formatUnits(final, source.decimals)),
      };
    }).filter((row) => row.raw > 0n);
  }, [balances.data, conversions.data, secondConversions.data]);

  const walletRows = useMemo(() => {
    const items: { symbol: string; asset: keyof AssetPrices; amount: number }[] = [];
    const mon = nativeMon.data?.value ?? 0n;
    if (mon > 0n) {
      items.push({ symbol: 'MON', asset: 'MON', amount: Number(formatUnits(mon, 18)) });
    }
    WALLET_TOKENS.forEach((t, i) => {
      const raw = (walletBalances.data?.[i]?.result as bigint | undefined) ?? 0n;
      if (raw > 0n) {
        items.push({
          symbol: t.symbol,
          asset: t.asset,
          amount: Number(formatUnits(raw, t.decimals)),
        });
      }
    });
    return items;
  }, [nativeMon.data, walletBalances.data]);

  if (!enabled) return null;

  return (
    <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_1px_2px_rgba(20,18,27,0.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-[17px] font-semibold">My Positions</h2>
        <span className="rounded-full bg-ink/5 px-[9px] py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink/45">
          Monad mainnet
        </span>
      </div>

      {balances.isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      ) : (
        <>
          {walletRows.length > 0 && (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-ink/40">
                Available in wallet
              </p>
              <div className="mb-5 flex flex-wrap gap-2">
                {walletRows.map((w) => {
                  const price = prices[w.asset] ?? 0;
                  return (
                    <div
                      key={w.symbol}
                      className="flex items-baseline gap-2 rounded-full border border-ink/10 bg-field px-4 py-2"
                    >
                      <span className="text-sm font-semibold">
                        {formatToken(w.amount, w.symbol)}
                      </span>
                      {price > 0 && (
                        <span className="text-xs text-ink/40">
                          ≈ {formatUSD(w.amount * price)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-ink/40">
            Staked &amp; deposited
          </p>
          {rows.length === 0 ? (
            <p className="text-sm text-ink/45">
              No positions found for this wallet in the tracked protocols (ShMonad, Kintsu,
              Magma, Upshift, Curvance). Deposit on a protocol above and your position will
              show up here.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {rows.map((row) => {
                const price = prices[row.asset] ?? 0;
                const approx = row.approx ? '≈ ' : '';
                return (
                  <div
                    key={row.id}
                    className="flex items-center justify-between rounded-[14px] border border-ink/10 bg-field px-4 py-3.5"
                  >
                    <div className="flex items-center gap-3">
                      <ProtocolIcon name={row.protocol} size={34} radius={10} />
                      <div>
                        <p className="text-sm font-semibold">{row.protocol}</p>
                        <p className="mt-px text-[13px] text-ink/45">
                          {formatToken(row.tokenAmount, row.tokenSymbol)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[13px] font-semibold text-accent">
                        {approx}
                        {formatToken(row.assetAmount, row.asset)}
                      </p>
                      {price > 0 && (
                        <p className="mt-px text-xs text-ink/40">
                          ≈ {formatUSD(row.assetAmount * price)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
