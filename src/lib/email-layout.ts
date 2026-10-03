const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export interface EmailParts {
  heading: string
  paragraphs: string[]
  cta?: { label: string; url: string }
  footer: string
}

/** A plain, readable email (HTML with inline styles, plus a text version). Every piece of text is escaped. */
export function renderEmail({ heading, paragraphs, cta, footer }: EmailParts): { html: string; text: string } {
  const p = (s: string) => `<p style="margin:0 0 12px;font-size:16px;line-height:1.5">${escapeHtml(s)}</p>`
  const button = cta
    ? `<p style="margin:20px 0 4px"><a href="${escapeHtml(cta.url)}" style="display:inline-block;background:#5a48f5;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:999px">${escapeHtml(cta.label)}</a></p>`
    : ''
  const html = [
    '<!doctype html><html><body style="margin:0;background:#f3f4fa;color:#121530;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px"><tr><td style="padding:28px">',
    '<p style="margin:0 0 16px;font-weight:800;font-size:18px;color:#5a48f5">Cockpit</p>',
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:1.25">${escapeHtml(heading)}</h1>`,
    ...paragraphs.map(p),
    button,
    '</td></tr></table>',
    `<p style="max-width:520px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#5d6385">${escapeHtml(footer)}</p>`,
    '</td></tr></table></body></html>',
  ].join('')
  const text = [heading, '', ...paragraphs, ...(cta ? ['', `${cta.label}: ${cta.url}`] : []), '', '--', footer].join('\n')
  return { html, text }
}
