// Draws the Cockpit icon in every size the app needs, from one design:
//   resources/icon.svg, icon.png (1024) and icon.icns   the Mac app, with the margin and shadow macOS expects
//   public/icon.svg, icon-192.png, icon-512.png          the web icons, full bleed
//   public/icon-maskable-512.png, apple-touch-icon.png   with the safe zone, no transparency
// The mark: a chunky gauge whose lime arc and needle point up and to the right, with a spark.
// Needs a Mac (sips, iconutil) and Playwright's Chromium (npx playwright install chromium).
//
//   node scripts/make-icons.mjs
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from '@playwright/test'

const VIOLET_TOP = '#7f6dff'
const VIOLET_BOTTOM = '#5340f2'
const VIOLET_LIP = '#3a28c9'
const LIME = '#b5f23d'
const WHITE = '#ffffff'

const point = (cx, cy, r, deg) => {
  const a = (deg * Math.PI) / 180
  return [+(cx + r * Math.cos(a)).toFixed(1), +(cy + r * Math.sin(a)).toFixed(1)]
}

/** The mark on a 1024 canvas, centred on (512, cy): gauge, progress, needle, hub and spark. */
function mark(scale = 1) {
  const s = (v) => +(v * scale).toFixed(1)
  const cx = 512
  const cy = 512 + s(68)
  const r = s(250)
  const [sx, sy] = point(cx, cy, r, 150)
  const [ex, ey] = point(cx, cy, r, 30)
  const [px, py] = point(cx, cy, r, 320)
  const [nx, ny] = point(cx, cy, s(175), 320)
  const star = (x, y, size) =>
    `M${x} ${y - size}C${x + size * 0.18} ${y - size * 0.18} ${x + size * 0.18} ${y - size * 0.18} ${x + size} ${y}C${x + size * 0.18} ${y + size * 0.18} ${x + size * 0.18} ${y + size * 0.18} ${x} ${y + size}C${x - size * 0.18} ${y + size * 0.18} ${x - size * 0.18} ${y + size * 0.18} ${x - size} ${y}C${x - size * 0.18} ${y - size * 0.18} ${x - size * 0.18} ${y - size * 0.18} ${x} ${y - size}Z`
  return [
    `<path d="M${sx} ${sy}A${r} ${r} 0 1 1 ${ex} ${ey}" fill="none" stroke="${WHITE}" stroke-opacity="0.24" stroke-width="${s(84)}" stroke-linecap="round"/>`,
    `<path d="M${sx} ${sy}A${r} ${r} 0 0 1 ${px} ${py}" fill="none" stroke="${LIME}" stroke-width="${s(84)}" stroke-linecap="round"/>`,
    `<line x1="${cx}" y1="${cy}" x2="${nx}" y2="${ny}" stroke="${WHITE}" stroke-width="${s(60)}" stroke-linecap="round"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${s(66)}" fill="${WHITE}"/>`,
    `<circle cx="${cx}" cy="${cy}" r="${s(24)}" fill="${VIOLET_BOTTOM}"/>`,
    `<path d="${star(512 + s(262), 512 - s(262), s(62))}" fill="${LIME}"/>`,
    `<circle cx="${512 + s(330)}" cy="${512 - s(150)}" r="${s(16)}" fill="${WHITE}" fill-opacity="0.85"/>`,
  ].join('')
}

const defs = `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${VIOLET_TOP}"/><stop offset="1" stop-color="${VIOLET_BOTTOM}"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#000" flood-opacity="0.32"/></filter></defs>`

/** macOS: the body is 824 of 1024 with rounded corners, a chunky lip at the bottom and a soft shadow. */
const macSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}<g filter="url(#shadow)"><rect x="100" y="112" width="824" height="812" rx="185" fill="${VIOLET_LIP}"/></g><rect x="100" y="100" width="824" height="796" rx="185" fill="url(#bg)"/><g transform="translate(512 488) scale(0.9) translate(-512 -512)">${mark()}</g></svg>`

/** Web: full bleed, the same lip, for the favicon and the sidebar. */
const webSvg = (lip = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${defs}${lip ? `<rect width="1024" height="1024" rx="230" fill="${VIOLET_LIP}"/><rect width="1024" height="984" rx="230" fill="url(#bg)"/>` : `<rect width="1024" height="1024" fill="url(#bg)"/>`}<g transform="translate(512 500) scale(${lip ? 0.92 : 0.72}) translate(-512 -512)">${mark()}</g></svg>`

async function render(page, svg, size, out, { transparent = true } = {}) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body></html>`)
  await page.screenshot({ path: out, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } })
}

const browser = await chromium.launch()
const page = await browser.newPage({ deviceScaleFactor: 1 })
writeFileSync('resources/icon.svg', macSvg)
writeFileSync('public/icon.svg', webSvg())
await render(page, macSvg, 1024, 'resources/icon.png')
await render(page, webSvg(), 192, 'public/icon-192.png')
await render(page, webSvg(), 512, 'public/icon-512.png')
await render(page, webSvg(false), 512, 'public/icon-maskable-512.png', { transparent: false })
await render(page, webSvg(false), 180, 'public/apple-touch-icon.png', { transparent: false })

// icon.icns from an iconset of every size macOS asks for.
const work = mkdtempSync(join(tmpdir(), 'cockpit-icon-'))
const set = join(work, 'icon.iconset')
mkdirSync(set)
for (const size of [16, 32, 128, 256, 512]) {
  await render(page, macSvg, size, join(set, `icon_${size}x${size}.png`))
  await render(page, macSvg, size * 2, join(set, `icon_${size}x${size}@2x.png`))
}
await browser.close()
execFileSync('iconutil', ['-c', 'icns', set, '-o', 'resources/icon.icns'])
rmSync(work, { recursive: true, force: true })
console.log('Icons written: resources/icon.{svg,png,icns}, public/icon.svg, icon-192/512, maskable, apple-touch-icon')
