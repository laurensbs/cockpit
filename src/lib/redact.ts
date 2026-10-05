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
  // Mollie keys and organisation tokens, and Google access tokens.
  /\b(?:live|test|access)_[A-Za-z0-9]{25,}/g,
  /\bya29\.[A-Za-z0-9_-]{20,}/g,
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
