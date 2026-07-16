import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { monadTestnet, monadMainnet } from './utils/chains';

export const config = getDefaultConfig({
  appName: 'Yield Field',
  projectId: process.env.NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID || 'YIELD_FINDER_DEMO',
  chains: [monadTestnet, monadMainnet],
  ssr: true,
});
