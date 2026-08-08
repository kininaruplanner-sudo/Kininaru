import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoMarkProps {
  className?: string
  /** Renders only the lotus mark, without the wordmark — for tight spaces like a collapsed sidebar. */
  iconOnly?: boolean
}

export function LogoMark({ className, iconOnly = false }: LogoMarkProps) {
  if (iconOnly) {
    return (
      <span className={cn('flex size-8 items-center justify-center shrink-0', className)}>
        <Image src="/brand/lotus-mark.png" alt="Kininaru" width={179} height={123} className="w-full h-full object-contain" priority />
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex size-8 items-center justify-center shrink-0">
        <Image src="/brand/lotus-mark.png" alt="" width={179} height={123} className="w-full h-full object-contain" priority />
      </span>
      <span className="font-serif font-bold text-lg text-foreground tracking-tight">
        Kininaru
      </span>
    </span>
  )
}
