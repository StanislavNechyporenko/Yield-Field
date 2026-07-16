'use client';

// Split-flap display: each character is keyed by position + value, so when a
// digit changes React remounts that span and the flapIn animation plays for
// the changed characters only, with a slight left-to-right stagger.
export default function FlipText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={`flip-text ${className ?? ''}`} aria-label={text}>
      {text.split('').map((char, i) => (
        <span
          key={`${i}-${char}`}
          className="flip-char"
          style={{ animationDelay: `${Math.min(i * 28, 280)}ms` }}
          aria-hidden
        >
          {char}
        </span>
      ))}
    </span>
  );
}
