import localFont from 'next/font/local'

// Served by Next.js itself: preloaded with the page, with a size-matched fallback so text does not
// jump when the font arrives. Nunito: round and friendly, heavy for headings; the Latin set covers
// Dutch, English, Spanish, French and German.

export const roundFont = localFont({
  src: '../../node_modules/@fontsource-variable/nunito/files/nunito-latin-wght-normal.woff2',
  weight: '200 1000',
  variable: '--font-nunito',
})

export const monoFont = localFont({
  src: '../../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2',
  weight: '400 800',
  variable: '--font-jetbrains-mono',
  preload: false,
})

export const fontVariables = `${roundFont.variable} ${monoFont.variable}`
