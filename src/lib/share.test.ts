import { describe, expect, it } from 'vitest'
import { linkedinShareUrl, shareUrl } from './share'

describe('share links', () => {
  it('opens LinkedIn and X with the text filled in', () => {
    expect(linkedinShareUrl('Hoi & welkom #rondje')).toBe('https://www.linkedin.com/feed/?shareActive=true&text=Hoi%20%26%20welkom%20%23rondje')
    expect(shareUrl('x', 'Hallo')).toBe('https://x.com/intent/post?text=Hallo')
    expect(shareUrl('instagram', 'Hallo')).toBeNull()
  })

  it('keeps the link at a size every browser takes', () => {
    const url = linkedinShareUrl('a'.repeat(5000))
    expect(decodeURIComponent(url.split('text=')[1])).toHaveLength(1300)
  })
})
