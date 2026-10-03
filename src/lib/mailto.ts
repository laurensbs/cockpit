/** Mail apps cut long mailto links; past this the body goes via copy and paste instead. */
export const MAILTO_MAX = 1800

/** A plain business address: letters, digits and . _ % + - before the @; no ?, &, = or spaces. */
export const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/

/** A mailto link with subject and body, or with the subject only when the whole thing is too long. */
export function mailtoHref(input: { to?: string | null; subject: string; body: string }): { href: string; bodyIncluded: boolean } {
  const to = input.to && EMAIL.test(input.to) ? input.to : ''
  const subject = encodeURIComponent(input.subject)
  const full = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(input.body)}`
  if (full.length <= MAILTO_MAX) return { href: full, bodyIncluded: true }
  return { href: `mailto:${to}?subject=${subject}`, bodyIncluded: false }
}

/** The text of an email draft as it goes into the mail: body, then the P.S. */
export const emailText = (d: { body: string; ps: string }) => (d.ps ? `${d.body}\n\nP.S. ${d.ps}` : d.body)
