'use client';

import { initials } from '@/utils/format';

// Maps a protocol/position name to an icon in public/icons; longer keys
// first so e.g. "shmon" wins over "smon".
const ICON_MATCHERS: [string, string][] = [
  ['accountable', 'accountable'],
  ['curvance', 'curvance'],
  ['shmonad', 'shmonad'],
  ['upshift', 'upshift'],
  ['kintsu', 'kintsu'],
  ['pendle', 'pendle'],
  ['morpho', 'morpho'],
  ['euler', 'euler'],
  ['magma', 'magma'],
  ['shmon', 'shmonad'],
  ['aave', 'aave'],
  ['gmon', 'magma'],
  ['smon', 'kintsu'],
];

export function protocolIconSrc(name: string): string | null {
  const key = name.toLowerCase();
  for (const [match, file] of ICON_MATCHERS) {
    if (key.includes(match)) return `/icons/${file}.png`;
  }
  return null;
}

export default function ProtocolIcon({
  name,
  size,
  radius,
}: {
  name: string;
  size: number;
  radius: number;
}) {
  const src = protocolIconSrc(name);
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="flex-shrink-0 object-cover"
        style={{ width: size, height: size, borderRadius: radius }}
      />
    );
  }
  return (
    <div
      className="flex flex-shrink-0 items-center justify-center bg-accent/[0.14] font-bold text-accent"
      style={{ width: size, height: size, borderRadius: radius, fontSize: Math.round(size * 0.34) }}
    >
      {initials(name)}
    </div>
  );
}
