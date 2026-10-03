import type { MetadataRoute } from 'next'

/** A private cockpit: nothing here belongs in a search engine. */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', disallow: '/' }] }
}
