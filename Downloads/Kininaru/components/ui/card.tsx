import { type HTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

/**
 * Shared card shape: rounded-2xl (24px per the Kininaru spec) + border + background.
 *
 * Exported as a class-generator (not just a component) because several pages wrap
 * cards in framer-motion's `motion.div` for entrance animation, which needs a
 * className string rather than a nested component. Use `<Card>` for plain cards,
 * or `cardVariants({...})` to apply the same rules to a `motion.div`.
 */
const cardVariants = cva('rounded-2xl border', {
  variants: {
    variant: {
      default: 'bg-card border-border',
      accent: 'bg-primary/5 border-primary/20',
    },
    padding: {
      sm: 'p-4',
      md: 'p-5',
      lg: 'p-6',
    },
    hover: {
      true: 'hover-lift transition-smooth',
      false: '',
    },
  },
  defaultVariants: {
    variant: 'default',
    padding: 'md',
    hover: false,
  },
})

interface CardProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof cardVariants> {}

function Card({ className, variant, padding, hover, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, padding, hover }), className)}
      {...props}
    />
  )
}

export { Card, cardVariants }
