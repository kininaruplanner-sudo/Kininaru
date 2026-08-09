import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // Bound the number of workers used to collect page data: the app must
  // build comfortably inside memory-constrained environments (2 GB cgroup
  // in this workspace, and the shared hosting builder). TypeScript errors
  // are NOT ignored — the build fails on them.
  experimental: {
    cpus: 4,
  },
  // Pin the workspace root to this project folder so Next/Turbopack never
  // picks up a stray lockfile elsewhere (e.g. in the user's home directory)
  // and silently resolves modules/config from the wrong place.
  turbopack: {
    root: __dirname,
  },
  // Baseline security headers: clickjacking protection, MIME sniffing
  // prevention, and a conservative referrer policy. Deliberately no strict
  // CSP here — the app uses inline scripts (theme init), so a restrictive
  // CSP would break it without extensive testing.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
    ]
  },
}

export default nextConfig
