import 'server-only'
import { PDFDocument } from 'pdf-lib'

/** Slides as one PDF, a page per slide at the slide's own size: LinkedIn shows it as a carousel. */
export async function pdfFromPngs(pngs: Buffer[], title: string): Promise<Buffer> {
  const doc = await PDFDocument.create()
  doc.setTitle(title)
  doc.setCreator('Cockpit')
  doc.setProducer('Cockpit')
  for (const png of pngs) {
    const image = await doc.embedPng(png)
    const page = doc.addPage([image.width, image.height])
    page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height })
  }
  return Buffer.from(await doc.save())
}
