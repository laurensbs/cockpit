import { PDFDocument } from 'pdf-lib'
import { describe, expect, it, vi } from 'vitest'
import { normalizeBrand } from '@/lib/brand'

vi.mock('server-only', () => ({}))

describe('slides and documents', () => {
  it('draws a carousel in the house style and binds it as a PDF, a page per slide', async () => {
    const { renderPng } = await import('./engine')
    const { slideSet, reelCover, POST_SIZE, TALL_SIZE, mix } = await import('./templates')
    const { pdfFromPngs } = await import('./pdf')
    const brand = normalizeBrand({ accent: '#ff5a36', style: 'bold', font: 'sans', handle: 'rondje' })
    const set = slideSet(brand, [{ title: 'Zo krijg je meer wandelaars', body: '' }, { title: 'Twee', body: 'Uitleg' }, { title: 'Drie', body: '' }], POST_SIZE)
    expect(set).toHaveLength(3)
    const pngs = await Promise.all(set.map((el) => renderPng(el, POST_SIZE.width, POST_SIZE.height)))
    for (const png of pngs) expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1080, 1350])
    const pdf = await PDFDocument.load(await pdfFromPngs(pngs, 'Test'))
    expect(pdf.getPageCount()).toBe(3)
    expect(pdf.getPage(0).getSize()).toEqual({ width: 1080, height: 1350 })
    const cover = await renderPng(reelCover(brand, 'POV: je hond wil wandelen'), TALL_SIZE.width, TALL_SIZE.height)
    expect(cover.readUInt32BE(20)).toBe(1920)
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})

describe('JPEG for Instagram', () => {
  it('turns a drawn slide into a JPEG of the same size', async () => {
    const { renderRaster, jpegFrom } = await import('./engine')
    const { coverSlide, POST_SIZE } = await import('./templates')
    const raster = await renderRaster(coverSlide(normalizeBrand({}), { title: 'Hallo', body: '' }, 1), POST_SIZE.width, POST_SIZE.height)
    const jpeg = jpegFrom(raster)
    expect([jpeg[0], jpeg[1]]).toEqual([0xff, 0xd8])
    const { decode } = await import('jpeg-js')
    expect(decode(jpeg)).toMatchObject({ width: 1080, height: 1350 })
  })
})
