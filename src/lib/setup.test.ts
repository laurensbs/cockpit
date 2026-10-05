import { describe, expect, it } from 'vitest'
import { nextSetupStep, setupProgress, setupProjectFrom, setupView, type SetupRow } from './setup'

const app = { web: true, app: true, paid: true, local: false }
const local = { web: true, app: false, paid: true, local: true }

describe('setupProjectFrom', () => {
  it('reads from the intake what kind of business it is', () => {
    expect(setupProjectFrom({ oneLiner: 'Een iPhone-puzzelgame, eenmalige aankoop', what: '', siteUrl: null, localPath: '/x' })).toMatchObject({ web: false, app: true, paid: true, local: false })
    expect(setupProjectFrom({ oneLiner: 'Aanvraagformulieren voor servicebedrijven aan de Costa Brava, €69 per maand', what: '', siteUrl: 'https://x.example', localPath: null })).toMatchObject({ web: true, local: true, paid: true, app: false })
  })
})

describe('setupView', () => {
  const rows: SetupRow[] = [
    { key: 'gbp', source: 'claude', status: 'todo', note: 'Staat niet in STAND.md' },
    { key: 'domain', source: 'auto', status: 'done', note: 'voorbeeld.example' },
    { key: 'domain', source: 'claude', status: 'todo', note: 'oud' },
    { key: 'trustpilot', source: 'jij', status: 'na', note: '' },
    { key: 'mail', source: 'auto', status: 'todo', note: 'Geen MX' },
    { key: 'mail', source: 'jij', status: 'done', note: 'Hostinger' },
  ]

  it('shows only what applies, and his own word beats the check, which beats what Claude read', () => {
    const view = setupView(local, rows)
    expect(view.find((v) => v.item.key === 'domain')).toMatchObject({ status: 'done', source: 'auto' })
    expect(view.find((v) => v.item.key === 'mail')).toMatchObject({ status: 'done', source: 'jij' })
    expect(view.some((v) => v.item.key === 'app-store')).toBe(false)
    expect(view.some((v) => v.item.key === 'gbp')).toBe(true)
  })

  it('leaves out what he marked as not needed, and counts the rest', () => {
    const view = setupView(app, rows)
    expect(view.some((v) => v.item.key === 'trustpilot')).toBe(false)
    expect(setupProgress(view).done).toBe(2)
  })

  it('picks a free step he can take now before a paid one, the basis first, and never one that waits for another', () => {
    expect(nextSetupStep(setupView(app, []))?.item.key).toBe('privacy')
    const domainDone = setupView(app, [
      { key: 'domain', source: 'auto', status: 'done', note: '' },
      { key: 'mail', source: 'auto', status: 'done', note: '' },
      { key: 'privacy', source: 'auto', status: 'done', note: '' },
    ])
    expect(nextSetupStep(domainDone)?.item.key).toBe('mail-auth')
    const appTodo = setupView(app, [{ key: 'app-store', source: 'auto', status: 'todo', note: '' }, { key: 'apple-dev', source: 'claude', status: 'todo', note: '' }])
    expect(nextSetupStep(appTodo)?.item.key).not.toBe('app-store')
  })
})
