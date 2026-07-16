'use client';

import { useMemo, useState } from 'react';
import ProtocolIcon from '@/components/ProtocolIcon';
import type { Category, Protocol } from '@/utils/types';

interface Props {
  protocols: Protocol[];
  selectedProtocol: string | null;
  onSelectProtocol: (id: string) => void;
  loading: boolean;
  investmentAmount: number;
}

type CategoryFilter = 'all' | Category;
type SortKey = 'apy' | 'tvl' | 'risk';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'lending', label: 'Lending' },
  { value: 'dex', label: 'DEX' },
  { value: 'yield', label: 'Yield Farming' },
];

const CATEGORY_LABELS: Record<Category, string> = {
  lending: 'Lending',
  dex: 'DEX',
  yield: 'Yield Farming',
};

const RISK_ORDER: Record<Protocol['riskLevel'], number> = { low: 0, medium: 1, high: 2 };

// Per the design, risk severity is encoded as accent-dot opacity.
const RISK_DOT: Record<Protocol['riskLevel'], string> = {
  low: 'bg-accent/[0.35]',
  medium: 'bg-accent/[0.65]',
  high: 'bg-accent',
};

export default function ProtocolList({
  protocols,
  selectedProtocol,
  onSelectProtocol,
  loading,
}: Props) {
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('apy');

  const visible = useMemo(() => {
    const filtered =
      category === 'all' ? protocols : protocols.filter((p) => p.category === category);
    return [...filtered].sort((a, b) => {
      if (sortKey === 'apy') return b.apy - a.apy;
      if (sortKey === 'tvl') return b.tvl - a.tvl;
      return RISK_ORDER[a.riskLevel] - RISK_ORDER[b.riskLevel];
    });
  }, [protocols, category, sortKey]);

  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_1px_2px_rgba(20,18,27,0.04)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[17px] font-semibold">Protocols</h2>
        <select
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
          className="cursor-pointer border-none bg-transparent text-[13px] font-semibold text-ink/50 focus:outline-none"
        >
          <option value="apy">Sort · APY</option>
          <option value="tvl">Sort · TVL</option>
          <option value="risk">Sort · Risk</option>
        </select>
      </div>

      <div className="mb-[18px] flex w-fit max-w-full flex-wrap gap-0.5 rounded-xl bg-seg p-[3px]">
        {CATEGORY_FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => setCategory(value)}
            className={`whitespace-nowrap rounded-[9px] px-4 py-2 text-[13px] font-semibold transition-all ${
              category === value ? 'bg-accent text-white' : 'text-ink/55 hover:text-ink/80'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-[74px] animate-pulse rounded-xl bg-ink/5" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink/40">No protocols in this category.</p>
      ) : (
        <div className="flex max-h-[600px] flex-col overflow-y-auto">
          {visible.map((p) => {
            const isSelected = selectedProtocol === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectProtocol(p.id)}
                className={`flex items-center justify-between gap-4 border-b border-ink/5 border-l-[3px] py-[18px] pl-[13px] pr-4 text-left transition-colors ${
                  isSelected
                    ? 'border-l-accent bg-accent/[0.08]'
                    : 'border-l-transparent hover:bg-ink/[0.03]'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <ProtocolIcon name={p.name} size={38} radius={11} />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-[7px] text-sm font-semibold">
                      {p.name}
                      {p.asset && (
                        <span className="rounded-[5px] bg-ink/5 px-1.5 py-0.5 text-[10px] font-semibold text-ink/45">
                          {p.asset}
                        </span>
                      )}
                      {p.earnsPoints && (
                        <span className="rounded-[5px] bg-accent/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          ✦ Points
                        </span>
                      )}
                      {p.pairedYield && (
                        <span className="rounded-[5px] bg-accent/[0.12] px-1.5 py-0.5 text-[10px] font-semibold text-accent">
                          ⇄ up to ~{p.pairedYield.upToApy.toFixed(1)}%
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-ink/45">{CATEGORY_LABELS[p.category]}</p>
                  </div>
                </div>
                <div className="flex flex-shrink-0 items-center gap-[22px]">
                  <div className="text-right">
                    <p className="text-xs text-ink/40">APY</p>
                    <p className="mt-px text-[15px] font-bold">~{p.apy.toFixed(1)}%</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${RISK_DOT[p.riskLevel]}`} />
                    <span className="text-xs capitalize text-ink/50">{p.riskLevel} risk</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
