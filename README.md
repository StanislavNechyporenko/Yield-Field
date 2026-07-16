# 💰 Yield Field — DeFi Aggregator for Monad

One place where investors see every DeFi protocol on Monad with live APY, calculate expected returns, and invest in one click.

**Problem:** DeFi investors lose 30+ minutes comparing yields across protocols.
**Solution:** We aggregate all protocols, show APY side by side, calculate returns automatically, and route deposits through a single smart contract.

## Features

- 8 Monad protocols in one list (Aave V3, Morpho Blue, Euler V2, Curvance, Ambient, Wombat, aPriori, TimeSwap)
- Yield calculator — amount × timeframe (day / week / month / year)
- Filter by category (Lending / DEX / Yield Farming) and sort by APY, TVL, or risk
- Wallet connection (MetaMask, WalletConnect) via wagmi
- One-click deposit through the `ProtocolAggregator` contract (Aave V3 and Morpho Blue in this MVP)
- `/api/protocols` enriches TVL from DeFiLlama with a 5-minute in-memory cache and static fallback

## Stack

Next.js 14 · React 18 · TypeScript · Tailwind CSS · wagmi v2 + viem + RainbowKit · Solidity 0.8.20 · Hardhat · Monad (testnet chainId 10143, mainnet chainId 143)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect Cloud project id |
| `NEXT_PUBLIC_MONAD_RPC_TESTNET` / `_MAINNET` | RPC endpoints for the frontend |
| `MONAD_RPC_TESTNET` / `_MAINNET` | RPC endpoints for Hardhat |
| `PRIVATE_KEY` | Deployer key — **testnet only, never commit** |
| `NEXT_PUBLIC_AGGREGATOR_ADDRESS` | Deployed `ProtocolAggregator` address |
| `NEXT_PUBLIC_INVEST_ASSET_ADDRESS` | Whitelisted ERC-20 used for deposits |
| `AAVE_POOL_ADDRESS`, `MORPHO_VAULT_ADDRESS`, `INVEST_ASSET_ADDRESS` | Optional: auto-registered by the deploy script |

## Smart contracts

```bash
npm run compile          # hardhat compile
npm run test:contracts   # hardhat test (mock pools, 12 tests)
npm run deploy:testnet   # deploy to Monad testnet
npm run deploy:mainnet   # deploy to Monad mainnet
```

`ProtocolAggregator.sol` holds pool positions and tracks per-user principal:

- `depositToAave` / `depositToMorpho` — transferFrom user → approve pool → supply/deposit
- `withdrawFromAave` / `withdrawFromMorpho` — principal-only withdrawal back to the user
- `registerProtocol`, `addSupportedAsset`, `emergencyWithdraw` — owner only
- ReentrancyGuard on all state-changing functions, SafeERC20 everywhere, custom errors

> ⚠️ MVP limitation: per-user accounting tracks deposited principal only; accrued yield remains in the pool position and is not distributed by this version.

## Architecture

```
app/page.tsx            state + layout (amount, timeframe, selected protocol)
components/             YieldCalculator · ProtocolList · ConnectWallet
app/api/protocols/      aggregates protocol data (DeFiLlama TVL + curated APY)
utils/invest.ts         approve + deposit flow via wagmi actions
contracts/              ProtocolAggregator.sol + test mocks
scripts/deploy.js       deploy + optional pool registration
```

Yield formula: `amount × (apy / 100) × (days / 365)`.

## Deployment

```bash
npm run build && vercel --prod    # frontend
npm run deploy:testnet            # contract, then copy the address into .env.local
```

## Troubleshooting

- **Network error** — check the RPC URL in `.env.local`
- **Insufficient balance** — get testnet MON from https://faucet.monad.xyz
- **MetaMask not connecting** — clear the MetaMask cache, refresh, or use WalletConnect
- **Deploy fails** — verify `PRIVATE_KEY` and that the deployer has MON for gas
