import { NextResponse } from 'next/server';
import type { AssetPrices, InvestAsset, Protocol, RiskLevel } from '@/utils/types';

export const dynamic = 'force-dynamic';

// 'mainnet' — live Monad mainnet data from the DeFiLlama yields API,
// deposits happen on the protocols' own apps (non-custodial link-out).
// 'testnet' — curated demo list wired to our testnet aggregator contract.
const NETWORK_MODE = process.env.NEXT_PUBLIC_NETWORK_MODE ?? 'mainnet';

const CACHE_TTL_MS = 5 * 60 * 1000;

let cache: { mode: string; data: Protocol[]; prices: AssetPrices; timestamp: number } | null = null;

// Risk score built from measurable signals rather than hardcoded labels:
// smaller TVL means less battle-tested code and thinner liquidity, an
// unusually high APY has to be paid for by extra risk somewhere, and
// blue-chip lending is historically safer than DEX LP / yield farming.
function calculateRiskLevel(protocol: { tvl: number; apy: number; category: string }): RiskLevel {
  let score = 0;

  if (protocol.tvl < 10_000_000) score += 3;
  else if (protocol.tvl < 100_000_000) score += 2;
  else if (protocol.tvl < 1_000_000_000) score += 1;

  if (protocol.apy >= 18) score += 3;
  else if (protocol.apy >= 15) score += 2;
  else if (protocol.apy >= 12) score += 1;

  if (protocol.category !== 'lending') score += 1;

  if (score <= 1) return 'low';
  if (score <= 4) return 'medium';
  return 'high';
}

// ------------------------------------------------------------- mainnet mode

// Curated registry of protocols live on Monad mainnet. Only single-asset
// pools are listed (no two-sided LPs) so "enter an amount, get a yield"
// stays honest. APY/TVL come live from DeFiLlama per pool.
const MAINNET_PROJECTS: {
  slug: string; // DeFiLlama project slug
  id: string;
  name: string;
  category: Protocol['category'];
  logo: string;
  description: string;
  url: string;
  /** Liquid staking that also awards project points on top of APY. */
  earnsPoints?: boolean;
}[] = [
  {
    slug: 'aave-v3',
    id: 'aave-v3',
    name: 'Aave V3',
    category: 'lending',
    logo: '🏦',
    description: 'Blue-chip lending market, battle-tested across many chains.',
    url: 'https://app.aave.com',
  },
  {
    slug: 'euler-v2',
    id: 'euler-v2',
    name: 'Euler V2',
    category: 'lending',
    logo: '📐',
    description: 'Modular lending vaults with custom risk parameters.',
    url: 'https://app.euler.finance',
  },
  {
    slug: 'curvance',
    id: 'curvance',
    name: 'Curvance',
    category: 'yield',
    logo: '🌊',
    description: 'Yield vaults for stable and staked assets.',
    url: 'https://app.curvance.com/bytes?tab=referral&code=stanleyOG',
  },
  {
    slug: 'accountable',
    id: 'accountable',
    name: 'Accountable',
    category: 'yield',
    logo: '🛡️',
    description: 'Institutional-grade AUSD yield strategies.',
    url: 'https://accountable.capital',
  },
  {
    slug: 'upshift',
    id: 'upshift',
    name: 'Upshift',
    category: 'yield',
    logo: '📈',
    description: 'Curated institutional yield vaults.',
    url: 'https://app.upshift.finance',
  },
  {
    slug: 'pendle',
    id: 'pendle',
    name: 'Pendle',
    category: 'yield',
    logo: '🪁',
    description: 'Fixed and boosted yield via yield tokenization.',
    url: 'https://app.pendle.finance',
  },
  {
    slug: 'shmonad',
    id: 'shmonad',
    name: 'ShMonad',
    category: 'yield',
    logo: '⚡',
    description: 'Liquid staking for native MON (shMON) by FastLane.',
    url: 'https://shmonad.xyz',
    earnsPoints: true,
  },
  {
    slug: 'kintsu',
    id: 'kintsu',
    name: 'Kintsu',
    category: 'yield',
    logo: '💧',
    description: 'Liquid staking for native MON (sMON).',
    url: 'https://kintsu.xyz',
    earnsPoints: true,
  },
  {
    slug: 'magma-staking',
    id: 'magma',
    name: 'Magma',
    category: 'yield',
    logo: '🌋',
    description: 'Community-first liquid staking for MON (gMON).',
    url: 'https://www.magmastaking.xyz/?invitedBy=85eeb3',
    earnsPoints: true,
  },
];

// Which DeFiLlama pool symbols count as which deposit asset.
const ASSET_MATCHERS: Record<InvestAsset, (symbol: string) => boolean> = {
  MON: (s) => ['SHMON', 'SMON', 'GMON', 'APRMON'].includes(s),
  USDC: (s) => s === 'USDC',
  USDT: (s) => s === 'USDT0' || s === 'USDT',
  AUSD: (s) => s === 'AUSD' || s === 'EARNAUSD',
};

const MIN_POOL_TVL_USD = 500_000;
const MIN_POOL_APY = 0.3;

interface LlamaPool {
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number | null;
}

async function fetchMainnetProtocols(): Promise<Protocol[] | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch('https://yields.llama.fi/pools', {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body: { data: LlamaPool[] } = await res.json();
    const monadPools = body.data.filter((p) => p.chain === 'Monad');

    const protocols: Protocol[] = [];
    for (const project of MAINNET_PROJECTS) {
      const projectPools = monadPools.filter(
        (p) =>
          p.project === project.slug &&
          p.tvlUsd >= MIN_POOL_TVL_USD &&
          (p.apy ?? 0) >= MIN_POOL_APY
      );

      for (const asset of Object.keys(ASSET_MATCHERS) as InvestAsset[]) {
        // Flagship = best APY among pools with adequate liquidity (TVL floor
        // above) — this is a yield aggregator, users want the best rate.
        const flagship = projectPools
          .filter((p) => ASSET_MATCHERS[asset](p.symbol))
          .sort((a, b) => (b.apy ?? 0) - (a.apy ?? 0))[0];
        if (!flagship) continue;

        const base = {
          id: `${project.id}-${asset.toLowerCase()}`,
          name: project.name,
          apy: Math.round((flagship.apy ?? 0) * 100) / 100,
          tvl: Math.round(flagship.tvlUsd),
          category: project.category,
          logo: project.logo,
          description: `${project.description} Pool: ${flagship.symbol}.`,
          investType: 'external' as const,
          url: project.url,
          asset,
          earnsPoints: project.earnsPoints,
        };
        protocols.push({ ...base, riskLevel: calculateRiskLevel(base) });
      }
    }
    return protocols.length > 0 ? protocols : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ----------------------------------------------- native protocol adapters

// Overrides keyed by protocol entry id ('accountable-ausd', …) with the
// exact figures the protocol's own app displays. DeFiLlama stays the base
// layer; adapters win when they respond, because they include rewards and
// have no indexing lag.
type LiveOverride = { apy: number; tvl: number; poolLabel: string };

interface AccountableLoan {
  chain_id: number;
  asset_symbol: string;
  can_deposit: boolean;
  is_paused: boolean;
  net_apy: number | null;
  tvl_in_usd: number | null;
  loan_name: string;
  /** Live "up to X%" APYs of looping (paired/leveraged) strategies elsewhere. */
  looping?: { protocol: string; up_to: number }[];
}

// Accountable's looping data names protocols; map them to our entry ids.
const LOOPING_TARGETS: Record<string, string> = {
  Euler: 'euler-v2-ausd',
  Curvance: 'curvance-ausd',
  Morpho: 'morpho-ausd',
};

interface AccountableData {
  overrides: Record<string, LiveOverride>;
  paired: Record<string, number>;
}

// Same endpoint the vaults page at yield.accountable.capital calls; net_apy
// is the headline number their UI shows (rewards included).
async function fetchAccountableData(): Promise<AccountableData> {
  const empty: AccountableData = { overrides: {}, paired: {} };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://yield.accountable.capital/api/loan', {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return empty;
    const body: { items?: AccountableLoan[] } = await res.json();
    const monadVaults = (body.items ?? []).filter(
      (v) =>
        v.chain_id === 143 &&
        v.can_deposit &&
        !v.is_paused &&
        (v.net_apy ?? 0) > 0 &&
        (v.tvl_in_usd ?? 0) >= MIN_POOL_TVL_USD
    );

    const overrides: Record<string, LiveOverride> = {};
    const paired: Record<string, number> = {};
    for (const asset of ['AUSD', 'USDT', 'USDC'] as InvestAsset[]) {
      const best = monadVaults
        .filter((v) => v.asset_symbol === asset)
        .sort((a, b) => (b.net_apy ?? 0) - (a.net_apy ?? 0))[0];
      if (!best) continue;
      overrides[`accountable-${asset.toLowerCase()}`] = {
        apy: Math.round((best.net_apy ?? 0) * 100) / 100,
        tvl: Math.round(best.tvl_in_usd ?? 0),
        poolLabel: `${best.loan_name} (net APY, rewards included)`,
      };
      for (const loop of best.looping ?? []) {
        const target = LOOPING_TARGETS[loop.protocol];
        if (target && loop.up_to > 0) {
          paired[target] = Math.round(loop.up_to * 100) / 100;
        }
      }
    }
    return { overrides, paired };
  } catch {
    return empty;
  } finally {
    clearTimeout(timer);
  }
}

interface PendleMarket {
  name: string;
  details?: { impliedApy?: number; liquidity?: number };
}

// Same API the Pendle app uses; implied APY is the headline rate their UI
// shows for a market. All active Monad markets are AUSD-denominated today.
async function fetchPendleOverrides(): Promise<Record<string, LiveOverride>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://api-v2.pendle.finance/core/v1/143/markets/active', {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return {};
    const body: { markets?: PendleMarket[] } = await res.json();
    const best = (body.markets ?? [])
      .filter(
        (m) => (m.details?.liquidity ?? 0) >= MIN_POOL_TVL_USD && (m.details?.impliedApy ?? 0) > 0
      )
      .sort((a, b) => (b.details?.impliedApy ?? 0) - (a.details?.impliedApy ?? 0))[0];
    if (!best) return {};
    return {
      'pendle-ausd': {
        apy: Math.round((best.details?.impliedApy ?? 0) * 10_000) / 100,
        tvl: Math.round(best.details?.liquidity ?? 0),
        poolLabel: `${best.name} market (implied APY)`,
      },
    };
  } catch {
    return {};
  } finally {
    clearTimeout(timer);
  }
}

async function fetchNativeData(): Promise<AccountableData> {
  // Future adapters (Aave on-chain rate, staking APIs, …) merge in here.
  const [accountable, pendle] = await Promise.all([
    fetchAccountableData(),
    fetchPendleOverrides(),
  ]);
  return {
    overrides: { ...accountable.overrides, ...pendle },
    paired: accountable.paired,
  };
}

function applyOverrides(
  protocols: Protocol[],
  overrides: Record<string, LiveOverride>,
  paired: Record<string, number>
): Protocol[] {
  return protocols.map((p) => {
    let updated = p;
    const live = overrides[p.id];
    if (live) {
      updated = {
        ...updated,
        apy: live.apy,
        tvl: live.tvl,
        description: `${p.description.split(' Pool: ')[0]} Vault: ${live.poolLabel} — live via the protocol's own API.`,
      };
      updated = { ...updated, riskLevel: calculateRiskLevel(updated) };
    }
    const upToApy = paired[p.id];
    if (upToApy && upToApy > updated.apy) {
      updated = { ...updated, pairedYield: { upToApy } };
    }
    return updated;
  });
}

async function fetchMonPriceUsd(): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const res = await fetch('https://coins.llama.fi/prices/current/coingecko:monad', {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const body: { coins?: Record<string, { price?: number }> } = await res.json();
    const price = body.coins?.['coingecko:monad']?.price;
    return typeof price === 'number' && price > 0 ? price : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ------------------------------------------------------------- testnet mode

// Demo list wired to the testnet aggregator; Aave V3 and Morpho Blue accept
// real one-click deposits of testnet MON through our contract. The demo
// assumes 1 MON = $1, so prices stay at 1 in this mode.
const TESTNET_PROTOCOLS: (Omit<Protocol, 'riskLevel'> & { llamaSlug?: string })[] = [
  {
    id: 'aave-v3',
    name: 'Aave V3',
    apy: 12.5,
    tvl: 125_000_000,
    category: 'lending',
    logo: '🏦',
    description: 'Leading lending protocol with battle-tested security.',
    investType: 'onchain',
    asset: 'MON',
    llamaSlug: 'aave-v3',
  },
  {
    id: 'morpho-blue',
    name: 'Morpho Blue',
    apy: 15.8,
    tvl: 98_000_000,
    category: 'lending',
    logo: '🦋',
    description: 'Peer-to-peer lending optimizer built on isolated markets.',
    investType: 'onchain',
    asset: 'MON',
    llamaSlug: 'morpho-blue',
  },
  {
    id: 'euler-v2',
    name: 'Euler V2',
    apy: 14.2,
    tvl: 75_000_000,
    category: 'lending',
    logo: '📐',
    description: 'Modular lending platform with custom vaults.',
    asset: 'MON',
    llamaSlug: 'euler-v2',
  },
  {
    id: 'curvance',
    name: 'Curvance',
    apy: 18.5,
    tvl: 42_000_000,
    category: 'yield',
    logo: '🌊',
    description: 'Cross-chain yield optimizer for staked assets.',
    asset: 'MON',
    llamaSlug: 'curvance',
  },
  {
    id: 'ambient',
    name: 'Ambient Finance',
    apy: 9.3,
    tvl: 156_000_000,
    category: 'dex',
    logo: '🌀',
    description: 'Concentrated liquidity DEX in a single contract.',
    asset: 'MON',
    llamaSlug: 'ambient',
  },
  {
    id: 'wombat',
    name: 'Wombat',
    apy: 11.7,
    tvl: 52_000_000,
    category: 'dex',
    logo: '🐻',
    description: 'Stableswap DEX with single-sided liquidity.',
    asset: 'MON',
    llamaSlug: 'wombat-exchange',
  },
  {
    id: 'apriori',
    name: 'aPriori',
    apy: 13.2,
    tvl: 68_000_000,
    category: 'yield',
    logo: '⚡',
    description: 'MEV-powered liquid staking native to Monad.',
    asset: 'MON',
    llamaSlug: 'apriori',
  },
  {
    id: 'timeswap',
    name: 'TimeSwap Labs',
    apy: 16.8,
    tvl: 34_000_000,
    category: 'lending',
    logo: '⏳',
    description: 'Oracle-less fixed-maturity lending markets.',
    asset: 'MON',
    llamaSlug: 'timeswap',
  },
];

async function fetchLlamaTvl(slug: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetch(`https://api.llama.fi/tvl/${slug}`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const tvl = await res.json();
    return typeof tvl === 'number' && tvl > 0 ? tvl : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchTestnetProtocols(): Promise<Protocol[]> {
  return Promise.all(
    TESTNET_PROTOCOLS.map(async ({ llamaSlug, ...protocol }) => {
      const liveTvl = llamaSlug ? await fetchLlamaTvl(llamaSlug) : null;
      const enriched = liveTvl ? { ...protocol, tvl: liveTvl } : protocol;
      return { ...enriched, riskLevel: calculateRiskLevel(enriched) };
    })
  );
}

// -------------------------------------------------------------------- route

export async function GET() {
  if (cache && cache.mode === NETWORK_MODE && Date.now() - cache.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ protocols: cache.data, prices: cache.prices, mode: NETWORK_MODE });
  }

  let protocols: Protocol[];
  let prices: AssetPrices = { MON: 1, USDC: 1, USDT: 1, AUSD: 1 };

  if (NETWORK_MODE === 'mainnet') {
    const [mainnetProtocols, monPrice, native] = await Promise.all([
      fetchMainnetProtocols(),
      fetchMonPriceUsd(),
      fetchNativeData(),
    ]);
    // Fall back to the curated testnet list if DeFiLlama is unreachable.
    protocols = applyOverrides(
      mainnetProtocols ?? (await fetchTestnetProtocols()),
      native.overrides,
      native.paired
    );
    prices = { MON: monPrice ?? 0, USDC: 1, USDT: 1, AUSD: 1 };
  } else {
    protocols = await fetchTestnetProtocols();
  }

  cache = { mode: NETWORK_MODE, data: protocols, prices, timestamp: Date.now() };
  return NextResponse.json({ protocols, prices, mode: NETWORK_MODE });
}
