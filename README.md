# Yield Field — DeFi Yield Aggregator for Monad

Every yield opportunity on Monad, on one screen. Live rates, honest risk scoring, your whole portfolio read straight from the chain, and one-click deposits through a non-custodial router deployed on Monad mainnet.

**Problem.** Choosing where to put your assets on Monad means a dozen open tabs, and the numbers never match: a protocol's site shows one APY, aggregators show another, and nobody explains why.

**Solution.** Yield Field aggregates every earning protocol on Monad, pulls rates from the protocols' own APIs where they expose one, converts everything into "here is what your money makes per month", and lets you enter a position in a single transaction.

## Live deployments

| Contract | Network | Address |
| --- | --- | --- |
| `YieldZapRouter` (v2) | Monad mainnet (143) | `0x5149b7392cCb52D0cF8CbB30dCdE95fb3c990CBE` |
| `ProtocolAggregator` (prototype) | Monad testnet (10143) | `0x8825AE3b4E44FbC537F8c4550d04fEE4458B2cF4` |

## What it does

**Compare.** Live pools across Aave V3, Euler V2, Curvance, Accountable, Upshift, Pendle, ShMonad, Kintsu and Magma, filtered by the asset you actually hold: MON, USDC, USDT0 or AUSD. APY and TVL come live per pool; MON positions are priced with a live MON/USD feed.

**Trust the numbers.** Where a protocol exposes its own API (Accountable, Pendle), Yield Field shows exactly the number the protocol's app shows — including rewards — instead of a stale index. Every APY is marked as an estimate (`~`).

**Understand the risk.** The low/medium/high label is computed from measurable signals — pool TVL, how anomalous the rate is, protocol category — not assigned by hand. Staking that also earns project points (ShMonad, Kintsu, Magma) is labeled, and so are leveraged paired strategies (for example Euler looping up to ~27% APY, sourced live).

**Calculate.** Enter an amount, pick a timeframe (day / week / month / year), get the yield in the asset itself plus a USD approximation. Digits flip over like a split-flap departure board when values recalculate.

**See your whole portfolio.** Connect a wallet and Yield Field reads your positions directly from Monad mainnet — no backend, no indexer. It tracks 28 verified contracts: liquid staking tokens (shMON, sMON, gMON), Upshift's earnAUSD, every Curvance cAUSD / cUSDC / cWMON market and Curvance LST markets, with exact ERC-4626 conversions (including two-hop: cshMON to shMON to MON) plus plain wallet balances.

**Invest in one click.** For integrated protocols (Magma, Curvance markets) the Invest button routes the deposit through `YieldZapRouter` on mainnet: native MON is wrapped and deposited in a single transaction, vault shares land directly in the caller's wallet. A slippage guard (`minSharesOut`, derived from `previewDeposit` with 0.5% tolerance) protects the entry. Other protocols get a direct link to their own app.

**Share.** Every protocol card can render a share image ("I'm earning ~X% APY on MON with ...") generated on the fly at `/api/og`.

## Smart contracts

### YieldZapRouter (mainnet)

Non-custodial deposit router. It never holds user funds between transactions — there is nothing in it to drain.

- `zapMon(vault, minSharesOut)` — wrap native MON into WMON and deposit into a whitelisted ERC-4626 vault; shares are minted to `msg.sender`.
- `zapErc20(vault, assets, minSharesOut)` — same for AUSD / USDC after an exact-amount approval.
- `diversifyMon(vaults[], amounts[], minSharesOut[])` — split native MON across several vaults in one transaction; amounts must sum to `msg.value`.
- `SlippageExceeded` guard on every deposit; owner-curated vault whitelist; `rescue` / `rescueNative` for tokens accidentally sent to the router.
- ReentrancyGuard on all entry points, SafeERC20, exact approvals, custom errors. 14 passing tests.

Whitelisted vaults: Magma gMON, Curvance Bluechip cWMON, Curvance Bluechip cAUSD, Curvance cUSDC — all verified on-chain (`asset()`, `convertToAssets`) before listing.

### ProtocolAggregator (testnet prototype)

The original custodial prototype that proved the one-click flow: deposits native testnet MON via WMON into registered pools, tracks per-user principal, supports withdrawal. Kept as the testnet demo (`NEXT_PUBLIC_NETWORK_MODE=testnet`) and as the v1 the router grew out of. 20 passing tests.

```bash
npm run compile          # hardhat compile
npm run test:contracts   # all contract tests
npx hardhat run scripts/deploy-router.js --network monadMainnet   # router
npm run deploy:testnet   # testnet aggregator + mocks
```

## Data sources

| Source | Used for |
| --- | --- |
| Protocol native APIs (Accountable, Pendle) | Exact APY/TVL as shown in their own apps |
| DeFiLlama yields API | Base layer: per-pool APY/TVL for every listed protocol |
| DeFiLlama coins API | Live MON/USD price |
| Monad RPC (direct `eth_call`) | Portfolio balances and ERC-4626 conversion rates |

If a native API is unreachable the app silently falls back to the DeFiLlama layer; if that fails too, a static snapshot keeps the UI alive. Responses are cached for 5 minutes.

## Stack

Next.js 14 (App Router) · React 18 · TypeScript · Tailwind CSS · wagmi v2 + viem + RainbowKit · Solidity 0.8.20 · Hardhat · OpenZeppelin 5

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your values
npm run dev                  # http://localhost:3000
```

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` | WalletConnect Cloud (Reown) project id |
| `NEXT_PUBLIC_NETWORK_MODE` | `mainnet` (default) or `testnet` demo mode |
| `NEXT_PUBLIC_ROUTER_ADDRESS` | `YieldZapRouter` on Monad mainnet |
| `NEXT_PUBLIC_AGGREGATOR_ADDRESS` | Testnet aggregator (demo mode) |
| `NEXT_PUBLIC_MONAD_RPC_TESTNET` / `_MAINNET` | RPC endpoints for the frontend |
| `MONAD_RPC_TESTNET` / `_MAINNET` | RPC endpoints for Hardhat |
| `PRIVATE_KEY` | Deployer key for Hardhat scripts — never commit |

## Security notes

- The router is non-custodial by construction: shares are minted directly to the caller, and the contract's balance is zero between transactions.
- Approvals are always for the exact amount, never infinite.
- Deposits carry a `minSharesOut` slippage guard.
- The frontend renders all third-party API data as plain text; the OG image route sanitizes its inputs.
- The contracts are an unaudited hackathon MVP and are labeled as such in the UI. Do not treat this as production-grade custody infrastructure.

## Roadmap

- Portfolio optimizer: "your AUSD earns 9.1% here, 9.7% there" recommendations computed from positions the app already reads.
- APY history sparklines and 7/30-day averages.
- Diversify UI on top of the already-deployed `diversifyMon`.
- Project points aggregation across staking protocols.
- Multisig ownership of the router and an external audit before any fee switch.

## Disclaimer

Yields shown are estimates based on current rates and are not guaranteed. Yield Field is an aggregation and routing interface; deposits go to third-party protocols at the user's own risk. Some outbound links contain referral codes; they do not change the terms users receive.
