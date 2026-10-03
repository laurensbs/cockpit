/** The cockpit mark: a dial with a lime XP arc and a star. */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true" focusable="false">
      <rect width="512" height="512" rx="112" fill="#0a0c1b" />
      <circle cx="256" cy="256" r="150" fill="none" stroke="#262b4a" strokeWidth="36" />
      <path d="M256 106a150 150 0 0 1 141 99" fill="none" stroke="#b5f23d" strokeWidth="36" strokeLinecap="round" />
      <path d="M256 168l22 66 70 2-56 42 20 67-56-40-56 40 20-67-56-42 70-2z" fill="#8f80ff" />
    </svg>
  )
}
