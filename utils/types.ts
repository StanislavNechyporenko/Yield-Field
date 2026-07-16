export type RiskLevel = 'low' | 'medium' | 'high';
export type Category = 'lending' | 'dex' | 'yield';
export type Timeframe = 'day' | 'week' | 'month' | 'year';

export type InvestAsset = 'MON' | 'USDC' | 'USDT' | 'AUSD';

export const INVEST_ASSETS: InvestAsset[] = ['MON', 'USDC', 'USDT', 'AUSD'];

/** USD price per asset unit; stables are pinned to 1, MON comes live from the API. */
export type AssetPrices = Record<InvestAsset, number>;

export interface Protocol {
  id: string;
  name: string;
  apy: number;
  tvl: number;
  riskLevel: RiskLevel;
  category: Category;
  logo: string;
  description: string;
  /** 'onchain' — deposit through our aggregator contract; 'external' — on the protocol's own app. */
  investType?: 'onchain' | 'external';
  /** Protocol app URL for external deposits. */
  url?: string;
  /** Asset this pool accepts; the calculator input is denominated in it. */
  asset?: InvestAsset;
  /** Staking here also earns project points on top of the APY shown. */
  earnsPoints?: boolean;
  /** Paired / leveraged strategies (multiply, looping) offered by the protocol. */
  pairedYield?: { upToApy: number };
}

export const TIMEFRAME_DAYS: Record<Timeframe, number> = {
  day: 1,
  week: 7,
  month: 30,
  year: 365,
};
