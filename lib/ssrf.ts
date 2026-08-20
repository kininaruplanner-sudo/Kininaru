/**
 * SSRF Protection — blocks requests to private/internal IPs.
 *
 * Used by any route that fetches user-supplied URLs (ICS import, etc.).
 */

import { isIPv4, isIPv6 } from 'net'

/**
 * Checks if an IP address belongs to a private/reserved range.
 * Covers RFC 1918, loopback, link-local, multicast, carrier-grade NAT, etc.
 */
export function isPrivateIP(ip: string): boolean {
  // IPv4 checks
  if (isIPv4(ip)) {
    const parts = ip.split('.').map(Number)
    const [a, b] = parts

    // Loopback: 127.0.0.0/8
    if (a === 127) return true
    // Private (RFC 1918): 10.0.0.0/8
    if (a === 10) return true
    // Private (RFC 1918): 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return true
    // Private (RFC 1918): 192.168.0.0/16
    if (a === 192 && b === 168) return true
    // Link-local: 169.254.0.0/16
    if (a === 169 && b === 254) return true
    // Multicast: 224.0.0.0/4
    if (a >= 224 && a <= 239) return true
    // Broadcast: 255.255.255.255
    if (ip === '255.255.255.255') return true
    // Carrier-grade NAT: 100.64.0.0/10
    if (a === 100 && b >= 64 && b <= 127) return true
    // 0.0.0.0/8
    if (a === 0) return true
    // 198.18.0.0/15 (benchmarking)
    if (a === 198 && (b === 18 || b === 19)) return true

    return false
  }

  // IPv6 checks
  if (isIPv6(ip)) {
    const normalized = ip.toLowerCase()
    // Loopback: ::1
    if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true
    // Unspecified: ::
    if (normalized === '::' || normalized === '0:0:0:0:0:0:0:0') return true
    // Link-local: fe80::/10
    if (normalized.startsWith('fe80:')) return true
    // Unique local: fc00::/7
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true
    // Multicast: ff00::/8
    if (normalized.startsWith('ff')) return true

    return false
  }

  // Unknown format — block to be safe
  return true
}

/**
 * Resolves a hostname to its IP addresses.
 * Uses Node.js built-in dns module.
 */
export async function dnsResolve(hostname: string): Promise<string[]> {
  const { resolve4, resolve6 } = await import('dns/promises')
  const results: string[] = []

  try {
    const ipv4 = await resolve4(hostname)
    results.push(...ipv4)
  } catch {
    // No IPv4 records
  }

  try {
    const ipv6 = await resolve6(hostname)
    results.push(...ipv6)
  } catch {
    // No IPv6 records
  }

  if (results.length === 0) {
    throw new Error(`No DNS records found for ${hostname}`)
  }

  return results
}
