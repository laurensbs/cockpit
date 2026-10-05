import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

describe('render engine', () => {
  it('draws text with the bundled fonts into a PNG of the asked size', async () => {
    const { h, renderPng } = await import('./engine')
    const png = await renderPng(h({ width: '100%', height: '100%', background: '#faf8f4', color: '#17161c', fontFamily: 'Space Grotesk', fontSize: 80, padding: 80 }, 'Zo krijg je meer klanten uit je website'), 1080, 1350)
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1080)
    expect(png.readUInt32BE(20)).toBe(1350)
  })
})
