import { describe, expect, it } from 'vitest'
import { contactLinks, extractEmails, extractPhones, normalizePhone, pickBusinessEmail, prospectKey } from './prospect'

describe('extractEmails', () => {
  it('finds mailto links, plain text and the [at] spelling, and skips image names and placeholders', () => {
    const html = `<a href="mailto:Info@Garage.example?subject=Hoi">mail</a> Of: taller [at] garage.example
      <img src="logo@2x.png"> <p>jan@example.com</p> &#64;`
    expect(extractEmails(html)).toEqual(['info@garage.example', 'taller@garage.example'])
  })
})

describe('contactLinks', () => {
  it('follows contact-like links on the same site only, at most three', () => {
    const html = `<a href="/contacto">Contacto</a><a href="https://other.example/contact">x</a>
      <a href="/aviso-legal">Aviso legal</a><a href="/over-ons#team">Over ons</a><a href="/blog">Blog</a><a href="/contact">Contact</a>`
    expect(contactLinks(html, 'https://www.garage.example/')).toEqual([
      'https://www.garage.example/contacto',
      'https://www.garage.example/aviso-legal',
      'https://www.garage.example/over-ons',
    ])
  })
})

describe('pickBusinessEmail', () => {
  const site = 'https://www.garage.example'
  it('prefers a role address on their own domain', () => {
    const found = [
      { email: 'pedro@garage.example', source: 'a' },
      { email: 'hola@webagency.example', source: 'b' },
      { email: 'info@garage.example', source: 'c' },
    ]
    expect(pickBusinessEmail(found, site)).toEqual({ email: 'info@garage.example', source: 'c' })
  })

  it('takes any address on their domain, then a business-looking free mail address, never their web agency', () => {
    expect(pickBusinessEmail([{ email: 'pedro@garage.example', source: 'a' }], site)?.email).toBe('pedro@garage.example')
    expect(pickBusinessEmail([{ email: 'garagevoorbeeld.taller@gmail.com', source: 'a' }], site)?.email).toBe('garagevoorbeeld.taller@gmail.com')
    expect(pickBusinessEmail([{ email: 'hola@webagency.example', source: 'a' }], site)).toBeNull()
  })
})

describe('prospectKey', () => {
  it('knows a business by its name and by its website', () => {
    expect(prospectKey('Stalling  Zuid!', 'https://www.stalling-zuid.example/nl/')).toEqual(['org:stalling zuid', 'host:stalling-zuid.example'])
  })
})

describe('extractPhones', () => {
  it('reads tel links and numbers after a phone word, in Spanish and Dutch notation', () => {
    const html = `<a href="tel:+34600111222">Bel ons</a> <p>Tel. 972 00 11 22</p> <p>Telefoon: 071-1234567</p>
      <p>Prijs 1.250,00 · postcode 17255 · 2026-10-04</p> <span>Teléfono: +34 972 000 333</span>`
    expect(extractPhones(html)).toEqual(['+34600111222', '972001122', '0711234567', '+34972000333'])
  })

  it('only keeps something that is a phone number', () => {
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('0034 972 00 11 22')).toBe('+34972001122')
  })
})
