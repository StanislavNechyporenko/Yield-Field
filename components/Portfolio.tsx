'use client';

import { useEffect, useState } from 'react';
import { formatEther } from 'viem';
import { useAccount, useReadContract } from 'wagmi';
import { monadTestnet } from '@/utils/chains';
import ProtocolIcon from '@/components/ProtocolIcon';
import { AGGREGATOR_ADDRESS, aggregatorAbi, withdrawNative } from '@/utils/invest';

const POSITIONS = [
  { key: 'aave-v3', protocolId: 0n, name: 'Aave V3' },
  { key: 'morpho-blue', protocolId: 1n, name: 'Morpho Blue' },
] as const;

const PROTOCOL_NAMES = ['Aave V3', 'Morpho Blue'];

function formatMon(wei: bigint): string {
  const value = Number(formatEther(wei));
  return `${value.toLocaleString('en-US', { maximumFractionDigits: 4 })} MON`;
}

// The portfolio reads positions from our testnet aggregator; in mainnet
// mode deposits live on the protocols' own apps, so there is nothing to show.
const IS_MAINNET = (process.env.NEXT_PUBLIC_NETWORK_MODE ?? 'mainnet') === 'mainnet';

export default function Portfolio({ refreshKey }: { refreshKey: number }) {
  const { address, isConnected } = useAccount();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = Boolean(!IS_MAINNET && isConnected && address && AGGREGATOR_ADDRESS);
  const common = {
    address: AGGREGATOR_ADDRESS,
    abi: aggregatorAbi,
    chainId: monadTestnet.id,
  } as const;

  const { data: wmon } = useReadContract({
    ...common,
    functionName: 'wmon',
    query: { enabled },
  });

  const positionsEnabled = Boolean(enabled && wmon);
  const aave = useReadContract({
    ...common,
    functionName: 'deposited',
    args: address && wmon ? [address, 0n, wmon] : undefined,
    query: { enabled: positionsEnabled },
  });
  const morpho = useReadContract({
    ...common,
    functionName: 'deposited',
    args: address && wmon ? [address, 1n, wmon] : undefined,
    query: { enabled: positionsEnabled },
  });
  const investments = useReadContract({
    ...common,
    functionName: 'getUserInvestments',
    args: address ? [address] : undefined,
    query: { enabled },
  });

  const refetchAll = () =>
    Promise.all([aave.refetch(), morpho.refetch(), investments.refetch()]);

  useEffect(() => {
    if (enabled) void refetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  if (!enabled) return null;

  const balances: Record<string, bigint> = {
    'aave-v3': aave.data ?? 0n,
    'morpho-blue': morpho.data ?? 0n,
  };
  const history = investments.data ?? [];
  const hasPositions = Object.values(balances).some((b) => b > 0n);

  const handleWithdraw = async (key: string) => {
    setBusyKey(key);
    setError(null);
    try {
      await withdrawNative(key, balances[key]);
      await refetchAll();
    } catch (err) {
      const message =
        (err as { shortMessage?: string })?.shortMessage ??
        (err instanceof Error ? err.message : 'Withdrawal failed.');
      setError(message);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <section className="mt-6 rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_1px_2px_rgba(20,18,27,0.04)]">
      <h2 className="mb-4 text-[17px] font-semibold">My Positions</h2>

      {!hasPositions && history.length === 0 ? (
        <p className="text-sm text-ink/45">
          No investments yet. Pick a protocol above and invest testnet MON to see your position
          here.
        </p>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2">
            {POSITIONS.map(({ key, name }) => (
              <div
                key={key}
                className="flex items-center justify-between rounded-[14px] border border-ink/10 bg-field px-4 py-3.5"
              >
                <div className="flex items-center gap-3">
                  <ProtocolIcon name={name} size={34} radius={10} />
                  <div>
                    <p className="text-sm font-semibold">{name}</p>
                    <p className="mt-px text-[13px] font-semibold text-accent">
                      {formatMon(balances[key])}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleWithdraw(key)}
                  disabled={balances[key] === 0n || busyKey !== null}
                  className="min-h-[36px] rounded-full bg-ink/5 px-3.5 text-xs font-semibold text-ink transition-colors hover:bg-ink/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {busyKey === key ? 'Withdrawing…' : 'Withdraw'}
                </button>
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.04em] text-ink/40">
                Activity
              </p>
              <div className="flex max-h-48 flex-col overflow-y-auto">
                {[...history].reverse().map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between border-b border-ink/5 px-1 py-2.5 text-[13px]"
                  >
                    <span>{PROTOCOL_NAMES[item.protocol] ?? `Protocol #${item.protocol}`}</span>
                    <span className="font-semibold text-accent">+{formatMon(item.amount)}</span>
                    <span className="text-ink/40">
                      {new Date(Number(item.timestamp) * 1000).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </section>
  );
}
