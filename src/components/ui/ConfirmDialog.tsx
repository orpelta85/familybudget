'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function useConfirmDialog() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirmDialog must be used within ConfirmDialogProvider')
  return ctx.confirm
}

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{
    open: boolean
    options: ConfirmOptions
    resolve: ((v: boolean) => void) | null
  }>({ open: false, options: { message: '' }, resolve: null })

  const dialogRef = useRef<HTMLDivElement>(null)
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      setState({ open: true, options, resolve })
    })
  }, [])

  const close = useCallback((result: boolean) => {
    state.resolve?.(result)
    setState(prev => ({ ...prev, open: false, resolve: null }))
  }, [state.resolve])

  // Focus trap + keyboard
  useEffect(() => {
    if (!state.open) return

    // Focus cancel button on open (safer default for destructive actions)
    cancelBtnRef.current?.focus()

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        close(false)
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        close(true)
      }
      // Focus trap
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled])'
        )
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [state.open, close])

  // Prevent body scroll when open
  useEffect(() => {
    if (state.open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [state.open])

  return (
    <ConfirmContext value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-xs animate-in fade-in-0 duration-150"
            onClick={() => close(false)}
          />
          {/* Dialog */}
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            aria-describedby="confirm-message"
            className="relative z-10 w-full max-w-[calc(100%-2rem)] sm:max-w-sm rounded-xl bg-background p-5 ring-1 ring-foreground/10 animate-in fade-in-0 zoom-in-95 duration-150"
          >
            <h2
              id="confirm-title"
              className="text-base font-medium leading-snug mb-2"
            >
              {state.options.title ?? 'אישור פעולה'}
            </h2>
            <p
              id="confirm-message"
              className="text-sm text-muted-foreground whitespace-pre-line leading-relaxed"
            >
              {state.options.message}
            </p>
            <div className="flex gap-2 mt-5 justify-start">
              <Button
                ref={confirmBtnRef}
                variant="destructive"
                size="sm"
                onClick={() => close(true)}
              >
                {state.options.confirmText ?? 'אישור'}
              </Button>
              <Button
                ref={cancelBtnRef}
                variant="outline"
                size="sm"
                onClick={() => close(false)}
              >
                {state.options.cancelText ?? 'ביטול'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext>
  )
}
