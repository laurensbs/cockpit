import { describe, expect, it } from 'vitest'
import { isPrivateAddress } from './addresses'

describe('isPrivateAddress', () => {
  it('blocks local, private and metadata addresses', () => {
    for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fd00::1', 'fe80::1', 'ff02::1']) {
      expect(isPrivateAddress(a), a).toBe(true)
    }
  })

  it('blocks an IPv4 address hidden in IPv6, dotted or in hex', () => {
    for (const a of ['::ffff:127.0.0.1', '::ffff:7f00:1', '[::ffff:a9fe:a9fe]', '::ffff:10.0.0.1', '::ffff:c0a8:101', '::127.0.0.1']) {
      expect(isPrivateAddress(a), a).toBe(true)
    }
  })

  it('lets public addresses through', () => {
    for (const a of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700:4700::1111', '::ffff:8.8.8.8', '::ffff:808:808']) {
      expect(isPrivateAddress(a), a).toBe(false)
    }
  })

  it('treats anything that is not an address as unsafe', () => {
    expect(isPrivateAddress('example.com')).toBe(true)
  })
})
