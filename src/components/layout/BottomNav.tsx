'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Receipt, Home, Menu, Wallet, BarChart3, Heart, TrendingUp, CreditCard, Sparkles, CalendarDays, Calculator, Shield, Crosshair, Archive, Baby, Landmark, Banknote, ListChecks } from 'lucide-react'

const nav = [
  { href: '/',          label: 'דשבורד',  icon: LayoutDashboard },
  { href: '/expenses',  label: 'הוצאות',  icon: Receipt },
  { href: '/goals',     label: 'יעדים',   icon: Crosshair },
  { href: '/analytics', label: 'שנתי',    icon: BarChart3 },
]

const moreLinks = [
  { href: '/income',   label: 'הכנסות',       icon: Wallet },
  { href: '/budget',   label: 'תקציב',        icon: ListChecks },
  { href: '/joint',    label: 'קופה קטנה',     icon: Banknote },
  { href: '/sinking',  label: 'קרנות צבירה',  icon: Archive },
  { href: '/kids',          label: 'ילדים',        icon: Baby },
  { href: '/pension',       label: 'פנסיה',        icon: Landmark },
  { href: '/mortgage',      label: 'משכנתא',       icon: Home },
  { href: '/debts',         label: 'חובות',       icon: Calculator },
  { href: '/net-worth',     label: 'שווי נקי',    icon: TrendingUp },
  { href: '/insurance',    label: 'ביטוחים',     icon: Shield },
  { href: '/subscriptions',label: 'מנויים',      icon: CreditCard },
  { href: '/forecast',     label: 'תחזית',       icon: CalendarDays },
  { href: '/advisor',      label: 'יועץ',        icon: Sparkles },
  { href: '/family',       label: 'משפחה',        icon: Heart },
]

export function BottomNav() {
  const pathname = usePathname()
  const [showMore, setShowMore] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMore(false)
      }
    }
    if (showMore) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMore])

  const isMoreActive = moreLinks.some(l => pathname === l.href)

  return (
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
      <div ref={menuRef} className="flex-1 relative">
        <button
          onClick={() => setShowMore(v => !v)}
          className={cn(
            'w-full flex flex-col items-center gap-1 py-2 bg-transparent border-none cursor-pointer transition-colors duration-150 text-[10px]',
            isMoreActive ? 'text-[var(--accent-blue)]' : 'text-[var(--text-secondary)]'
          )}
        >
          <Menu size={18} />
          <span>עוד</span>
        </button>

        {showMore && (
          <div className="absolute bottom-[60px] inset-x-0 mx-2 bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-xl p-1.5 min-w-[160px] shadow-[0_-4px_20px_oklch(0_0_0/0.4)] z-50">
            {moreLinks.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  className={cn(
                    'flex items-center gap-2.5 py-2.5 px-3.5 rounded-lg no-underline text-[13px] transition-colors duration-150',
                    active
                      ? 'text-[var(--accent-blue)] bg-[var(--c-blue-0-22)] font-semibold'
                      : 'text-[var(--c-0-82)] bg-transparent font-normal'
                  )}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </nav>
  )
}
