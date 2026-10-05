import { describe, expect, it } from 'vitest'
import { contactKey, parseContactList } from './contact-import'

describe('parseContactList', () => {
  it('reads semicolon lines in the order of the form, with a header and comments skipped', () => {
    const text = [
      'Organisatie;Naam;E-mail;Website;Basis;Notitie',
      '# Webstability, week 1',
      'Huis Voorbeeld;;contact@huis.example;www.huis.example;zakelijk;Palamós; NL-talig',
      'Bureau Voorbeeld;Sam;;bureau.example;relatie;Partnerpilot',
      '',
    ].join('\n')
    const { rows, problems } = parseContactList(text)
    expect(problems).toEqual([])
    expect(rows).toEqual([
      { line: 3, organization: 'Huis Voorbeeld', name: '', email: 'contact@huis.example', website: 'https://www.huis.example', basis: 'business', note: 'Palamós; NL-talig' },
      { line: 4, organization: 'Bureau Voorbeeld', name: 'Sam', email: null, website: 'https://bureau.example', basis: 'relation', note: 'Partnerpilot' },
    ])
  })

  it('reads a paste from a spreadsheet (tabs), and an empty basis is a business address', () => {
    const { rows } = parseContactList('Camper Voorbeeld\t\thola@camper.example\t\t\tCamperinbouw, half passend')
    expect(rows[0]).toMatchObject({ organization: 'Camper Voorbeeld', email: 'hola@camper.example', website: null, basis: 'business', note: 'Camperinbouw, half passend' })
  })

  it('names the line and the reason for anything it cannot take, and keeps the rest', () => {
    const { rows, problems } = parseContactList(['Goed;;info@goed.example', ';;info@leeg.example', 'Fout;;geen-adres', 'Raar;;;;soms'].join('\n'))
    expect(rows.map((r) => r.organization)).toEqual(['Goed'])
    expect(problems).toEqual([
      { line: 2, reason: 'geen organisatie' },
      { line: 3, reason: 'e-mailadres klopt niet' },
      { line: 4, reason: 'onbekende basis "soms" (zakelijk, relatie of toestemming)' },
    ])
  })
})

describe('contactKey', () => {
  it('ignores case and extra spaces', () => {
    expect(contactKey('  Stalling  Zuid ')).toBe(contactKey('stalling zuid'))
  })
})
