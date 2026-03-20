'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, BarChart3, Receipt,
  Users, PiggyBank, Target, TrendingUp, Link2, ListChecks, Mail, Copy, X, Send, Settings, CreditCard, Sparkles, CalendarDays, Calculator, Bell, Shield, Home, ShieldCheck
} from 'lucide-react'
import { isAdminEmail } from '@/lib/admin'
import { useAlerts, useUnreadAlertCount, useMarkAlertRead } from '@/lib/queries/useAlerts'
import { useUser } from '@/lib/queries/useUser'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { FamilyViewSelector } from '@/components/layout/FamilyViewSelector'
import { toast } from 'sonner'

const nav = [
  { href: '/',          label: 'דשבורד',          icon: LayoutDashboard },
  { href: '/income',    label: 'הכנסה',            icon: Wallet },
  { href: '/budget',    label: 'תקציב משפחתי',     icon: ListChecks },
  { href: '/expenses',  label: 'הוצאות',           icon: Receipt },
  { href: '/joint',     label: 'קופה קטנה',        icon: PiggyBank },
  { href: '/sinking',   label: 'קרנות צבירה',      icon: Target },
  { href: '/goals',     label: 'יעדים',             icon: Target },
  { href: '/kids',      label: 'ילדים',             icon: Users },
  { href: '/pension',   label: 'פנסיה',            icon: PiggyBank },
  { href: '/mortgage',        label: 'משכנתא',            icon: Home },
  { href: '/debts',           label: 'מחשבון חובות',     icon: Calculator },
  { href: '/net-worth',      label: 'שווי נקי',         icon: TrendingUp },
  { href: '/insurance',     label: 'ביטוחים',           icon: Shield },
  { href: '/subscriptions', label: 'מנויים',           icon: CreditCard },
  { href: '/forecast',      label: 'תחזית תזרים',     icon: CalendarDays },
  { href: '/advisor',       label: 'יועץ פיננסי',     icon: Sparkles },
  { href: '/analytics',     label: 'ניתוח שנתי',       icon: BarChart3 },
  { href: '/family',        label: 'הגדרות',           icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { family, isAdmin } = useFamilyContext()
  const { user } = useUser()
  const { data: alerts } = useAlerts(user?.id)
  const { data: unreadCount } = useUnreadAlertCount(user?.id)
  const markRead = useMarkAlertRead()
  const [showInvite, setShowInvite] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false)
      }
    }
    if (showAlerts) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAlerts])

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
    <aside className="hidden md:flex md:flex-col w-[var(--sidebar-width)] fixed top-0 right-0 h-screen bg-[oklch(0.14_0.01_250)] border-l border-[oklch(0.22_0.01_250)] z-40">
      {/* Logo + Bell */}
      <div className="px-5 pt-5 pb-4 border-b border-[oklch(0.20_0.01_250)]">
        <div className="flex items-center gap-2 mb-1.5">
          <img src="/favicon.svg" alt="" width={28} height={28} className="shrink-0" />
          <span className="text-[13px] font-semibold text-[oklch(0.85_0.01_250)] tracking-tight flex-1">
            My Family Finance
          </span>
          {/* Alert bell */}
          <div ref={alertRef} className="relative">
            <button
              onClick={() => setShowAlerts(v => !v)}
              aria-label="התראות"
              className="relative bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)] p-1.5 rounded-lg hover:bg-[oklch(0.20_0.01_250)] transition-colors"
            >
              <Bell size={16} />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 rounded-full bg-[oklch(0.62_0.22_27)] text-[10px] font-bold text-white flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
            {showAlerts && (
              <div className="absolute top-full left-0 mt-2 bg-[oklch(0.18_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-xl p-2 min-w-[280px] max-h-[360px] overflow-y-auto shadow-[0_4px_20px_oklch(0_0_0/0.5)] z-50">
                <div className="text-[11px] font-semibold text-[oklch(0.65_0.01_250)] px-2 py-1.5 mb-1">התראות</div>
                {!(alerts?.length) ? (
                  <div className="text-[12px] text-[oklch(0.50_0.01_250)] text-center py-4">אין התראות</div>
                ) : (
                  alerts.map(alert => {
                    const borderColor =
                      alert.severity === 'danger' ? 'border-r-[oklch(0.62_0.22_27)]'
                      : alert.severity === 'warning' ? 'border-r-[oklch(0.72_0.18_55)]'
                      : alert.severity === 'success' ? 'border-r-[oklch(0.70_0.18_145)]'
                      : 'border-r-[oklch(0.65_0.18_250)]'
                    return (
                      <div
                        key={alert.id}
                        className={`px-3 py-2.5 rounded-lg mb-1 border-r-2 ${borderColor} ${
                          alert.is_read ? 'opacity-50' : 'bg-[oklch(0.15_0.01_250)]'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-[12px] font-semibold">{alert.title}</div>
                            <div className="text-[11px] text-[oklch(0.65_0.01_250)] mt-0.5 leading-relaxed">{alert.message}</div>
                          </div>
                          {!alert.is_read && user && (
                            <button
                              onClick={() => markRead.mutate({ id: alert.id, user_id: user.id })}
                              aria-label="סמן כנקרא"
                              className="bg-transparent border-none cursor-pointer text-[oklch(0.50_0.01_250)] p-0.5 shrink-0"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </div>
        {family?.name && (
          <div className="text-[11px] text-[oklch(0.65_0.01_250)] tracking-wide">
            {family.name}
          </div>
        )}
      </div>

      {/* View Selector */}
      <FamilyViewSelector />

      {/* Nav */}
      <nav className="flex-1 p-2 px-2.5 overflow-y-auto flex flex-col gap-0.5">
        {nav.map(item => {
          const active = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] no-underline transition-all duration-150 border-r-2',
                active
                  ? 'font-medium text-[oklch(0.92_0.01_250)] bg-[oklch(0.20_0.01_250)] border-r-[oklch(0.65_0.18_250)]'
                  : 'font-normal text-[oklch(0.65_0.01_250)] bg-transparent border-r-transparent'
              )}
            >
              <Icon size={15} className="shrink-0" />
              <span>{item.label}</span>
            </Link>
          )
        })}
        {isAdminEmail(user?.email ?? undefined) && (
          <>
            <div className="h-px bg-[oklch(0.22_0.01_250)] my-2" />
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] no-underline transition-all duration-150 border-r-2',
                pathname === '/admin'
                  ? 'font-medium text-[oklch(0.85_0.16_290)] bg-[oklch(0.20_0.03_290)] border-r-[oklch(0.60_0.20_290)]'
                  : 'font-normal text-[oklch(0.60_0.12_290)] bg-transparent border-r-transparent'
              )}
            >
              <ShieldCheck size={15} className="shrink-0" />
              <span>ניהול</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[oklch(0.20_0.01_250)] flex flex-col gap-2">
        {isAdmin && family && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 bg-transparent border border-[oklch(0.25_0.01_250)] rounded-md px-2.5 py-1.5 text-[oklch(0.60_0.18_250)] text-[11px] font-medium cursor-pointer"
          >
            <Users size={12} />
            הזמן חבר משפחה
          </button>
        )}
        <div className="text-[11px] text-[oklch(0.65_0.01_250)] leading-normal">
          מחזור: יום 11 – יום 10
        </div>
      </div>
    </aside>

    {/* Invite Modal */}
    {showInvite && (
      <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center">
        <div className="bg-[oklch(0.14_0.01_250)] rounded-2xl p-7 w-[400px] border border-[oklch(0.25_0.01_250)]">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold">הזמן חבר משפחה</h3>
            <button onClick={() => setShowInvite(false)} aria-label="סגור"
              className="bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)] p-2">
              <X size={18} />
            </button>
          </div>

          {/* Option 1: Copy Link */}
          <div className="mb-5">
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Link2 size={14} className="text-[oklch(0.65_0.18_250)]" />
              שתף לינק הזמנה
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family?.invite_code}`}
                className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-[oklch(0.70_0.01_250)] text-xs"
                dir="ltr"
              />
              <button onClick={copyInviteLink}
                className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 cursor-pointer text-[oklch(0.70_0.01_250)] flex items-center gap-1 text-xs">
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[oklch(0.25_0.01_250)]" />
            <span className="text-[11px] text-[oklch(0.65_0.01_250)]">או</span>
            <div className="flex-1 h-px bg-[oklch(0.25_0.01_250)]" />
          </div>

          {/* Option 2: Email Invite */}
          <div>
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Mail size={14} className="text-[oklch(0.70_0.18_145)]" />
              שלח הזמנה במייל
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg py-2 px-3 text-inherit text-[13px]"
                dir="ltr"
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                className={cn(
                  'bg-[oklch(0.65_0.18_250)] border-none rounded-lg py-2 px-4 text-[oklch(0.12_0.01_250)] font-semibold text-[13px] flex items-center gap-1',
                  sendingEmail ? 'cursor-wait' : 'cursor-pointer',
                  (!inviteEmail || sendingEmail) ? 'opacity-50' : 'opacity-100'
                )}
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
