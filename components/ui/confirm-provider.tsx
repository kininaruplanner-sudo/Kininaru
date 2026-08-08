'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null)
  const resolveRef = useRef<((value: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts)
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve
    })
  }, [])

  const settle = (result: boolean) => {
    resolveRef.current?.(result)
    resolveRef.current = null
    setOptions(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}

      <Modal open={!!options} onClose={() => settle(false)} title="" maxWidth="max-w-sm">
        {options && (
          <div>
            <div className="flex items-start gap-3 -mt-2">
              <span
                className={`flex items-center justify-center size-10 rounded-xl shrink-0 ${
                  options.danger ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'
                }`}
              >
                <AlertTriangle className="size-5" />
              </span>
              <div>
                <h2 className="text-base font-serif font-bold text-foreground">{options.title}</h2>
                {options.description && (
                  <p className="text-sm text-muted-foreground mt-1">{options.description}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-5">
              <Button variant="outline" className="flex-1" onClick={() => settle(false)}>
                {options.cancelLabel ?? 'Annuler'}
              </Button>
              <Button
                variant={options.danger ? 'destructive' : 'default'}
                className="flex-1"
                onClick={() => settle(true)}
                autoFocus
              >
                {options.confirmLabel ?? 'Confirmer'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const confirm = useContext(ConfirmContext)
  if (!confirm) {
    throw new Error('useConfirm must be used within a ConfirmProvider')
  }
  return confirm
}
