'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';

export default function ConnectWallet() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const connected = mounted && account && chain;

        return (
          <div
            {...(!mounted && {
              'aria-hidden': true,
              style: { opacity: 0, pointerEvents: 'none' as const, userSelect: 'none' as const },
            })}
          >
            {!connected ? (
              <button
                type="button"
                onClick={openConnectModal}
                className="min-h-[40px] rounded-full bg-accent px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#5B3FD9]"
              >
                Connect Wallet
              </button>
            ) : chain.unsupported ? (
              <button
                type="button"
                onClick={openChainModal}
                className="min-h-[40px] rounded-full bg-red-500 px-4 text-[13px] font-semibold text-white hover:bg-red-600"
              >
                Wrong network
              </button>
            ) : (
              <button
                type="button"
                onClick={openAccountModal}
                className="flex min-h-[40px] items-center gap-2 rounded-full bg-ink/5 px-4 text-[13px] font-semibold text-ink transition-colors hover:bg-ink/10"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                {account.displayName}
              </button>
            )}
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
