'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import ConnectWallet from '@/components/ConnectWallet';
import FlipText from '@/components/FlipText';
import FloatingBackground from '@/components/FloatingBackground';
import MainnetPositions from '@/components/MainnetPositions';
import Portfolio from '@/components/Portfolio';
import ProtocolIcon from '@/components/ProtocolIcon';
import ProtocolList from '@/components/ProtocolList';
import YieldCalculator from '@/components/YieldCalculator';
import { formatAmount, formatTVL, formatUSD } from '@/utils/format';
import {
  invest,
  MAINNET_ZAPS,
  ON_CHAIN_PROTOCOLS,
  ROUTER_ADDRESS,
  zapInvest,
  type InvestStatus,
} from '@/utils/invest';
import {
  TIMEFRAME_DAYS,
  type AssetPrices,
  type InvestAsset,
  type Protocol,
  type Timeframe,
} from '@/utils/types';

const INVEST_LABELS: Record<Exclude<InvestStatus, 'idle' | 'error'>, string> = {
  approving: 'Approving…',
  depositing: 'Depositing…',
  success: 'Deposited successfully',
};

export default function Home() {
  const [investmentAmount, setInvestmentAmount] = useState<number>(1000);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<InvestAsset>('MON');
  const [prices, setPrices] = useState<AssetPrices>({ MON: 0, USDC: 1, USDT: 1, AUSD: 1 });
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<Timeframe>('month');
  const [investStatus, setInvestStatus] = useState<InvestStatus>('idle');
  const [investError, setInvestError] = useState<string | null>(null);
  const [portfolioRefresh, setPortfolioRefresh] = useState(0);
  const { isConnected } = useAccount();

  const fetchProtocols = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/protocols');
      if (!res.ok) throw new Error(`API responded ${res.status}`);
      const data: { protocols: Protocol[]; prices?: AssetPrices } = await res.json();
      setProtocols(data.protocols);
      if (data.prices) setPrices(data.prices);
    } catch {
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProtocols();
  }, [fetchProtocols]);

  const assetProtocols = useMemo(
    () => protocols.filter((p) => (p.asset ?? 'MON') === selectedAsset),
    [protocols, selectedAsset]
  );

  const selected = useMemo(
    () => assetProtocols.find((p) => p.id === selectedProtocol),
    [assetProtocols, selectedProtocol]
  );

  const handleAssetChange = (asset: InvestAsset) => {
    setSelectedAsset(asset);
    setSelectedProtocol(null);
    setInvestStatus('idle');
    setInvestError(null);
  };

  const calculateYield = (protocol: Protocol | undefined): number => {
    if (!protocol) return 0;
    return investmentAmount * (protocol.apy / 100) * (TIMEFRAME_DAYS[timeframe] / 365);
  };

  const estimatedYield = calculateYield(selected);
  const investing = investStatus === 'approving' || investStatus === 'depositing';
  const isExternal = selected?.investType === 'external';
  const onChainReady = selected ? !isExternal && selected.id in ON_CHAIN_PROTOCOLS : false;
  const zapReady = Boolean(selected && ROUTER_ADDRESS && selected.id in MAINNET_ZAPS);
  const assetPrice = prices[selectedAsset] ?? 0;

  const handleSelectProtocol = (id: string) => {
    setSelectedProtocol(id);
    setInvestStatus('idle');
    setInvestError(null);
  };

  const handleInvest = async () => {
    if (!selected || investing) return;
    if (!isConnected) {
      setInvestError('Connect your wallet first.');
      return;
    }
    setInvestError(null);
    try {
      await invest(selected.id, investmentAmount, setInvestStatus);
      setPortfolioRefresh((n) => n + 1);
    } catch (err) {
      setInvestStatus('error');
      const message =
        (err as { shortMessage?: string })?.shortMessage ??
        (err instanceof Error ? err.message : 'Transaction failed.');
      setInvestError(message);
    }
  };

  const handleZapInvest = async () => {
    if (!selected || investing) return;
    if (!isConnected) {
      setInvestError('Connect your wallet first.');
      return;
    }
    setInvestError(null);
    try {
      await zapInvest(selected.id, investmentAmount, setInvestStatus);
      setPortfolioRefresh((n) => n + 1);
    } catch (err) {
      setInvestStatus('error');
      const message =
        (err as { shortMessage?: string })?.shortMessage ??
        (err instanceof Error ? err.message : 'Transaction failed.');
      setInvestError(message);
    }
  };

  return (
    <>
      <FloatingBackground />
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between px-8 py-3.5">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Yield Field" className="h-8 w-8" />
            <span className="text-[17px] font-semibold tracking-[-0.01em]">Yield Field</span>
            <span className="rounded-full bg-ink/5 px-[9px] py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink/45">
              Monad
            </span>
          </div>
          <ConnectWallet />
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-8 pb-20 pt-8">
        <div className="flex flex-wrap items-start gap-6">
          <div className="max-w-[380px] flex-[1_1_340px]">
            <YieldCalculator
              amount={investmentAmount}
              onAmountChange={setInvestmentAmount}
              asset={selectedAsset}
              onAssetChange={handleAssetChange}
              assetPriceUsd={assetPrice}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              estimatedYield={estimatedYield}
              selectedProtocol={selected}
            />
          </div>
          <div className="min-w-0 flex-[2_1_560px]">
            <ProtocolList
              protocols={assetProtocols}
              selectedProtocol={selectedProtocol}
              onSelectProtocol={handleSelectProtocol}
              loading={loading}
              investmentAmount={investmentAmount}
            />
          </div>
        </div>

        {selected && (
          <section className="animate-fade-in mt-6 rounded-3xl bg-ink p-7">
            <div className="mb-6 flex items-center gap-3.5">
              <ProtocolIcon name={selected.name} size={42} radius={12} />
              <div>
                <h2 className="text-lg font-semibold text-white">{selected.name}</h2>
                <p className="mt-0.5 text-[13px] text-white/55">{selected.description}</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-[14px] bg-white/5 p-4">
                <p className="mb-1 text-[11px] text-white/50">Investment</p>
                <p className="text-[15px] font-semibold text-white">
                  <FlipText text={formatAmount(investmentAmount, selectedAsset)} />
                </p>
                {assetPrice > 0 && (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    ≈ {formatUSD(investmentAmount * assetPrice)}
                  </p>
                )}
              </div>
              <div className="rounded-[14px] bg-white/5 p-4">
                <p className="mb-1 text-[11px] text-white/50">APY</p>
                <p className="text-[15px] font-semibold text-accent-light">
                  ~{selected.apy.toFixed(1)}%
                </p>
              </div>
              <div className="rounded-[14px] bg-white/5 p-4">
                <p className="mb-1 text-[11px] text-white/50">Est. yield / {timeframe}</p>
                <p className="text-[15px] font-semibold text-accent-light">
                  <FlipText text={`+${formatAmount(estimatedYield, selectedAsset)}`} />
                </p>
                {assetPrice > 0 && (
                  <p className="mt-0.5 text-[11px] text-white/40">
                    ≈ {formatUSD(estimatedYield * assetPrice)}
                  </p>
                )}
              </div>
              <div className="rounded-[14px] bg-white/5 p-4">
                <p className="mb-1 text-[11px] text-white/50">TVL / Risk</p>
                <p className="text-[15px] font-semibold text-white">
                  {formatTVL(selected.tvl)}{' '}
                  <span className="font-medium capitalize text-white/50">
                    · {selected.riskLevel}
                  </span>
                </p>
              </div>
            </div>

            {isExternal && zapReady ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handleZapInvest}
                    disabled={investing}
                    className="min-h-[44px] rounded-full bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3FD9] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {investStatus in INVEST_LABELS
                      ? INVEST_LABELS[investStatus as keyof typeof INVEST_LABELS]
                      : `⚡ Invest ${formatAmount(investmentAmount, selectedAsset)} via Yield Field`}
                  </button>
                  {selected.url && (
                    <a
                      href={selected.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center rounded-full bg-white/10 px-5 text-sm font-semibold text-white/70 transition-colors hover:bg-white/15 hover:text-white"
                    >
                      or open {selected.name} ↗
                    </a>
                  )}
                </div>
                <p className="mt-2.5 text-xs text-white/45">
                  One transaction through our on-chain YieldZapRouter — the position lands
                  straight in your wallet, Yield Field never holds your funds. Unaudited MVP
                  contract.
                </p>
              </>
            ) : isExternal && selected.url ? (
              <>
                <a
                  href={selected.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3FD9]"
                >
                  Open {selected.name} ↗
                </a>
                <p className="mt-2.5 text-xs text-white/45">
                  You&apos;ll deposit directly on the protocol&apos;s own app (Monad mainnet) —
                  Yield Field never holds your funds.
                </p>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleInvest}
                  disabled={investing || !onChainReady}
                  className="min-h-[44px] rounded-full bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3FD9] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {investStatus in INVEST_LABELS
                    ? INVEST_LABELS[investStatus as keyof typeof INVEST_LABELS]
                    : `Invest in ${selected.name}`}
                </button>
                {onChainReady ? (
                  <p className="mt-2.5 text-xs text-white/45">
                    Deposits are sent in native testnet MON — one transaction, no approval
                    needed.
                  </p>
                ) : (
                  <p className="mt-2.5 text-[13px] text-white/55">
                    On-chain deposits are available for Aave V3 and Morpho Blue in this MVP.
                  </p>
                )}
              </>
            )}
            {selected.earnsPoints && (
              <p className="mt-2.5 text-xs text-accent-light">
                ✦ Staking here also earns {selected.name} project points on top of the APY
                shown.
              </p>
            )}
            {selected.pairedYield && (
              <p className="mt-2.5 text-xs text-white/55">
                ⇄ Paired / leveraged strategies (multiply, looping) up to ~
                {selected.pairedYield.upToApy.toFixed(1)}% APY are available on the
                protocol&apos;s app.
              </p>
            )}
            {investError && <p className="mt-2.5 text-[13px] text-red-300">{investError}</p>}
            {investStatus === 'success' && (
              <p className="mt-2.5 text-[13px] text-accent-light">
                Deposit confirmed on-chain. Track it in your wallet or the Monad explorer.
              </p>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/10 pt-4">
              <a
                href={`/api/og?protocol=${encodeURIComponent(selected.name)}&apy=${selected.apy}&asset=${selectedAsset}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-semibold text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                📤 Share card
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  `I'm earning ~${selected.apy}% APY on ${selectedAsset} with ${selected.name} — found it on Yield Field, the DeFi yield aggregator for Monad 🟣`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[36px] items-center gap-2 rounded-full bg-white/10 px-4 text-xs font-semibold text-white/70 transition-colors hover:bg-white/15 hover:text-white"
              >
                Post on X ↗
              </a>
            </div>
          </section>
        )}

        <Portfolio refreshKey={portfolioRefresh} />
        <MainnetPositions prices={prices} refreshKey={portfolioRefresh} />
      </main>
    </>
  );
}
