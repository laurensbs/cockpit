/**
 * The Content-Security-Policy of every page. Scripts run only when they carry this response's
 * nonce (Next.js adds it to its own scripts) or were loaded by such a script, so markup that
 * slips into a page (from a README, or from text the AI wrote) can never run code. Images may
 * come from any https address, such as a project's own logo.
 */
export function contentSecurityPolicy(nonce: string, options: { dev: boolean; https: boolean }): string {
  return [
    "default-src 'self'",
    // React needs eval only in development, for its error stacks.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ''}`,
    // React sets style attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.https ? ['upgrade-insecure-requests'] : []),
  ].join('; ')
}

/** A fresh random nonce for one response. */
export function newNonce(): string {
  return btoa(crypto.randomUUID())
}
