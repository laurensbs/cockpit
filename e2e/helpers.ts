import { expect, type Browser, type BrowserContextOptions, type Page } from '@playwright/test'

/** With SHOTS=1, saves a full-page screenshot per step for design review (shots/<name>.png). */
export async function shot(page: Page, name: string) {
  if (!process.env.SHOTS) return
  await page.waitForTimeout(400)
  await page.screenshot({ path: `shots/${process.env.SHOTS_PREFIX ?? ''}${name}.png`, fullPage: true })
}

/** Each visitor gets their own (test) IP: sign-in and sign-up are rate limited per IP address. */
const randomIp = () => `10.${1 + Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${1 + Math.floor(Math.random() * 250)}`

export async function newVisitor(browser: Browser, options: BrowserContextOptions = {}) {
  const context = await browser.newContext({
    colorScheme: process.env.SHOTS_DARK ? 'dark' : 'light',
    extraHTTPHeaders: { 'x-forwarded-for': randomIp() },
    ...options,
  })
  const page = await context.newPage()
  return { context, page }
}

export const OWNER = { name: 'Laurens', email: 'owner@e2e.test', password: 'cockpit-e2e-123', code: 'e2e-setup-code' }

/** Claims the cockpit the first time, or signs in when the owner already exists. */
export async function signInOwner(page: Page) {
  await page.goto('/login')
  const claim = page.getByRole('button', { name: 'Eerste keer' })
  if ((await claim.getAttribute('aria-pressed')) === 'true') {
    await page.getByLabel('Voornaam').fill(OWNER.name)
    await page.getByLabel('E-mailadres').fill(OWNER.email)
    await page.getByLabel('Wachtwoord').fill(OWNER.password)
    await page.getByLabel('Setup-code').fill(OWNER.code)
    await page.getByRole('button', { name: 'Cockpit claimen' }).click()
    await page.getByRole('button', { name: 'Later' }).click()
  } else {
    await page.getByLabel('E-mailadres').fill(OWNER.email)
    await page.getByLabel('Wachtwoord').fill(OWNER.password)
    await page.locator('form').getByRole('button', { name: 'Inloggen' }).click()
  }
  await page.waitForURL((url) => url.pathname === '/')
  await expect(page.getByRole('heading', { level: 1 })).toContainText(OWNER.name)
}
