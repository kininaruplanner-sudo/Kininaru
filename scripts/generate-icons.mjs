/**
 * Kininaru — icon pipeline.
 *
 * Regenerates every raster icon from the single visual source
 * `public/icon.svg` (rounded tile + lotus mark + wordmark):
 *
 *   icon-192x192.png          manifest icon (192)
 *   icon-512x512.png          manifest icon (512)
 *   apple-icon.png            Apple touch icon (180)
 *   icon-light-32x32.png      favicon (32)
 *   icon-maskable-512x512.png maskable icon (512) — lotus mark inside the safe zone
 *   favicon.ico               multi-size ICO (16/32/48)
 *
 * Run with:  npm run icons
 * The maskable variant is rebuilt from the <path> elements of icon.svg, so the
 * mark can never drift from the brand source.
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = (name) => join(root, 'public', name)

// Marque Memphis moderne : cyan #00C2E0 → marine #1A365D → orange #FF6B35,
// fond blanc épuré (charte harmonisée #FFFFFF).
const BRAND_GRADIENT_ID = 'kin-logo-grad'
const BRAND_BG = '#FFFFFF'

const iconSvg = readFileSync(out('icon.svg'), 'utf8')

// Raster icons are mark-only (no wordmark): the <text> element depends on
// system fonts, which are not guaranteed in every rasterizer environment.
// Browsers render the SVG favicon (with the wordmark) using their own fonts.
const tileSvg = iconSvg.replace(/<text[\s\S]*?<\/text>/g, '')

// The lotus mark = every <path d="..."> in icon.svg, rendered alone, with
// the brand gradient defs (extracted from icon.svg) so the mark keeps its
// cyan → marine → orange dégradé.
const defs = [...iconSvg.matchAll(/<defs>[\s\S]*?<\/defs>/g)].map((m) => m[0]).join('')
const paths = [...iconSvg.matchAll(/<path d="([^"]+)"/g)].map((m) => m[1])
if (paths.length === 0) throw new Error('Aucun <path> trouvé dans public/icon.svg')

const MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${defs}${paths
  .map((d) => `<path d="${d}" fill="url(#${BRAND_GRADIENT_ID})"/>`)
  .join('')}</svg>`

/** Builds a multi-entry ICO (PNG-compressed entries — supported everywhere modern). */
function buildIco(entries) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(entries.length, 4)
  const parts = [header]
  let offset = 6 + 16 * entries.length
  for (const e of entries) {
    const dir = Buffer.alloc(16)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, 0)
    dir.writeUInt8(e.size >= 256 ? 0 : e.size, 1)
    dir.writeUInt8(0, 2) // palette
    dir.writeUInt8(0, 3) // reserved
    dir.writeUInt16LE(1, 4) // color planes
    dir.writeUInt16LE(32, 6) // bits per pixel
    dir.writeUInt32LE(e.png.length, 8)
    dir.writeUInt32LE(offset, 12)
    offset += e.png.length
    parts.push(dir)
  }
  for (const e of entries) parts.push(e.png)
  return Buffer.concat(parts)
}

async function main() {
  // 1. Full tile icons (white rounded tile + lotus + wordmark).
  for (const [size, name] of [
    [192, 'icon-192x192.png'],
    [512, 'icon-512x512.png'],
    [180, 'apple-icon.png'],
    [32, 'icon-light-32x32.png'],
  ]) {
    await sharp(Buffer.from(tileSvg)).resize(size, size).png().toFile(out(name))
    console.log(`✔ ${name} (${size}px)`)
  }

  // 2. Maskable 512 — solid background + lotus scaled into the ~80% safe zone
  //    (a 512 tile's safe circle is ~410px; 360px keeps a comfortable margin).
  await sharp({
    create: { width: 512, height: 512, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: Buffer.from(MARK_SVG), top: 76, left: 76 }]) // 360×360 centered
    .png()
    .toFile(out('icon-maskable-512x512.png'))
  console.log('✔ icon-maskable-512x512.png (512px)')

  // 3. favicon.ico — 16/32/48 PNG entries packed into an ICO container.
  const sizes = [16, 32, 48]
  const pngs = await Promise.all(
    sizes.map((s) => sharp(Buffer.from(tileSvg)).resize(s, s).png().toBuffer())
  )
  writeFileSync(out('favicon.ico'), buildIco(sizes.map((s, i) => ({ size: s, png: pngs[i] }))))
  console.log('✔ favicon.ico (16/32/48px)')

  console.log('\nIcônes régénérées depuis public/icon.svg ✓')
}

main().catch((err) => {
  console.error('Échec de la génération des icônes :', err)
  process.exit(1)
})
