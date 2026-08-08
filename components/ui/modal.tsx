'use client'

import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './button'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: string
}

export function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  // Escape closes the dialog, and focus moves into it on open — both matter
  // for keyboard users and are otherwise easy to lose track of once a modal
  // stops being a one-off inline block and becomes a shared primitive.
  useEffect(() => {
    if (!open) return

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const raf = requestAnimationFrame(() => dialogRef.current?.focus())

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      cancelAnimationFrame(raf)
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={title || undefined}
            tabIndex={-1}
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className={cn(
              'glass border border-border rounded-3xl p-6 w-full shadow-kin-hover max-h-[85vh] overflow-y-auto outline-none',
              maxWidth
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {title && (
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-serif font-bold text-foreground">{title}</h2>
                <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Fermer">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
