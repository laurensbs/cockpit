// Repository text (README, docs, commit messages) is stored and sent to the AI. Anything that
// looks like a secret is blanked first, so a key pasted into a README never travels further.

const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{16,}/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bxox[abpr]-[A-Za-z0-9-]{10,}/g,
  /\b(?:re|rk|sk|pk)_(?:live|test)_[A-Za-z0-9]{10,}/g,
  /\bAIza[0-9A-Za-z_-]{30,}/g,
  // Connection strings with a password in them.
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s:/@]+:[^\s@]+@[^\s]+/gi,
]

// KEY=value lines whose name says secret, password, token or key (on one line: an empty example stays).
const ASSIGNMENT = /^([ \t]*(?:export[ \t]+)?[A-Z0-9_]*(?:SECRET|PASSWORD|TOKEN|API_KEY|PRIVATE_KEY|ACCESS_KEY)[A-Z0-9_]*[ \t]*[=:][ \t]*)(\S.*)$/gim

export const REDACTED = '[verborgen]'

export function redactSecrets(text: string): string {
  let out = text
  for (const pattern of PATTERNS) out = out.replace(pattern, REDACTED)
  return out.replace(ASSIGNMENT, (_m, name: string, value: string) => (value.trim() === '' || value.includes(REDACTED) ? `${name}${value}` : `${name}${REDACTED}`))
}

/** Shortens text to at most max characters, on a line break when one is near. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const cut = text.lastIndexOf('\n', max)
  return `${text.slice(0, cut > max * 0.8 ? cut : max).trimEnd()}\n…`
}

// Addresses and phone numbers of a business stay in the cockpit (it reads them from the site itself);
// in text that Claude writes or reads they become a placeholder.
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const PHONE = /\+?\(?\d[\d\s().-]{7,}\d/g

export function hideContactDetails(text: string): string {
  return text.replace(EMAIL, '[e-mail]').replace(PHONE, (m) => (m.replace(/\D/g, '').length >= 9 ? '[telefoon]' : m))
}
