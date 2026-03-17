'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, BarChart3, Receipt,
  Users, PiggyBank, Target, Home, TrendingUp
} from 'lucide-react'

const nav = [
  { href: '/',          label: 'דשבורד',          icon: LayoutDashboard },
  { href: '/income',    label: 'הכנסה',            icon: Wallet },
  { href: '/budget',    label: 'תקציב מתוכנן',     icon: BarChart3 },
  { href: '/expenses',  label: 'הוצאות אישיות',    icon: Receipt },
  { href: '/shared',    label: 'הוצאות משותפות',   icon: Users },
  { href: '/joint',     label: 'קופה משותפת',      icon: PiggyBank },
  { href: '/sinking',   label: 'קרנות צבירה',      icon: Target },
  { href: '/apartment', label: 'יעד הדירה',        icon: Home },
  { href: '/pension',   label: 'פנסיה',            icon: TrendingUp },
  { href: '/analytics', label: 'ניתוח שנתי',       icon: BarChart3 },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      position: 'fixed', top: 0, right: 0,
      height: '100vh',
      background: 'oklch(0.14 0.01 250)',
      borderLeft: '1px solid oklch(0.22 0.01 250)',
      display: 'flex', flexDirection: 'column',
      zIndex: 40,
    }} className="hidden md:flex">
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.92 0.01 250)', letterSpacing: '-0.01em' }}>
          תקציב חכם
        </div>
        <div style={{ fontSize: 11, color: 'oklch(0.50 0.01 250)', marginTop: 3, letterSpacing: '0.03em', textTransform: 'uppercase' }}>
          Family Finance
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 12px',
                borderRadius: 8,
                fontSize: 13, fontWeight: active ? 500 : 400,
                color: active ? 'oklch(0.92 0.01 250)' : 'oklch(0.55 0.01 250)',
                background: active ? 'oklch(0.20 0.01 250)' : 'transparent',
                textDecoration: 'none',
                transition: 'all 0.15s',
                borderRight: active ? '2px solid oklch(0.65 0.18 250)' : '2px solid transparent',
              }}
            >
              <Icon size={15} style={{ flexShrink: 0 }} />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid oklch(0.20 0.01 250)' }}>
        <div style={{ fontSize: 11, color: 'oklch(0.40 0.01 250)', lineHeight: 1.5 }}>
          מחזור: יום 11 – יום 10
        </div>
      </div>
    </aside>
  )
}
