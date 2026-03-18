'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, BarChart3, Receipt,
  Users, PiggyBank, Target, Home, TrendingUp, Link2, ListChecks, Mail, Copy, X, Send, Settings
} from 'lucide-react'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { toast } from 'sonner'

const nav = [
  { href: '/',          label: 'דשבורד',          icon: LayoutDashboard },
  { href: '/income',    label: 'הכנסה',            icon: Wallet },
  { href: '/budget',    label: 'תקציב מתוכנן',     icon: ListChecks },
  { href: '/expenses',  label: 'הוצאות',           icon: Receipt },
  { href: '/joint',     label: 'קופה משותפת',      icon: PiggyBank },
  { href: '/sinking',   label: 'קרנות צבירה',      icon: Target },
  { href: '/apartment', label: 'יעד הדירה',        icon: Home },
  { href: '/pension',   label: 'פנסיה',            icon: TrendingUp },
  { href: '/analytics', label: 'ניתוח שנתי',       icon: BarChart3 },
  { href: '/family',    label: 'הגדרות',           icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { family, isAdmin } = useFamilyContext()
  const [showInvite, setShowInvite] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)

  function copyInviteLink() {
    if (!family) return
    const url = `${window.location.origin}/login?invite=${family.invite_code}`
    navigator.clipboard.writeText(url)
    toast.success('לינק הזמנה הועתק!')
  }

  async function sendInviteEmail() {
    if (!family || !inviteEmail) return
    setSendingEmail(true)
    try {
      const res = await fetch('/api/family/invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, familyName: family.name, inviteCode: family.invite_code }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success(`הזמנה נשלחה ל-${inviteEmail}`)
      setInviteEmail('')
      setShowInvite(false)
    } catch {
      toast.error('שגיאה בשליחת ההזמנה')
    }
    setSendingEmail(false)
  }

  return (<>
    <aside style={{
      width: 'var(--sidebar-width)',
      position: 'fixed', top: 0, right: 0,
      height: '100vh',
      background: 'oklch(0.14 0.01 250)',
      borderLeft: '1px solid oklch(0.22 0.01 250)',
      zIndex: 40,
    }} className="hidden md:flex md:flex-col">
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid oklch(0.20 0.01 250)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'oklch(0.92 0.01 250)', letterSpacing: '-0.01em' }}>
          {family?.name || 'תקציב חכם'}
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
      <div style={{ padding: '12px 20px', borderTop: '1px solid oklch(0.20 0.01 250)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isAdmin && family && (
          <button
            onClick={() => setShowInvite(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'none', border: '1px solid oklch(0.25 0.01 250)',
              borderRadius: 6, padding: '6px 10px',
              color: 'oklch(0.60 0.18 250)', fontSize: 11, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Users size={12} />
            הזמן חבר משפחה
          </button>
        )}
        <div style={{ fontSize: 11, color: 'oklch(0.40 0.01 250)', lineHeight: 1.5 }}>
          מחזור: יום 11 – יום 10
        </div>
      </div>
    </aside>

    {/* Invite Modal */}
    {showInvite && (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          background: 'oklch(0.14 0.01 250)', borderRadius: 16, padding: 28,
          width: 400, border: '1px solid oklch(0.25 0.01 250)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 700 }}>הזמן חבר משפחה</h3>
            <button onClick={() => setShowInvite(false)} aria-label="סגור"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.55 0.01 250)', padding: 8 }}>
              <X size={18} />
            </button>
          </div>

          {/* Option 1: Copy Link */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link2 size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
              שתף לינק הזמנה
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family?.invite_code}`}
                style={{
                  flex: 1, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)',
                  borderRadius: 8, padding: '8px 12px', color: 'oklch(0.70 0.01 250)', fontSize: 12,
                  direction: 'ltr',
                }}
              />
              <button onClick={copyInviteLink} style={{
                background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)',
                borderRadius: 8, padding: '8px 12px', cursor: 'pointer', color: 'oklch(0.70 0.01 250)',
                display: 'flex', alignItems: 'center', gap: 4, fontSize: 12,
              }}>
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'oklch(0.25 0.01 250)' }} />
            <span style={{ fontSize: 11, color: 'oklch(0.45 0.01 250)' }}>או</span>
            <div style={{ flex: 1, height: 1, background: 'oklch(0.25 0.01 250)' }} />
          </div>

          {/* Option 2: Email Invite */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} style={{ color: 'oklch(0.70 0.18 145)' }} />
              שלח הזמנה במייל
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                style={{
                  flex: 1, background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)',
                  borderRadius: 8, padding: '8px 12px', color: 'inherit', fontSize: 13,
                  direction: 'ltr',
                }}
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                style={{
                  background: 'oklch(0.65 0.18 250)', border: 'none',
                  borderRadius: 8, padding: '8px 16px', cursor: sendingEmail ? 'wait' : 'pointer',
                  color: 'oklch(0.12 0.01 250)', fontWeight: 600, fontSize: 13,
                  display: 'flex', alignItems: 'center', gap: 4,
                  opacity: !inviteEmail || sendingEmail ? 0.5 : 1,
                }}
              >
                <Send size={13} /> שלח
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
  )
}
