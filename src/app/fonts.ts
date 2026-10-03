import localFont from 'next/font/local'

// Served by Next.js itself: preloaded with the page, with a size-matched fallback so text does not
// jump when the font arrives. The Latin sets cover Dutch, English, Spanish, French and German.

export const displayFont = localFont({
  src: '../../node_modules/@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2',
  weight: '300 700',
  variable: '--font-space-grotesk',
})

export const bodyFont = localFont({
  src: '../../node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2',
  weight: '400 700',
  variable: '--font-instrument-sans',
})

export const monoFont = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '400 800',
  variable: '--font-jetbrains-mono',
  preload: false,
})

export const fontVariables = `${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`
