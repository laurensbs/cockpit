import { expect, test } from '@playwright/test'
import { newVisitor } from './helpers'

// The day route, the lesson, socials and Instagram. Runs after 13-prospects: "Bel Garage Test" is on
// his quests for today.

test('he links a social profile with one paste; a link of another site is refused', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  const socials = page.getByLabel('Socials')
  await socials.getByRole('button', { name: '+ Instagram' }).click()
  await socials.getByLabel('Link naar je Instagram').fill('https://evil.example/instagram.com/x')
  await socials.getByRole('button', { name: 'Koppel' }).click()
  await expect(socials.getByRole('alert')).toContainText('Dat is geen Instagram-link.')
  await socials.getByLabel('Link naar je Instagram').fill('instagram.com/webstability')
  await socials.getByRole('button', { name: 'Koppel' }).click()
  await expect(socials.getByRole('link', { name: '✓ Instagram' })).toHaveAttribute('href', 'https://instagram.com/webstability')
  await context.close()
})

test('Vandaag is calm; the lesson takes him through the day one card at a time', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/')
  const day = page.getByRole('region', { name: 'Vandaag' })
  await expect(day.getByText('Bel Garage Test')).toBeVisible()
  // The rest of Vandaag waits behind one button.
  await expect(page.locator('details.more')).not.toHaveAttribute('open', '')
  await day.getByRole('link', { name: /Start je dag|Nog een rondje/ }).click()
  await expect(page).toHaveURL(/\/dag$/)
  await expect(page.getByRole('progressbar', { name: 'Voortgang van je dag' })).toBeVisible()

  // The call first: the number, "Gebeld", and then the one question that matters.
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bel Garage Test')
  await expect(page.getByRole('link', { name: '📞 +34972000000' })).toHaveAttribute('href', 'tel:+34972000000')
  await page.getByRole('button', { name: 'Gebeld ✓' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wilden ze informatie?')
  await page.getByRole('button', { name: 'Weet ik nog niet' }).click()
  await expect(page.locator('.lesson-foot')).toContainText('Prima')
  await page.getByRole('button', { name: 'Verder' }).click()

  // The other cards: answer the follower question, put the rest off, until the end.
  for (let i = 0; i < 12; i++) {
    if (await page.getByRole('heading', { name: /Dagdoel gehaald!|Lekker bezig!|Niets te doen nu/ }).count()) break
    const title = (await page.getByRole('heading', { level: 1 }).textContent()) ?? ''
    if (title.includes('volgers')) {
      await page.getByLabel('Aantal volgers').fill('812')
      await page.getByRole('button', { name: 'Bewaar' }).click()
      await expect(page.locator('.lesson-foot.good')).toContainText('Bewaard.')
    } else {
      await page.locator('.lesson-actions').getByRole('button', { name: /^(Later|Nog niet|Niet bereikt)$/ }).first().click()
    }
    await page.getByRole('button', { name: 'Verder' }).click()
  }
  await expect(page.getByRole('heading', { name: /Dagdoel gehaald!|Lekker bezig!/ })).toBeVisible()
  await page.getByRole('button', { name: 'Klaar' }).click()
  await expect(page).toHaveURL(/\/$/)
  await context.close()
})

test('Instagram numbers come in by themselves, with a read-only token that never shows in the page', async ({ browser }) => {
  const { context, page } = await newVisitor(browser)
  await page.goto('/projects')
  await page.getByRole('link', { name: /Webstability/ }).first().click()
  await page.getByRole('navigation', { name: 'Onderdelen' }).getByRole('link', { name: 'Cijfers' }).click()
  await page.getByText('Bron koppelen').click()
  const form = page.locator('form').filter({ has: page.getByLabel('Bron') })
  await form.getByLabel('Bron').selectOption('instagram')
  const ig = page.locator('form').filter({ has: page.getByLabel('Instagram-account-ID') })
  await ig.getByLabel('Instagram-account-ID').fill('17841400000000000')
  await ig.getByLabel('Toegangstoken (alleen lezen)').fill('IGQWRe2etesttoken0123456789abcdefghij')
  await ig.getByRole('button', { name: 'Koppelen' }).click()
  await expect(page.getByRole('status').filter({ hasText: 'Instagram gekoppeld' })).toBeVisible()
  await page.getByRole('button', { name: 'Nu ophalen' }).click()
  await expect(page.getByRole('status').filter({ hasText: /opgehaald/ })).toBeVisible()
  await page.reload()
  const weeks = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Per week' }) })
  await expect(weeks.getByRole('rowheader', { name: 'Volgers' })).toBeVisible()
  await expect(weeks.getByRole('rowheader', { name: 'Bereik op socials' })).toBeVisible()
  expect(await page.content()).not.toContain('IGQWRe2etesttoken')
  await context.close()
})
