import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Pin the workspace root to this project folder so Next/Turbopack never
  // picks up a stray lockfile elsewhere (e.g. in the user's home directory)
  // and silently resolves modules/config from the wrong place.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
