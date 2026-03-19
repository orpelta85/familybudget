'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Receipt, Users, Home, Menu, Wallet, BarChart3, PiggyBank, Heart, Target } from 'lucide-react'

const nav = [
  { href: '/',          label: 'דשבורד',  icon: LayoutDashboard },
  { href: '/expenses',  label: 'הוצאות',  icon: Receipt },
  { href: '/apartment', label: 'דירה',    icon: Home },
  { href: '/analytics', label: 'שנתי',    icon: BarChart3 },
]

const moreLinks = [
  { href: '/income',   label: 'הכנסות',       icon: Wallet },
  { href: '/budget',   label: 'תקציב',        icon: BarChart3 },
  { href: '/joint',    label: 'קופה משותפת',   icon: Users },
  { href: '/sinking',  label: 'קרנות צבירה',  icon: Target },
  { href: '/pension',  label: 'פנסיה',        icon: PiggyBank },
  { href: '/family',   label: 'משפחה',        icon: Heart },
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
    <nav className="flex md:hidden fixed bottom-0 right-0 left-0 h-[60px] bg-[oklch(0.14_0.01_250)] border-t border-[oklch(0.22_0.01_250)] items-center z-40">
      {nav.map(item => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 no-underline transition-colors duration-150 text-[10px]',
              active ? 'text-[oklch(0.65_0.18_250)]' : 'text-[oklch(0.65_0.01_250)]'
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
            isMoreActive ? 'text-[oklch(0.65_0.18_250)]' : 'text-[oklch(0.65_0.01_250)]'
          )}
        >
          <Menu size={18} />
          <span>עוד</span>
        </button>

        {showMore && (
          <div className="absolute bottom-[60px] left-1/2 -translate-x-1/2 bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-xl p-1.5 min-w-[160px] shadow-[0_-4px_20px_oklch(0_0_0/0.4)] z-50">
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
                      ? 'text-[oklch(0.65_0.18_250)] bg-[oklch(0.22_0.02_250)] font-semibold'
                      : 'text-[oklch(0.82_0.01_250)] bg-transparent font-normal'
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
