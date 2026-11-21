/** Decorative, deterministic listing artwork — no external image requests. */
const palettes = [
  ["#FFB88E", "#E46C6C", "#7B3F6B"],
  ["#A8DADC", "#457B9D", "#1D3557"],
  ["#F6D6A8", "#D98C72", "#7A4B51"],
  ["#CDE7C4", "#7FB069", "#2F5D50"],
  ["#E8D5F2", "#A981C4", "#54396E"],
  ["#FFD6A5", "#FDFFB6", "#9CB4A5"],
];

function hash(value: string) {
  let total = 0;
  for (let i = 0; i < value.length; i += 1) total = (total * 31 + value.charCodeAt(i)) >>> 0;
  return total;
}

export function ListingThumb({ seed, className = "" }: { seed: string; className?: string }) {
  const [a, b, c] = palettes[hash(seed) % palettes.length];
  const gradientId = `sky-${hash(seed) % 99999}`;
  return (
    <div className={`listing-thumb ${className}`} aria-hidden="true">
      <svg viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={a} />
            <stop offset="100%" stopColor={b} />
          </linearGradient>
        </defs>
        <rect width="160" height="120" fill={`url(#${gradientId})`} />
        <circle cx="122" cy="28" r="13" fill="#FFF4D6" opacity="0.85" />
        <path d="M0 92 38 52l24 25 27-33 42 48 29-24v52H0Z" fill={c} opacity="0.55" />
        <path d="M0 104 34 76l26 22 34-28 34 30 32-22v42H0Z" fill={c} opacity="0.85" />
        <path d="M64 120V86l16-13 16 13v34Z" fill="#FFF" opacity="0.9" />
        <path d="M60 88 80 70l20 18" fill="none" stroke="#FFF" strokeWidth="4" strokeLinejoin="round" opacity="0.9" />
      </svg>
    </div>
  );
}
