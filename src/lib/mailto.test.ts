import { describe, expect, it } from 'vitest'
import { emailText, MAILTO_MAX, mailtoHref } from './mailto'

describe('mailto', () => {
  it('encodes subject and body, with line breaks', () => {
    const { href, bodyIncluded } = mailtoHref({ to: 'info@opvang.nl', subject: 'Hoi & dag', body: 'Regel 1\nRegel 2' })
    expect(href).toBe('mailto:info@opvang.nl?subject=Hoi%20%26%20dag&body=Regel%201%0ARegel%202')
    expect(bodyIncluded).toBe(true)
  })

  it('leaves the address out when it is not one', () => {
    expect(mailtoHref({ to: 'x?bcc=evil@x.nl', subject: 's', body: 'b' }).href).toBe('mailto:?subject=s&body=b')
  })

  it('drops the body from a link that would be too long', () => {
    const { href, bodyIncluded } = mailtoHref({ subject: 'Lang', body: 'a'.repeat(MAILTO_MAX) })
    expect(href).toBe('mailto:?subject=Lang')
    expect(bodyIncluded).toBe(false)
  })

  it('puts the P.S. under the body', () => {
    expect(emailText({ body: 'Hoi', ps: 'Tot snel' })).toBe('Hoi\n\nP.S. Tot snel')
    expect(emailText({ body: 'Hoi', ps: '' })).toBe('Hoi')
  })
})
