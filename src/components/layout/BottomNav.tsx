'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Receipt, Home, Menu, Wallet, BarChart3, Settings, TrendingUp, CreditCard, Sparkles, CalendarDays, Calculator, Shield, Crosshair, Archive, Baby, Landmark, Banknote, ListChecks, X } from 'lucide-react'

const nav = [
  { href: '/',          label: 'דשבורד',  icon: LayoutDashboard },
  { href: '/expenses',  label: 'הוצאות',  icon: Receipt },
  { href: '/goals',     label: 'יעדים',   icon: Crosshair },
  { href: '/analytics', label: 'שנתי',    icon: BarChart3 },
]

type MoreLink = { href: string; label: string; icon: typeof LayoutDashboard }
type MoreSection = { sectionLabel: string; items: MoreLink[] }

const moreSections: MoreSection[] = [
  {
    sectionLabel: 'פעילות שוטפת',
    items: [
      { href: '/income',   label: 'הכנסות',       icon: Wallet },
      { href: '/budget',   label: 'תקציב',        icon: ListChecks },
      { href: '/joint',    label: 'קופה קטנה',    icon: Banknote },
      { href: '/kids',     label: 'ילדים',         icon: Baby },
    ],
  },
  {
    sectionLabel: 'חיסכון ויעדים',
    items: [
      { href: '/sinking',  label: 'קרנות צבירה',  icon: Archive },
      { href: '/pension',  label: 'פנסיה',         icon: Landmark },
    ],
  },
  {
    sectionLabel: 'נכסים והתחייבויות',
    items: [
      { href: '/net-worth',  label: 'שווי נקי',    icon: TrendingUp },
      { href: '/mortgage',   label: 'משכנתא',       icon: Home },
      { href: '/debts',      label: 'חובות',        icon: Calculator },
      { href: '/insurance',  label: 'ביטוחים',      icon: Shield },
    ],
  },
  {
    sectionLabel: 'תכנון וניתוח',
    items: [
      { href: '/subscriptions', label: 'מנויים',   icon: CreditCard },
      { href: '/forecast',      label: 'תחזית',    icon: CalendarDays },
      { href: '/advisor',       label: 'יועץ',     icon: Sparkles },
      { href: '/family',        label: 'הגדרות',   icon: Settings },
    ],
  },
]

const allMoreLinks = moreSections.flatMap(s => s.items)

export function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const touchStartY = useRef<number | null>(null)

  const closeSheet = useCallback(() => setShowMore(false), [])

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (showMore) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [showMore])

  // Escape key closes the sheet
  useEffect(() => {
    if (!showMore) return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') closeSheet()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showMore, closeSheet])

  // Focus trap
  useEffect(() => {
    if (!showMore || !sheetRef.current) return
    const sheet = sheetRef.current
    const focusable = sheet.querySelectorAll<HTMLElement>(
      'a[href], button, [tabindex]:not([tabindex="-1"])'
    )
    if (focusable.length > 0) focusable[0].focus()

    function handleTab(e: KeyboardEvent) {
      if (e.key !== 'Tab' || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleTab)
    return () => document.removeEventListener('keydown', handleTab)
  }, [showMore])

  // Swipe down to close
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY
  }, [])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartY.current === null) return
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    if (deltaY > 80) closeSheet()
    touchStartY.current = null
  }, [closeSheet])

  const isMoreActive = allMoreLinks.some(l => pathname === l.href)

  return (
    <>
      <nav className="flex md:hidden fixed bottom-0 inset-x-0 h-[60px] bg-[var(--c-0-14)] border-t border-[var(--bg-hover)] items-center z-40">
        {nav.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-1 py-2 no-underline transition-colors duration-150 text-[10px]',
                active ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
              )}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </Link>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setShowMore(v => !v)}
          className={cn(
            'flex-1 flex flex-col items-center gap-1 py-2 bg-transparent border-none cursor-pointer transition-colors duration-150 text-[10px]',
            isMoreActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
          )}
        >
          <Menu size={18} />
          <span>עוד</span>
        </button>
      </nav>

      {/* Full-screen navigation sheet */}
      {showMore && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/50 animate-[fadeIn_200ms_ease-out]"
            aria-hidden="true"
            onClick={closeSheet}
          />

          {/* Sheet */}
          <div
            ref={sheetRef}
            role="dialog"
            aria-label="תפריט ניווט"
            className="absolute bottom-0 inset-x-0 max-h-[85vh] bg-[var(--c-0-14)] rounded-t-2xl overflow-y-auto animate-[slideUp_200ms_ease-out]"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[var(--text-muted)] opacity-40" />
            </div>

            {/* Close button */}
            <div className="flex justify-end px-4 pb-1">
              <button
                onClick={closeSheet}
                className="p-1.5 rounded-lg bg-transparent border-none cursor-pointer text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="סגור תפריט"
              >
                <X size={20} />
              </button>
            </div>

            {/* Sections */}
            <div className="px-5 pb-8">
              {moreSections.map((section, si) => (
                <div key={section.sectionLabel} className={si > 0 ? 'mt-5' : ''}>
                  <div className="text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)] mb-2.5 select-none">
                    {section.sectionLabel}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {section.items.map(item => {
                      const active = pathname === item.href
                      const Icon = item.icon
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeSheet}
                          className={cn(
                            'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl no-underline transition-colors duration-150',
                            active
                              ? 'bg-[var(--c-blue-0-22)] text-[var(--accent-blue)]'
                              : 'bg-transparent text-[var(--text-secondary)]'
                          )}
                        >
                          <Icon size={20} />
                          <span className="text-[11px] leading-tight text-center">{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Sheet animations */}
      <style jsx global>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  )
}
