import { describe, expect, it } from 'vitest'
import { renderEmail } from './email-layout'

describe('renderEmail', () => {
  it('escapes every piece of text and keeps a text version', () => {
    const { html, text } = renderEmail({ heading: 'Week <1>', paragraphs: ['a & b'], cta: { label: 'Open', url: 'https://x.dev/?a=1&b="2"' }, footer: 'voet' })
    expect(html).toContain('Week &lt;1&gt;')
    expect(html).toContain('a &amp; b')
    expect(html).toContain('href="https://x.dev/?a=1&amp;b=&quot;2&quot;"')
    expect(html).toContain('>Cockpit<')
    expect(text).toBe('Week <1>\n\na & b\n\nOpen: https://x.dev/?a=1&b="2"\n\n--\nvoet')
  })
})
