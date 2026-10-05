import { isIP } from 'node:net'

// Which IP addresses the cockpit never fetches from: loopback, private networks, link-local (cloud
// metadata lives at 169.254.169.254), carrier NAT, multicast and reserved ranges, also when an IPv4
// address hides inside an IPv6 one (::ffff:127.0.0.1, which a URL turns into ::ffff:7f00:1).

const PRIVATE_V4 = [
  /^0\./,
  /^10\./,
  /^127\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^192\.0\.0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.1[89]\./,
  /^(22[4-9]|2[3-5]\d)\./,
]

/** The IPv4 address inside an IPv4-mapped or -compatible IPv6 address, else null. */
function mappedV4(v6: string): string | null {
  const dotted = /^(?:0*:)*(?:ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/.exec(v6)
  if (dotted) return dotted[1]
  const hex = /^(?:0*:)*(?:ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v6)
  if (!hex) return null
  const hi = parseInt(hex[1], 16)
  const lo = parseInt(hex[2], 16)
  return [hi >> 8, hi & 255, lo >> 8, lo & 255].join('.')
}

export function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (isIP(a) === 4) return PRIVATE_V4.some((r) => r.test(a))
  if (isIP(a) !== 6) return true
  const v4 = mappedV4(a)
  if (v4) return PRIVATE_V4.some((r) => r.test(v4))
  return a === '::1' || a === '::' || /^f[cd]/.test(a) || /^fe[89ab]/.test(a) || a.startsWith('ff') || a.startsWith('64:ff9b:') || a.startsWith('2001:db8:')
}
