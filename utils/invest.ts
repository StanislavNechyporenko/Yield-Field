import { erc20Abi, parseEther, parseUnits } from 'viem';
import { switchChain, waitForTransactionReceipt, writeContract } from 'wagmi/actions';
import { config } from '@/wagmi-config';
import { monadMainnet, monadTestnet } from '@/utils/chains';

/** Prompt the wallet to switch (and add, if unknown) the target chain. */
async function ensureChain(
  chainId: typeof monadMainnet.id | typeof monadTestnet.id,
  label: string
): Promise<void> {
  try {
    await switchChain(config, { chainId });
  } catch {
    throw new Error(`Switch your wallet to ${label} and try again.`);
  }
}

export type InvestStatus = 'idle' | 'approving' | 'depositing' | 'success' | 'error';

export const AGGREGATOR_ADDRESS = process.env.NEXT_PUBLIC_AGGREGATOR_ADDRESS as
  | `0x${string}`
  | undefined;

// Protocols with a live on-chain integration in ProtocolAggregator.sol.
// Deposits are made in native MON (wrapped to WMON by the contract).
export const ON_CHAIN_PROTOCOLS: Record<
  string,
  {
    protocolId: bigint;
    deposit: 'depositNativeToAave' | 'depositNativeToMorpho';
    withdraw: 'withdrawNativeFromAave' | 'withdrawNativeFromMorpho';
  }
> = {
  'aave-v3': {
    protocolId: 0n,
    deposit: 'depositNativeToAave',
    withdraw: 'withdrawNativeFromAave',
  },
  'morpho-blue': {
    protocolId: 1n,
    deposit: 'depositNativeToMorpho',
    withdraw: 'withdrawNativeFromMorpho',
  },
};

export const aggregatorAbi = [
  { type: 'function', name: 'depositNativeToAave', stateMutability: 'payable', inputs: [], outputs: [] },
  { type: 'function', name: 'depositNativeToMorpho', stateMutability: 'payable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'withdrawNativeFromAave',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawNativeFromMorpho',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'deposited',
    stateMutability: 'view',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'protocolId', type: 'uint256' },
      { name: 'asset', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'wmon',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'getUserInvestments',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      {
        type: 'tuple[]',
        components: [
          { name: 'protocol', type: 'uint8' },
          { name: 'asset', type: 'address' },
          { name: 'amount', type: 'uint256' },
          { name: 'timestamp', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export async function invest(
  protocolId: string,
  amountMon: number,
  onStatus: (status: InvestStatus) => void
): Promise<void> {
  const entry = ON_CHAIN_PROTOCOLS[protocolId];
  if (!entry) {
    throw new Error('On-chain deposits for this protocol are coming soon.');
  }
  if (!AGGREGATOR_ADDRESS) {
    throw new Error('Contract is not configured. Set NEXT_PUBLIC_AGGREGATOR_ADDRESS in .env.local.');
  }
  if (!Number.isFinite(amountMon) || amountMon <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }

  await ensureChain(monadTestnet.id, 'Monad testnet');

  onStatus('depositing');
  const hash = await writeContract(config, {
    address: AGGREGATOR_ADDRESS,
    abi: aggregatorAbi,
    functionName: entry.deposit,
    value: parseEther(amountMon.toString()),
    chainId: monadTestnet.id,
  });
  await waitForTransactionReceipt(config, { hash, chainId: monadTestnet.id });

  onStatus('success');
}

// --------------------------------------------- mainnet zap router (v2)

export const ROUTER_ADDRESS = process.env.NEXT_PUBLIC_ROUTER_ADDRESS as
  | `0x${string}`
  | undefined;

export const routerAbi = [
  {
    type: 'function',
    name: 'zapMon',
    stateMutability: 'payable',
    inputs: [{ name: 'vault', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'zapErc20',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'vault', type: 'address' },
      { name: 'assets', type: 'uint256' },
    ],
    outputs: [{ type: 'uint256' }],
  },
] as const;

type ZapTarget =
  | { kind: 'native'; vault: `0x${string}` }
  | { kind: 'erc20'; vault: `0x${string}`; asset: `0x${string}`; decimals: number };

// Protocol entry id → whitelisted mainnet vault the router deposits into.
export const MAINNET_ZAPS: Record<string, ZapTarget> = {
  'magma-mon': {
    kind: 'native',
    vault: '0x8498312A6B3CbD158bf0c93AbdCF29E6e4F55081', // gMON
  },
  'curvance-ausd': {
    kind: 'erc20',
    vault: '0x6E182EB501800C555bd5E662E6D350D627F504D8', // Bluechip cAUSD
    asset: '0x00000000eFE302BEAA2b3e6e1b18d08D69a9012a',
    decimals: 6,
  },
  'curvance-usdc': {
    kind: 'erc20',
    vault: '0x8EE9FC28B8Da872c38A496e9dDB9700bb7261774', // cUSDC
    asset: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    decimals: 6,
  },
};

/** One-click mainnet deposit through YieldZapRouter; shares go to the caller. */
export async function zapInvest(
  protocolId: string,
  amount: number,
  onStatus: (status: InvestStatus) => void
): Promise<void> {
  const zap = MAINNET_ZAPS[protocolId];
  if (!zap) throw new Error('This protocol has no router integration yet.');
  if (!ROUTER_ADDRESS) throw new Error('Router is not configured.');
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Enter an amount greater than zero.');
  }

  await ensureChain(monadMainnet.id, 'Monad mainnet');

  if (zap.kind === 'native') {
    onStatus('depositing');
    const hash = await writeContract(config, {
      address: ROUTER_ADDRESS,
      abi: routerAbi,
      functionName: 'zapMon',
      args: [zap.vault],
      value: parseEther(amount.toString()),
      chainId: monadMainnet.id,
    });
    await waitForTransactionReceipt(config, { hash, chainId: monadMainnet.id });
  } else {
    const assets = parseUnits(amount.toString(), zap.decimals);
    onStatus('approving');
    const approveHash = await writeContract(config, {
      address: zap.asset,
      abi: erc20Abi,
      functionName: 'approve',
      args: [ROUTER_ADDRESS, assets],
      chainId: monadMainnet.id,
    });
    await waitForTransactionReceipt(config, { hash: approveHash, chainId: monadMainnet.id });

    onStatus('depositing');
    const hash = await writeContract(config, {
      address: ROUTER_ADDRESS,
      abi: routerAbi,
      functionName: 'zapErc20',
      args: [zap.vault, assets],
      chainId: monadMainnet.id,
    });
    await waitForTransactionReceipt(config, { hash, chainId: monadMainnet.id });
  }

  onStatus('success');
}

export async function withdrawNative(protocolKey: string, amountWei: bigint): Promise<void> {
  const entry = ON_CHAIN_PROTOCOLS[protocolKey];
  if (!entry) throw new Error('Unknown protocol.');
  if (!AGGREGATOR_ADDRESS) throw new Error('Contract is not configured.');
  if (amountWei <= 0n) throw new Error('Nothing to withdraw.');

  await ensureChain(monadTestnet.id, 'Monad testnet');

  const hash = await writeContract(config, {
    address: AGGREGATOR_ADDRESS,
    abi: aggregatorAbi,
    functionName: entry.withdraw,
    args: [amountWei],
    chainId: monadTestnet.id,
  });
  await waitForTransactionReceipt(config, { hash, chainId: monadTestnet.id });
}
