/** The cockpit mark: a chunky gauge whose lime arc and needle point up and to the right, with a spark. Same design as the app icon (scripts/make-icons.mjs). */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="cockpit-logo-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7f6dff" />
          <stop offset="1" stopColor="#5340f2" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="230" fill="#3a28c9" />
      <rect width="1024" height="984" rx="230" fill="url(#cockpit-logo-bg)" />
      <g transform="translate(512 500) scale(0.92) translate(-512 -512)">
        <path d="M295.5 705A250 250 0 1 1 728.5 705" fill="none" stroke="#fff" strokeOpacity="0.24" strokeWidth="84" strokeLinecap="round" />
        <path d="M295.5 705A250 250 0 0 1 703.5 419.3" fill="none" stroke="#b5f23d" strokeWidth="84" strokeLinecap="round" />
        <line x1="512" y1="580" x2="646.1" y2="467.5" stroke="#fff" strokeWidth="60" strokeLinecap="round" />
        <circle cx="512" cy="580" r="66" fill="#fff" />
        <circle cx="512" cy="580" r="24" fill="#5340f2" />
        <path d="M774 188C785.16 238.84 785.16 238.84 836 250C785.16 261.16 785.16 261.16 774 312C762.84 261.16 762.84 261.16 712 250C762.84 238.84 762.84 238.84 774 188Z" fill="#b5f23d" />
      </g>
    </svg>
  )
}
