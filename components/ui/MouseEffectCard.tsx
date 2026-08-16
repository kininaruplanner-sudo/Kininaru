'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useReducedMotion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface MouseEffectCardProps {
  title: string
  subtitle?: string
  topText?: string
  topSubtext?: string
  primaryCtaText?: string
  primaryCtaUrl?: string
  secondaryCtaText?: string
  secondaryCtaUrl?: string
  /** Rayon des points du motif (px). */
  dotSize?: number
  /** Écartement de la grille de points (px). */
  dotSpacing?: number
  /** Rayon d'influence de la souris (px). */
  repulsionRadius?: number
  /** Intensité du déplacement des points (px). */
  repulsionStrength?: number
  className?: string
}

interface Dot {
  baseX: number
  baseY: number
  x: number
  y: number
  color: string
}

const PALETTE_FALLBACK = ['#00C2E0', '#1A365D', '#FF6B35', '#6A2B05']

/**
 * MouseEffectCard — carte CTA interactive avec un motif de points qui
 * s'écarte de la souris (répulsion), adaptée à l'identité Kininaru :
 *
 * - les points prennent les couleurs de la palette unique (--kt-brand /
 *   --kt-cool / --kt-warm / --kt-complement) ;
 * - le déplacement est lissé (lerp) et s'efface quand la souris quitte la
 *   carte ;
 * - `prefers-reduced-motion` : motif statique en CSS, aucun canvas, aucune
 *   animation.
 */
export default function MouseEffectCard({
  title,
  subtitle,
  topText,
  topSubtext,
  primaryCtaText = 'Commencer',
  primaryCtaUrl = '/auth/sign-up',
  secondaryCtaText,
  secondaryCtaUrl,
  dotSize = 2,
  dotSpacing = 16,
  repulsionRadius = 90,
  repulsionStrength = 25,
  className,
}: MouseEffectCardProps) {
  const reduced = useReducedMotion()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (reduced) return
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Couleurs de la palette active (le thème est unique, mais on lit les
    // variables CSS pour ne jamais coder les couleurs en dur).
    const css = getComputedStyle(document.documentElement)
    const readVar = (name: string, fallback: string) =>
      css.getPropertyValue(name).trim() || fallback
    const palette = PALETTE_FALLBACK.map((hex, i) =>
      readVar(`--kt-${['brand', 'cool', 'warm', 'complement'][i]}`, hex)
    )

    let dots: Dot[] = []
    let raf = 0
    const mouse = { x: 0, y: 0, active: false }
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    const buildDots = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * dpr))
      canvas.height = Math.max(1, Math.round(rect.height * dpr))
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, rect.width, rect.height)

      const cols = Math.max(1, Math.floor(rect.width / dotSpacing))
      const rows = Math.max(1, Math.floor(rect.height / dotSpacing))
      const offsetX = (rect.width - (cols - 1) * dotSpacing) / 2
      const offsetY = (rect.height - (rows - 1) * dotSpacing) / 2
      dots = []
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = offsetX + c * dotSpacing
          const baseY = offsetY + r * dotSpacing
          dots.push({
            baseX,
            baseY,
            x: baseX,
            y: baseY,
            color: palette[(r * cols + c) % palette.length],
          })
        }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.active = true
    }
    const onPointerLeave = () => {
      mouse.active = false
    }

    const draw = () => {
      raf = requestAnimationFrame(draw)
      const rect = container.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      const ease = 0.14
      for (const dot of dots) {
        let tx = dot.baseX
        let ty = dot.baseY
        if (mouse.active) {
          const dx = dot.baseX - mouse.x
          const dy = dot.baseY - mouse.y
          const dist = Math.hypot(dx, dy)
          if (dist < repulsionRadius && dist > 0.01) {
            const force = (1 - dist / repulsionRadius) * repulsionStrength
            tx = dot.baseX + (dx / dist) * force
            ty = dot.baseY + (dy / dist) * force
          }
        }
        dot.x += (tx - dot.x) * ease
        dot.y += (ty - dot.y) * ease

        ctx.globalAlpha = 0.5
        ctx.fillStyle = dot.color
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dotSize, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    buildDots()
    const observer = new ResizeObserver(buildDots)
    observer.observe(container)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerleave', onPointerLeave)
    draw()

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerleave', onPointerLeave)
    }
  }, [reduced, dotSize, dotSpacing, repulsionRadius, repulsionStrength])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-[40px] border border-border bg-card shadow-kin-hover w-full max-w-3xl mx-auto',
        className
      )}
    >
      {reduced ? (
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              'radial-gradient(circle at 0 0, color-mix(in srgb, var(--kt-brand) 40%, transparent) 1.5px, transparent 2px), radial-gradient(circle at 8px 8px, color-mix(in srgb, var(--kt-warm) 35%, transparent) 1.5px, transparent 2px)',
            backgroundSize: '16px 16px',
            opacity: 0.5,
          }}
        />
      ) : (
        <canvas ref={canvasRef} aria-hidden className="absolute inset-0 w-full h-full" />
      )}
      <div className="absolute inset-0 kin-glow pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-6 py-12 sm:px-14 sm:py-16">
        {(topText || topSubtext) && (
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border bg-background/70 text-xs font-medium text-muted-foreground mb-6 shadow-kin">
            {topText && <span className="font-semibold text-foreground">{topText}</span>}
            {topText && topSubtext && <span className="w-1 h-1 rounded-full bg-primary/50" aria-hidden />}
            {topSubtext && <span>{topSubtext}</span>}
          </div>
        )}

        <h2 className="kin-h1 text-foreground mb-4 max-w-xl">{title}</h2>

        {subtitle && <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-md">{subtitle}</p>}

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {primaryCtaUrl && (
            <Button
              size="lg"
              className="h-12 px-8 text-base gap-2"
              render={<Link href={primaryCtaUrl}>{primaryCtaText}</Link>}
            >
              {primaryCtaText} <ArrowRight className="w-4 h-4" />
            </Button>
          )}
          {secondaryCtaUrl && secondaryCtaText && (
            <Button
              size="lg"
              variant="outline"
              className="h-12 px-8 text-base"
              render={<Link href={secondaryCtaUrl}>{secondaryCtaText}</Link>}
            >
              {secondaryCtaText}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
