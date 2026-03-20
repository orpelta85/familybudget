'use client'

import { useState, useEffect } from 'react'
import { Info, X } from 'lucide-react'

interface PageInfoProps {
  title: string
  description: string
  steps?: string[]
  tips: string[]
}

export function PageInfo({ title, description, steps, tips }: PageInfoProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-transparent border-none cursor-pointer p-0 flex items-center justify-center shrink-0"
        aria-label={`מידע על ${title}`}
      >
        <Info size={18} style={{ color: 'oklch(0.55 0.01 250)' }} />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed top-0 left-0 z-50"
            style={{
              width: '100vw',
              height: '100vh',
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setOpen(false)}
          />

          {/* Drawer */}
          <div
            className="fixed top-0 right-0 z-50 h-full overflow-y-auto"
            style={{
              width: 'min(380px, 90vw)',
              background: 'oklch(0.15 0.01 250)',
              borderLeft: '1px solid oklch(0.25 0.01 250)',
              boxShadow: '-8px 0 32px rgba(0,0,0,0.4)',
              animation: 'slideInRight 0.2s ease-out forwards',
            }}
          >
            {/* Header */}
            <div
              className="flex justify-between items-center"
              style={{
                padding: '20px 20px 16px',
                borderBottom: '1px solid oklch(0.22 0.01 250)',
              }}
            >
              <div className="flex items-center gap-2">
                <Info size={18} style={{ color: 'oklch(0.65 0.18 250)' }} />
                <h2 className="text-[16px] font-bold m-0" style={{ color: 'oklch(0.88 0.01 250)' }}>
                  {title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="bg-transparent border-none cursor-pointer p-1.5 rounded-lg"
                style={{ color: 'oklch(0.55 0.01 250)' }}
                aria-label="סגור"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: '20px' }}>
              {/* Description */}
              <div style={{ marginBottom: 24 }}>
                <h3
                  className="text-[13px] font-semibold uppercase tracking-wide m-0"
                  style={{ color: 'oklch(0.55 0.01 250)', marginBottom: 8 }}
                >
                  מה זה?
                </h3>
                <p
                  className="text-[13px] leading-relaxed m-0"
                  style={{ color: 'oklch(0.75 0.01 250)' }}
                >
                  {description}
                </p>
              </div>

              {/* Steps */}
              {steps && steps.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <h3
                    className="text-[13px] font-semibold uppercase tracking-wide m-0"
                    style={{ color: 'oklch(0.55 0.01 250)', marginBottom: 8 }}
                  >
                    איך להשתמש?
                  </h3>
                  <div className="flex flex-col gap-2">
                    {steps.map((step, i) => (
                      <div key={i} className="flex gap-2.5 items-start">
                        <span
                          className="text-[11px] font-bold shrink-0 flex items-center justify-center"
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            background: 'oklch(0.22 0.04 250)',
                            color: 'oklch(0.65 0.18 250)',
                          }}
                        >
                          {i + 1}
                        </span>
                        <span
                          className="text-[13px] leading-relaxed"
                          style={{ color: 'oklch(0.72 0.01 250)' }}
                        >
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tips */}
              <div>
                <h3
                  className="text-[13px] font-semibold uppercase tracking-wide m-0"
                  style={{ color: 'oklch(0.55 0.01 250)', marginBottom: 8 }}
                >
                  טיפים ונתונים
                </h3>
                <div className="flex flex-col gap-2.5">
                  {tips.map((tip, i) => (
                    <div
                      key={i}
                      className="text-[13px] leading-relaxed"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        background: 'oklch(0.19 0.01 250)',
                        border: '1px solid oklch(0.24 0.01 250)',
                        color: 'oklch(0.75 0.01 250)',
                      }}
                    >
                      {tip}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

    </>
  )
}
