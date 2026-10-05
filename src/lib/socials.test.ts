import { describe, expect, it } from 'vitest'
import { preferredPlatform, socialsOf, socialUrl, withSocial } from './socials'

describe('socialUrl', () => {
  it('takes a profile of the right platform, with or without https and www', () => {
    expect(socialUrl('instagram', 'instagram.com/webstability')).toBe('https://instagram.com/webstability')
    expect(socialUrl('linkedin', 'https://www.linkedin.com/company/webstability/')).toBe('https://www.linkedin.com/company/webstability')
    expect(socialUrl('x', 'https://twitter.com/laurens')).toBe('https://twitter.com/laurens')
  })

  it('refuses a page of another site or an unknown platform', () => {
    expect(socialUrl('instagram', 'https://evil.example/instagram.com')).toBeNull()
    expect(socialUrl('instagram', 'https://notinstagram.com/x')).toBeNull()
    expect(socialUrl('myspace', 'https://myspace.com/x')).toBeNull()
  })
})

describe('socialsOf and withSocial', () => {
  it('keeps other links and replaces or removes one platform', () => {
    const links = [{ label: 'Docs', url: 'https://docs.example' }, { label: 'instagram', url: 'https://instagram.com/a' }]
    expect(socialsOf(links)).toEqual({ instagram: 'https://instagram.com/a' })
    expect(withSocial(links, 'instagram', 'https://instagram.com/b')).toEqual([{ label: 'Docs', url: 'https://docs.example' }, { label: 'instagram', url: 'https://instagram.com/b' }])
    expect(withSocial(links, 'instagram', null)).toEqual([{ label: 'Docs', url: 'https://docs.example' }])
  })

  it('posts go to LinkedIn unless only another platform is linked', () => {
    expect(preferredPlatform({})).toBe('linkedin')
    expect(preferredPlatform({ instagram: 'https://instagram.com/a' })).toBe('instagram')
    expect(preferredPlatform({ instagram: 'https://instagram.com/a', linkedin: 'https://linkedin.com/in/a' })).toBe('linkedin')
  })
})
