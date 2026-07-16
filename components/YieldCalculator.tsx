'use client';

import { useState } from 'react';
import FlipText from '@/components/FlipText';
import { formatAmount, formatUSD } from '@/utils/format';
import { INVEST_ASSETS, type InvestAsset, type Protocol, type Timeframe } from '@/utils/types';

// "1000.5" → "1,000.5" while keeping whatever decimals the user is typing.
function formatAmountInput(cleaned: string): string {
  const [intPart, decPart] = cleaned.split('.');
  const grouped = (intPart === '' ? '0' : intPart).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return cleaned.includes('.') ? `${grouped}.${decPart ?? ''}` : grouped;
}

interface Props {
  amount: number;
  onAmountChange: (amount: number) => void;
  asset: InvestAsset;
  onAssetChange: (asset: InvestAsset) => void;
  /** USD per 1 unit of the selected asset; 0 hides the USD approximation. */
  assetPriceUsd: number;
  timeframe: Timeframe;
  onTimeframeChange: (timeframe: Timeframe) => void;
  estimatedYield: number;
  selectedProtocol: Protocol | undefined;
}

const TIMEFRAMES: Timeframe[] = ['day', 'week', 'month', 'year'];

function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="mb-5 flex gap-0.5 rounded-xl bg-seg p-[3px]">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-[9px] py-2 font-semibold transition-all ${
            size === 'sm' ? 'text-xs' : 'text-[13px]'
          } ${
            value === opt.value
              ? 'bg-white text-ink shadow-[0_1px_3px_rgba(20,18,27,0.16)]'
              : 'text-ink/50 hover:text-ink/70'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export default function YieldCalculator({
  amount,
  onAmountChange,
  asset,
  onAssetChange,
  assetPriceUsd,
  timeframe,
  onTimeframeChange,
  estimatedYield,
  selectedProtocol,
}: Props) {
  const [amountText, setAmountText] = useState(() =>
    amount > 0 ? formatAmountInput(String(amount)) : ''
  );

  const handleAmountInput = (value: string) => {
    // Strip grouping commas and anything that's not a digit or dot.
    const cleaned = value.replace(/,/g, '').replace(/[^\d.]/g, '');
    if (cleaned === '') {
      setAmountText('');
      onAmountChange(0);
      return;
    }
    if (!/^\d*\.?\d*$/.test(cleaned)) return;
    setAmountText(formatAmountInput(cleaned));
    const parsed = Number(cleaned);
    onAmountChange(Number.isFinite(parsed) ? parsed : 0);
  };

  const usd = (value: number) =>
    assetPriceUsd > 0 ? `≈ ${formatUSD(value * assetPriceUsd)}` : '';

  return (
    <div className="rounded-3xl border border-ink/10 bg-white p-7 shadow-[0_1px_2px_rgba(20,18,27,0.04)]">
      <p className="mb-[18px] text-xs font-semibold uppercase tracking-[0.06em] text-ink/40">
        Calculator
      </p>

      <p className="mb-2 text-[13px] text-ink/50">Asset</p>
      <Segmented
        options={INVEST_ASSETS.map((a) => ({ value: a, label: a }))}
        value={asset}
        onChange={onAssetChange}
      />

      <label htmlFor="amount" className="mb-2 block text-[13px] text-ink/50">
        Amount ({asset})
      </label>
      <input
        id="amount"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={amountText}
        placeholder="1,000"
        onChange={(e) => handleAmountInput(e.target.value)}
        className="mb-1 w-full rounded-[14px] border border-ink/10 bg-field px-4 py-3.5 text-[26px] font-semibold text-ink focus:outline-none focus:ring-2 focus:ring-accent/60"
      />
      <p className="mb-5 min-h-[16px] text-xs text-ink/40">
        {amount > 0 ? usd(amount) : ''}
      </p>

      <p className="mb-2 text-[13px] text-ink/50">Timeframe</p>
      <Segmented
        options={TIMEFRAMES.map((tf) => ({
          value: tf,
          label: tf.charAt(0).toUpperCase() + tf.slice(1),
        }))}
        value={timeframe}
        onChange={onTimeframeChange}
        size="sm"
      />

      <div className="mb-3 rounded-2xl bg-ink px-5 py-[18px]">
        <p className="mb-1 text-xs text-white/55">Estimated yield ({timeframe})</p>
        <p className="text-2xl font-bold text-accent-light">
          {selectedProtocol ? (
            <FlipText text={`+${formatAmount(estimatedYield, asset)}`} />
          ) : (
            '—'
          )}
        </p>
        <p className="mt-1 min-h-[14px] text-xs text-white/40">
          {selectedProtocol ? usd(estimatedYield) : ''}
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-ink/10 bg-field px-5 py-[18px]">
        <p className="mb-1 text-xs text-ink/50">Total after {timeframe}</p>
        <p className="text-[22px] font-bold">
          {selectedProtocol ? (
            <FlipText text={formatAmount(amount + estimatedYield, asset)} />
          ) : (
            '—'
          )}
        </p>
        <p className="mt-1 min-h-[14px] text-xs text-ink/40">
          {selectedProtocol ? usd(amount + estimatedYield) : ''}
        </p>
      </div>

      {!selectedProtocol && (
        <p className="text-[13px] text-ink/45">Select a protocol to see estimated returns.</p>
      )}
      <p className="mt-3 text-[11px] text-ink/35">
        Yields are estimates based on current APY and are not guaranteed.
      </p>
    </div>
  );
}
