import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Share card: 1200×630 OG image rendered on the fly. Used by the Share
// button and as the unfurl image for shared links once deployed.
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const protocol = (searchParams.get('protocol') ?? '').slice(0, 40);
  const apy = (searchParams.get('apy') ?? '').replace(/[^0-9.]/g, '').slice(0, 8);
  const asset = (searchParams.get('asset') ?? 'MON').slice(0, 8);

  const hasRate = apy.length > 0 && protocol.length > 0;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          backgroundColor: '#14121B',
          padding: 64,
          position: 'relative',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: -140,
            right: -80,
            width: 460,
            height: 460,
            borderRadius: 9999,
            backgroundColor: 'rgba(108,79,240,0.22)',
            display: 'flex',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: -160,
            left: -80,
            width: 400,
            height: 400,
            borderRadius: 9999,
            backgroundColor: 'rgba(108,79,240,0.13)',
            display: 'flex',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
          <div
            style={{
              width: 84,
              height: 84,
              borderRadius: 26,
              backgroundColor: '#6C4FF0',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 700,
            }}
          >
            YF
          </div>
          <div style={{ display: 'flex', fontSize: 48, color: 'white' }}>Yield Field</div>
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: 'rgba(255,255,255,0.55)',
              border: '1px solid rgba(255,255,255,0.22)',
              borderRadius: 999,
              padding: '8px 22px',
              letterSpacing: 2,
            }}
          >
            MONAD
          </div>
        </div>

        {hasRate ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 38, color: 'rgba(255,255,255,0.6)' }}>
              I&apos;m earning
            </div>
            <div style={{ display: 'flex', fontSize: 132, color: '#9580F4', fontWeight: 700 }}>
              ~{apy}% APY
            </div>
            <div style={{ display: 'flex', fontSize: 38, color: 'white' }}>
              on {asset} with {protocol}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', fontSize: 76, color: 'white' }}>
              Every Monad yield.
            </div>
            <div style={{ display: 'flex', fontSize: 76, color: '#9580F4' }}>One screen.</div>
          </div>
        )}

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 24,
            color: 'rgba(255,255,255,0.45)',
          }}
        >
          <div style={{ display: 'flex' }}>The DeFi yield aggregator for Monad</div>
          <div style={{ display: 'flex' }}>Yields are estimates · not guaranteed</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
