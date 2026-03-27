'use client'

import { useState, useRef, useEffect } from 'react'
import { Info, X } from 'lucide-react'

interface InfoTooltipProps {
  title?: string
  body: string
  size?: number
}

export function InfoTooltip({ title, body, size = 14 }: InfoTooltipProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
        className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center shrink-0"
        aria-label={title ?? 'מידע נוסף'}
      >
        <Info size={size} style={{ color: 'var(--text-muted)' }} />
      </button>
      {open && (
        <span
          className="absolute z-50 top-full mt-1.5 block"
          style={{
            right: 0,
            minWidth: 220,
            maxWidth: 300,
            background: 'var(--bg-hover)',
            borderRadius: 12,
            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            border: '1px solid var(--c-0-30)',
            padding: '12px 14px',
          }}
        >
          <span className="flex justify-between items-start gap-2 mb-1" style={{ display: 'flex' }}>
            {title && (
              <span className="text-[12px] font-semibold" style={{ color: 'var(--c-0-82)' }}>
                {title}
              </span>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="bg-transparent border-none cursor-pointer p-0 shrink-0"
              aria-label="סגור"
            >
              <X size={12} style={{ color: 'var(--c-0-50)' }} />
            </button>
          </span>
          <span className="text-[12px] leading-relaxed block" style={{ color: 'var(--c-0-68)' }}>
            {body}
          </span>
        </span>
      )}
    </span>
  )
}
