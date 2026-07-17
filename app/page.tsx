'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import FloatingBackground from '@/components/FloatingBackground';
import ProtocolIcon from '@/components/ProtocolIcon';
import type { Protocol } from '@/utils/types';

const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_ROUTER_ADDRESS;

const STEPS = [
  {
    title: 'Pick what you hold',
    text: 'MON, USDC, USDT or AUSD — the list instantly narrows to pools that accept your asset.',
  },
  {
    title: 'Compare honest numbers',
    text: 'Live rates pulled from the protocols’ own APIs, risk scored by a formula, and your yield shown in real money, not just percentages.',
  },
  {
    title: 'Invest in one click',
    text: 'Our non-custodial router on Monad mainnet wraps and deposits in a single transaction. The position lands in your wallet, not ours.',
  },
];

export default function Landing() {
  const [protocols, setProtocols] = useState<Protocol[]>([]);

  useEffect(() => {
    fetch('/api/protocols')
      .then((res) => res.json())
      .then((data: { protocols?: Protocol[] }) => setProtocols(data.protocols ?? []))
      .catch(() => {});
  }, []);

  // One card per protocol: its best pool across assets.
  const uniqueProtocols = useMemo(() => {
    const byName = new Map<string, { protocol: Protocol; assets: string[] }>();
    for (const p of protocols) {
      const existing = byName.get(p.name);
      if (!existing) {
        byName.set(p.name, { protocol: p, assets: p.asset ? [p.asset] : [] });
      } else {
        if (p.apy > existing.protocol.apy) existing.protocol = p;
        if (p.asset && !existing.assets.includes(p.asset)) existing.assets.push(p.asset);
      }
    }
    return [...byName.values()].sort((a, b) => b.protocol.apy - a.protocol.apy);
  }, [protocols]);

  const bestApy = uniqueProtocols[0]?.protocol.apy;

  return (
    <>
      <FloatingBackground />

      <header className="sticky top-0 z-10 border-b border-ink/10 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1160px] items-center justify-between px-8 py-3.5">
          <Link href="/" className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Yield Field" className="h-8 w-8" />
            <span className="text-[17px] font-semibold tracking-[-0.01em]">Yield Field</span>
            <span className="rounded-full bg-ink/5 px-[9px] py-1 text-[11px] font-semibold uppercase tracking-[0.04em] text-ink/45">
              Monad
            </span>
          </Link>
          <Link
            href="/app"
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-accent px-6 text-sm font-semibold text-white transition-colors hover:bg-[#5B3FD9]"
          >
            Launch App
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1160px] px-8 pb-24">
        {/* Hero */}
        <section className="flex flex-col items-center py-24 text-center">
          <h1 className="max-w-[760px] text-5xl font-semibold leading-[1.08] tracking-[-0.02em] md:text-6xl">
            Every yield on Monad.
            <br />
            <span className="text-accent">One screen.</span>
          </h1>
          <p className="mt-6 max-w-[560px] text-lg leading-relaxed text-ink/55">
            Yield Field is a DeFi aggregator for everyday people who&apos;d love to see the
            ecosystem&apos;s possibilities in one place: what your assets would approximately
            earn across the protocols - and a way in without leaving the page.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/app"
              className="inline-flex min-h-[48px] items-center rounded-full bg-accent px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#5B3FD9]"
            >
              Compare yields now
            </Link>
            <a
              href="https://github.com/StanislavNechyporenko/Yield-Field"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[48px] items-center rounded-full bg-ink/5 px-7 text-[15px] font-semibold text-ink/70 transition-colors hover:bg-ink/10"
            >
              GitHub
            </a>
          </div>

          <div className="mt-14 flex flex-wrap items-center justify-center gap-x-10 gap-y-4 text-sm text-ink/50">
            <span>
              <span className="font-semibold text-ink">{protocols.length || '—'}</span> live
              pools
            </span>
            <span>
              best right now{' '}
              <span className="font-semibold text-accent">
                {bestApy ? `~${bestApy.toFixed(1)}% APY` : '—'}
              </span>
            </span>
            <span>
              <span className="font-semibold text-ink">4</span> assets: MON · USDC · USDT ·
              AUSD
            </span>
            <span>
              <span className="font-semibold text-ink">non-custodial</span> router on mainnet
            </span>
          </div>
        </section>

        {/* How it works */}
        <section className="py-10">
          <h2 className="mb-8 text-center text-2xl font-semibold">How it works</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <div
                key={step.title}
                className="rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_1px_2px_rgba(20,18,27,0.04)]"
              >
                <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-accent/[0.14] text-sm font-bold text-accent">
                  {i + 1}
                </div>
                <h3 className="mb-2 text-[15px] font-semibold">{step.title}</h3>
                <p className="text-sm leading-relaxed text-ink/55">{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Protocols */}
        <section className="py-10">
          <h2 className="mb-2 text-center text-2xl font-semibold">
            The protocols, side by side
          </h2>
          <p className="mb-8 text-center text-sm text-ink/50">
            Live rates - the same numbers the protocols show in their own apps.
          </p>
          {uniqueProtocols.length === 0 ? (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-3xl bg-ink/5" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {uniqueProtocols.map(({ protocol, assets }) => (
                <Link
                  key={protocol.name}
                  href={`/app?p=${encodeURIComponent(protocol.id)}`}
                  className="group rounded-3xl border border-ink/10 bg-white p-5 shadow-[0_1px_2px_rgba(20,18,27,0.04)] transition-colors hover:border-accent/40"
                >
                  <div className="flex items-center gap-3">
                    <ProtocolIcon name={protocol.name} size={38} radius={11} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{protocol.name}</p>
                      <p className="text-xs text-ink/45">{assets.join(' · ')}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-lg font-bold text-accent">
                    ~{protocol.apy.toFixed(1)}%{' '}
                    <span className="text-xs font-medium text-ink/40">APY</span>
                  </p>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Non-custodial */}
        <section className="py-10">
          <div className="rounded-3xl bg-ink p-10 text-center">
            <h2 className="text-2xl font-semibold text-white">
              Your money never touches our hands
            </h2>
            <p className="mx-auto mt-3 max-w-[560px] text-sm leading-relaxed text-white/55">
              One-click deposits go through an on-chain router that holds nothing: your
              position is minted straight to your wallet in the same transaction. Open source,
              covered by tests, live on Monad mainnet.
            </p>
            {ROUTER_ADDRESS && (
              <div className="mt-5">
                <a
                  href={`https://monadexplorer.com/address/${ROUTER_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block break-all font-mono text-xs text-accent-light underline-offset-4 transition-colors hover:text-white hover:underline"
                  title="View the router on Monad Explorer"
                >
                  {ROUTER_ADDRESS} ↗
                </a>
              </div>
            )}
            <Link
              href="/app"
              className="mt-7 inline-flex min-h-[48px] items-center rounded-full bg-accent px-7 text-[15px] font-semibold text-white transition-colors hover:bg-[#5B3FD9]"
            >
              Launch App
            </Link>
          </div>
        </section>

        <footer className="pt-10 text-center text-xs leading-relaxed text-ink/40">
          <p>
            Yields are estimates based on current rates and are not guaranteed. Yield Field is
            an aggregation interface - deposits go to third-party protocols at your own risk.
          </p>
          <p className="mt-2">Built for the Monad ecosystem.</p>
        </footer>
      </main>
    </>
  );
}
