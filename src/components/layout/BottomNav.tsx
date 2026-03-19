'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
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
    <nav style={{
      position: 'fixed', bottom: 0, right: 0, left: 0, height: 60,
      background: 'oklch(0.14 0.01 250)',
      borderTop: '1px solid oklch(0.22 0.01 250)',
      alignItems: 'center',
      zIndex: 40,
    }} className="flex md:hidden">
      {nav.map(item => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', gap: 4, padding: '8px 0',
              textDecoration: 'none',
              color: active ? 'oklch(0.65 0.18 250)' : 'oklch(0.65 0.01 250)',
              transition: 'color 0.15s',
              fontSize: 10,
            }}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        )
      })}

      {/* More button */}
      <div ref={menuRef} style={{ flex: 1, position: 'relative' }}>
        <button
          onClick={() => setShowMore(v => !v)}
          style={{
            width: '100%', display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 4, padding: '8px 0',
            background: 'none', border: 'none', cursor: 'pointer',
            color: isMoreActive ? 'oklch(0.65 0.18 250)' : 'oklch(0.65 0.01 250)',
            transition: 'color 0.15s',
            fontSize: 10,
          }}
        >
          <Menu size={18} />
          <span>עוד</span>
        </button>

        {showMore && (
          <div style={{
            position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
            background: 'oklch(0.18 0.01 250)',
            border: '1px solid oklch(0.28 0.01 250)',
            borderRadius: 12,
            padding: 6,
            minWidth: 160,
            boxShadow: '0 -4px 20px oklch(0 0 0 / 0.4)',
            zIndex: 50,
          }}>
            {moreLinks.map(item => {
              const active = pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setShowMore(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    textDecoration: 'none',
                    color: active ? 'oklch(0.65 0.18 250)' : 'oklch(0.82 0.01 250)',
                    background: active ? 'oklch(0.22 0.02 250)' : 'transparent',
                    fontSize: 13, fontWeight: active ? 600 : 400,
                    transition: 'background 0.15s',
                  }}
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
