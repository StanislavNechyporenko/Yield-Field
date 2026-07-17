import type { InvestAsset } from './types';

// Receipt tokens on Monad mainnet whose balance represents a user's position
// in a protocol. Addresses verified on-chain via rpc.monad.xyz (symbol,
// decimals, and asset()/convertToAssets for the ERC-4626 ones).
export interface PositionSource {
  id: string;
  protocol: string;
  tokenSymbol: string;
  token: `0x${string}`;
  /** erc4626 — convertToAssets gives the exact underlying amount; erc20 — shown ≈1:1. */
  kind: 'erc4626' | 'erc20';
  asset: InvestAsset;
  decimals: number;
  /**
   * Second conversion hop for receipts of LSTs (e.g. cshMON → shMON → MON).
   * erc4626 hop converts exactly; erc20 hop keeps the amount ≈1:1.
   */
  secondHop?: { token: `0x${string}`; kind: 'erc4626' | 'erc20' };
  /** erc20 receipts that rebase 1:1 with the asset (Aave aTokens) are exact, not ≈. */
  exact?: boolean;
}

const SHMON = '0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c' as const;
const SMON = '0xA3227C5969757783154C60bF0bC1944180ed81B9' as const;
const GMON = '0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081' as const;
const APRMON = '0x0c65A0BC65a5D819235B71F554D210D3F80E0852' as const;

// Plain asset balances shown as "available in wallet".
export const WALLET_TOKENS: {
  symbol: string;
  token: `0x${string}`;
  asset: InvestAsset;
  decimals: number;
}[] = [
  {
    symbol: 'USDC',
    token: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    asset: 'USDC',
    decimals: 6,
  },
  {
    symbol: 'AUSD',
    token: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    asset: 'AUSD',
    decimals: 6,
  },
  {
    symbol: 'USDT0',
    token: '0xe7cd86e13AC4309349F30B3435a9d337750fC82D',
    asset: 'USDT',
    decimals: 6,
  },
];

export const POSITION_SOURCES: PositionSource[] = [
  {
    id: 'shmonad',
    protocol: 'ShMonad',
    tokenSymbol: 'shMON',
    token: SHMON,
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
  },
  {
    id: 'kintsu',
    protocol: 'Kintsu',
    tokenSymbol: 'sMON',
    token: SMON,
    kind: 'erc20',
    asset: 'MON',
    decimals: 18,
  },
  {
    id: 'magma',
    protocol: 'Magma',
    tokenSymbol: 'gMON',
    token: GMON,
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
  },
  {
    id: 'apriori',
    protocol: 'aPriori',
    tokenSymbol: 'aprMON',
    token: APRMON,
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
  },
  // Aave V3 lending: rebasing aTokens, balance equals the underlying 1:1
  // (addresses from the monad-crypto/protocols registry, verified on-chain).
  {
    id: 'aave-usdt0',
    protocol: 'Aave V3',
    tokenSymbol: 'aUSDT0',
    token: '0x9531E6bC99D7F7f0596ed7bA5b846Ba9Eb60468c',
    kind: 'erc20',
    asset: 'USDT',
    decimals: 6,
    exact: true,
  },
  {
    id: 'aave-usdc',
    protocol: 'Aave V3',
    tokenSymbol: 'aUSDC',
    token: '0x35a73BAcb179d3740395A3ceCc87FF2e581d6042',
    kind: 'erc20',
    asset: 'USDC',
    decimals: 6,
    exact: true,
  },
  {
    id: 'aave-ausd',
    protocol: 'Aave V3',
    tokenSymbol: 'aAUSD',
    token: '0xdeBFeDF35faEd5d1664E553545e144C02227A2Ec',
    kind: 'erc20',
    asset: 'AUSD',
    decimals: 6,
    exact: true,
  },
  // Curvance LST markets: cToken → LST → MON (two conversion hops).
  {
    id: 'curvance-aprmon',
    protocol: 'Curvance · aprMON mkt',
    tokenSymbol: 'caprMON',
    token: '0xD9E2025b907E95EcC963A5018f56B87575B4aB26',
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
    secondHop: { token: APRMON, kind: 'erc4626' },
  },
  {
    id: 'curvance-shmon',
    protocol: 'Curvance · shMON mkt',
    tokenSymbol: 'cshMON',
    token: '0x926C101Cf0a3dE8725Eb24a93E980f9FE34d6230',
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
    secondHop: { token: SHMON, kind: 'erc4626' },
  },
  {
    id: 'curvance-smon',
    protocol: 'Curvance · sMON mkt',
    tokenSymbol: 'csMON',
    token: '0x494876051B0E85dCe5ecd5822B1aD39b9660c928',
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
    secondHop: { token: SMON, kind: 'erc20' },
  },
  {
    id: 'curvance-gmon',
    protocol: 'Curvance · gMON mkt',
    tokenSymbol: 'cgMON',
    token: '0x5ca6966543c0786f547446234492D2F11C82f11f',
    kind: 'erc4626',
    asset: 'MON',
    decimals: 18,
    secondHop: { token: GMON, kind: 'erc4626' },
  },
  // Curvance USDC lending markets (cUSDC is ERC-4626 over USDC).
  ...(
    [
      ['usdc-wmon', 'WMON mkt', '0x8EE9FC28B8Da872c38A496e9dDB9700bb7261774'],
      ['usdc-wbtc', 'WBTC mkt', '0x7C9d4f1695C6282Da5e5509Aa51fC9fb417C6f1d'],
      ['usdc-weth', 'WETH mkt', '0x21aDBb60a5fB909e7F1fB48aACC4569615CD97b5'],
      ['usdc-avant', 'Avant mkt', '0x9891178A1178E4C740Fa61Fd6e30A9D92D897590'],
    ] as const
  ).map(([key, market, token]) => ({
    id: `curvance-${key}`,
    protocol: `Curvance · ${market}`,
    tokenSymbol: 'cUSDC',
    token: token as `0x${string}`,
    kind: 'erc4626' as const,
    asset: 'USDC' as const,
    decimals: 6,
  })),
  // Curvance WMON lending across its markets (WMON unwraps to MON 1:1).
  ...(
    [
      ['wmon-bluechip', 'Bluechip', '0xE01d426B589c7834a5F6B20D7e992A705d3c22ED'],
      ['wmon-usdc', 'USDC mkt', '0x1e240E30E51491546deC3aF16B0b4EAC8Dd110D4'],
      ['wmon-shmon', 'shMON mkt', '0x0fcEd51b526BfA5619F83d97b54a57e3327eB183'],
      ['wmon-aprmon', 'aprMON mkt', '0xF32B334042DC1EB9732454cc9bc1a06205d184f2'],
      ['wmon-smon', 'sMON mkt', '0xebE45A6ceA7760a71D8e0fa5a0AE80a75320D708'],
      ['wmon-gmon', 'gMON mkt', '0xf473568b26B8C5aadCa9fbC0eA17E1728d5ec925'],
    ] as const
  ).map(([key, market, token]) => ({
    id: `curvance-${key}`,
    protocol: `Curvance · ${market}`,
    tokenSymbol: 'cWMON',
    token: token as `0x${string}`,
    kind: 'erc4626' as const,
    asset: 'MON' as const,
    decimals: 18,
  })),
  {
    id: 'upshift',
    protocol: 'Upshift',
    tokenSymbol: 'earnAUSD',
    token: '0x103222f020e98Bba0AD9809A011FDF8e6F067496',
    kind: 'erc20',
    asset: 'AUSD',
    decimals: 6,
  },
  // Curvance AUSD lending: one cAUSD position token per market
  // (docs.curvance.com → Monad contract addresses). All ERC-4626, so
  // convertToAssets returns the exact AUSD value including accrued yield.
  ...(
    [
      ['bluechip', 'Bluechip', '0x6E182EB501800C555bd5E662E6D350D627F504D8'],
      ['upshift-a', 'Upshift', '0xfD493ce1A0ae986e09d17004B7E748817a47d73c'],
      ['upshift-b', 'Upshift II', '0xAd4AA2a713fB86FBb6b60dE2aF9E32a11DB6Abf2'],
      ['yuzu-a', 'Yuzu', '0x8E94704607E857eB3E10Bd21D90bf8C1Ecba0452'],
      ['yuzu-b', 'Yuzu II', '0xcdc9D2c4EaD8f2A9FD3D6F5a00bA4e6001ab7898'],
      ['reservoir', 'Reservoir', '0x88e0994E8130EF72bf614CBBcF722839B167c8d1'],
      ['valos', 'Valos', '0x4806902Ec0320e5334c2B2679FFB58C830348F1c'],
      ['mu-a', 'Mu Digital', '0x2B4e0232F46E6DB4af35474c140B968EeFCB09Ec'],
      ['mu-b', 'Mu Digital II', '0xDaDbB2D8f9802DC458F5D7F133D053087Ba8983d'],
      ['avant', 'Avant', '0xD1BFEA1728ffe98F515f26082fACfcc3341691D4'],
    ] as const
  ).map(([key, market, token]) => ({
    id: `curvance-${key}`,
    protocol: `Curvance · ${market}`,
    tokenSymbol: 'cAUSD',
    token: token as `0x${string}`,
    kind: 'erc4626' as const,
    asset: 'AUSD' as const,
    decimals: 6,
  })),
];
