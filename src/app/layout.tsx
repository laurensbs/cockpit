import './globals.css'
import type { Metadata, Viewport } from 'next'
import { APP_NAME, siteUrl } from '@/lib/site'
import { fontVariables } from './fonts'

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: 'Al je projecten en bedrijven op één plek: marketing, quests en XP.',
  applicationName: APP_NAME,
  manifest: '/manifest.webmanifest',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: 'black-translucent' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f3f4fa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c1b' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" className={fontVariables}>
      <body>{children}</body>
    </html>
  )
}
