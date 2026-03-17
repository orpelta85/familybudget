'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Receipt, Users, Home, BarChart3 } from 'lucide-react'

const nav = [
  { href: '/',          label: 'דשבורד',  icon: LayoutDashboard },
  { href: '/expenses',  label: 'הוצאות',  icon: Receipt },
  { href: '/shared',    label: 'משותף',   icon: Users },
  { href: '/apartment', label: 'דירה',    icon: Home },
  { href: '/analytics', label: 'שנתי',    icon: BarChart3 },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav style={{
      position: 'fixed', bottom: 0, right: 0, left: 0, height: 60,
      background: 'oklch(0.14 0.01 250)',
      borderTop: '1px solid oklch(0.22 0.01 250)',
      display: 'flex', alignItems: 'center',
      zIndex: 40,
    }} className="md:hidden">
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
              color: active ? 'oklch(0.65 0.18 250)' : 'oklch(0.50 0.01 250)',
              transition: 'color 0.15s',
              fontSize: 10,
            }}
          >
            <Icon size={18} />
            <span>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
