import { describe, expect, it } from 'vitest'
import { discordInvites, ga4PropertyFor, gscSiteFor, pickDomain, scanHtml, vercelRepoOf } from './discover'

const html = `<!doctype html><html><head>
<link rel="canonical" href="https://teampje.example/">
<script defer data-domain="teampje.example" src="https://plausible.io/js/script.outbound-links.js"></script>
<script async src="https://www.googletagmanager.com/gtag/js?id=G-TEAM1234"></script>
<script>gtag('config', 'G-TEAM1234');</script>
<script defer src="/_vercel/insights/script.js"></script>
</head><body><a href="https://discord.gg/teampje">Discord</a> <a href="https://discord.com/invite/teampje">ook</a>
<script src="https://js.stripe.com/v3/"></script></body></html>`

describe('finding what a site runs', () => {
  it('reads Plausible, GA4, Vercel Analytics, Stripe, Discord and the canonical address', () => {
    expect(scanHtml(html)).toEqual({
      plausible: 'teampje.example',
      ga4: ['G-TEAM1234'],
      vercelAnalytics: true,
      stripe: true,
      discord: ['teampje'],
      canonical: 'https://teampje.example/',
    })
    expect(scanHtml('<p>niets</p>')).toEqual({ plausible: null, ga4: [], vercelAnalytics: false, stripe: false, discord: [], canonical: null })
  })
  it('finds Discord invites in a README too', () => {
    expect(discordInvites('Join us: discord.gg/abc-123 or https://discordapp.com/invite/xyz')).toEqual(['abc-123', 'xyz'])
  })
  it('picks his own production domain', () => {
    expect(
      pickDomain([
        { name: 'teampje.vercel.app', verified: true },
        { name: 'www.teampje.example', verified: true, redirect: 'teampje.example' },
        { name: 'teampje.example', verified: true },
        { name: 'nieuw.teampje.example', verified: false },
      ]),
    ).toBe('teampje.example')
    expect(pickDomain([{ name: 'teampje.vercel.app', verified: true }])).toBe('teampje.vercel.app')
    expect(pickDomain([])).toBeNull()
  })
  it('matches Search Console and GA4 to the site', () => {
    expect(gscSiteFor('www.teampje.example', [{ siteUrl: 'https://andere.example/' }, { siteUrl: 'sc-domain:teampje.example', permissionLevel: 'siteFullUser' }])).toBe('sc-domain:teampje.example')
    expect(gscSiteFor('teampje.example', [{ siteUrl: 'https://www.teampje.example/', permissionLevel: 'siteOwner' }])).toBe('https://www.teampje.example/')
    expect(gscSiteFor('teampje.example', [{ siteUrl: 'sc-domain:teampje.example', permissionLevel: 'siteUnverifiedUser' }])).toBeNull()
    const streams = [
      { property: '111', measurementId: 'G-OTHER0001', defaultUri: 'https://teampje.example' },
      { property: '222', measurementId: 'G-TEAM1234', defaultUri: 'https://elders.example' },
    ]
    expect(ga4PropertyFor(['G-TEAM1234'], 'teampje.example', streams)).toBe('222')
    expect(ga4PropertyFor([], 'www.teampje.example', streams)).toBe('111')
    expect(ga4PropertyFor([], null, streams)).toBeNull()
  })
  it('knows which repository a Vercel project deploys', () => {
    expect(vercelRepoOf({ type: 'github', org: 'LaurensBS', repo: 'Teampje' })).toBe('laurensbs/teampje')
    expect(vercelRepoOf({ type: 'gitlab', org: 'x', repo: 'y' })).toBeNull()
    expect(vercelRepoOf(null)).toBeNull()
  })
})
