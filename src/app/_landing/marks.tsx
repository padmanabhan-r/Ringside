/** The Ringside mark: a white R in a blue circle. */
export function RingsideMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="24" fill="var(--brand)" />
      <path d="M41.2 15.5a19 19 0 0 1-6.4 23.1" stroke="#fff" strokeOpacity="0.5" strokeWidth="2.4" strokeLinecap="round" />
      <path
        d="M17.5 35V13h8.2a6.6 6.6 0 0 1 0 13.2h-8.2M25.4 26.2 32 35"
        stroke="#fff"
        strokeWidth="4.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** PayPal's two-tone P monogram, for the hold card. */
const P_SHAPE =
  "M8.1 0h9.3c4.9 0 8 2.6 7.3 7.4-.9 5.6-4.6 8.4-10 8.4h-3.4L9.4 25.2c-.1.6-.6 1-1.2 1H2.1c-.5 0-.8-.4-.7-.9L6.9 1C7 .4 7.5 0 8.1 0Zm4.2 5.2-1.3 5.6h2.4c2 0 3.6-1 3.9-3 .3-1.6-.6-2.6-2.4-2.6h-2.6Z";

export function PayPalMonogram({ size = 40 }: { size?: number }) {
  return (
    <svg width={Math.round(size * 0.9)} height={size} viewBox="0 0 28 31" aria-hidden="true">
      <path fill="#0079c1" fillRule="evenodd" d={P_SHAPE} transform="translate(2.6 4.4)" />
      <path fill="#00266e" fillRule="evenodd" d={P_SHAPE} />
    </svg>
  );
}

/** PayPal's wordmark set in the brand's two blues. */
export function PayPalWordmark({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span style={{ color: "#002991" }}>Pay</span>
      <span style={{ color: "#0070e0" }}>Pal</span>
    </span>
  );
}
