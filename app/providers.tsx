'use client';

import { useState } from 'react';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { config } from '@/wagmi-config';
import { monadTestnet } from '@/utils/chains';
import '@rainbow-me/rainbowkit/styles.css';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={lightTheme({ accentColor: '#6C4FF0' })} initialChain={monadTestnet}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
