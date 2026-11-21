type IconProps = { className?: string };

const base = (className?: string) => ({
  className,
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
});

export function BrandMark({ className }: IconProps) {
  return (
    <svg className={className} width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M16 2.8c-2.1 0-3.5 1.5-4.4 3.6L4.3 24.3c-.7 1.6-1 2.7-1 3.6 0 2.2 1.7 3.8 3.9 3.8 1.8 0 3.5-1 4.7-2.8L16 22.1l4.1 6.8c1.2 1.8 2.9 2.8 4.7 2.8 2.2 0 3.9-1.6 3.9-3.8 0-.9-.3-2-1-3.6L20.4 6.4c-.9-2.1-2.3-3.6-4.4-3.6Z"
        fill="currentColor"
      />
      <path
        d="M16 11.2c-1.2 0-2 .9-2.6 2.2l-2.5 6.8c-.3.8-.4 1.4-.4 1.9 0 1 .8 1.8 1.8 1.8.9 0 1.7-.6 2.3-1.5l1.4-1.9 1.4 1.9c.6.9 1.4 1.5 2.3 1.5 1 0 1.8-.8 1.8-1.8 0-.5-.1-1.1-.4-1.9l-2.5-6.8c-.6-1.3-1.4-2.2-2.6-2.2Z"
        fill="white"
      />
    </svg>
  );
}

export function Globe({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9S14.5 18.4 12 21c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function AvatarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </svg>
  );
}

export function ShieldIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.3 7.5 9.5 4.4-1.2 7.5-4.9 7.5-9.5V6L12 3Z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

export function CalendarIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function WalletIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H18a2 2 0 0 1 2 2v1" />
      <rect x="3" y="7" width="18" height="13" rx="2.5" />
      <path d="M16 13h5" />
    </svg>
  );
}

export function AlertIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M12 4 2.7 20h18.6L12 4Z" />
      <path d="M12 10v4M12 17.2v.1" />
    </svg>
  );
}

export function CheckIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="m5 12 4.5 4.5L19 7" />
    </svg>
  );
}

export function ArrowIcon({ className }: IconProps) {
  return (
    <svg {...base(className)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export function StarIcon({ className }: IconProps) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.3l-5.9 3.2 1.2-6.5-4.8-4.6 6.6-.9L12 2.5Z" />
    </svg>
  );
}
