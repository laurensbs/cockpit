import type { MetadataRoute } from 'next'
import { APP_NAME } from '@/lib/site'

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Al je projecten en bedrijven op één plek: marketing, quests en XP.',
    lang: 'nl',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#0a0c1b',
    theme_color: '#0a0c1b',
    categories: ['business', 'productivity'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Quests', url: '/quests' },
      { name: 'Studio', url: '/studio' },
      { name: 'Projecten', url: '/projects' },
    ],
  }
}
