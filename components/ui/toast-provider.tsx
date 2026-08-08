'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastVariant = 'success' | 'error' | 'info'

interface ToastInput {
  title: string
  description?: string
  variant?: ToastVariant
  duration?: number
}

interface ToastItem extends ToastInput {
  id: string
}

type ToastFn = (toast: ToastInput) => void

const ToastContext = createContext<ToastFn | null>(null)

const VARIANT_CONFIG: Record<ToastVariant, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-kin-sage' },
  error: { icon: AlertCircle, className: 'text-destructive' },
  info: { icon: Info, className: 'text-primary' },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const toast = useCallback<ToastFn>((input) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setToasts((prev) => [...prev, { id, variant: 'info', duration: 4000, ...input }])
    const timer = setTimeout(() => dismiss(id), input.duration ?? 4000)
    timers.current.set(id, timer)
  }, [dismiss])

  return (
    <ToastContext.Provider value={toast}>
      {children}

      <div
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm sm:bottom-6 sm:left-auto sm:right-6 sm:translate-x-0"
        aria-live="polite"
        aria-atomic="false"
      >
        <AnimatePresence>
          {toasts.map((t) => {
            const config = VARIANT_CONFIG[t.variant ?? 'info']
            const Icon = config.icon
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                role="status"
                className="glass flex items-start gap-3 rounded-2xl border border-border shadow-kin-hover p-4"
              >
                <Icon className={cn('size-4 shrink-0 mt-0.5', config.className)} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  {t.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  className="text-muted-foreground hover:text-foreground transition-smooth shrink-0"
                  aria-label="Fermer la notification"
                >
                  <X className="size-3.5" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const toast = useContext(ToastContext)
  if (!toast) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return toast
}
