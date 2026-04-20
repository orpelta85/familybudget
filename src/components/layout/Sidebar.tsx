'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Wallet, BarChart3, Receipt,
  Users, Banknote, Crosshair, TrendingUp, Link2, ListChecks, Mail, Copy, X, Send, Settings, CreditCard, Sparkles, CalendarDays, Calculator, Bell, Shield, Home, ShieldCheck,
  Archive, Baby, Landmark
} from 'lucide-react'
import { isAdminEmail } from '@/lib/admin'
import { useAlerts, useUnreadAlertCount, useMarkAlertRead } from '@/lib/queries/useAlerts'
import { useUser } from '@/lib/queries/useUser'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { FamilyViewSelector } from '@/components/layout/FamilyViewSelector'
import { toast } from 'sonner'

type NavLink = { href: string; label: string; icon: typeof LayoutDashboard }
type NavSection = { sectionLabel: string; items: NavLink[] }

const navSections: NavSection[] = [
  {
    sectionLabel: 'פעילות שוטפת',
    items: [
      { href: '/',          label: 'דשבורד',          icon: LayoutDashboard },
      { href: '/income',    label: 'הכנסות',           icon: Wallet },
      { href: '/expenses',  label: 'הוצאות',           icon: Receipt },
      { href: '/budget',    label: 'תקציב',              icon: ListChecks },
      { href: '/joint',     label: 'קופה קטנה',        icon: Banknote },
      { href: '/kids',      label: 'ילדים',             icon: Baby },
    ],
  },
  {
    sectionLabel: 'חיסכון ויעדים',
    items: [
      { href: '/sinking',   label: 'קרנות צבירה',      icon: Archive },
      { href: '/goals',     label: 'יעדים',             icon: Crosshair },
      { href: '/pension',   label: 'פנסיה',             icon: Landmark },
    ],
  },
  {
    sectionLabel: 'נכסים והתחייבויות',
    items: [
      { href: '/net-worth', label: 'שווי נקי',         icon: TrendingUp },
      { href: '/mortgage',  label: 'משכנתא',            icon: Home },
      { href: '/debts',     label: 'מחשבון חובות',     icon: Calculator },
      { href: '/insurance', label: 'ביטוחים',           icon: Shield },
      { href: '/subscriptions', label: 'מנויים',        icon: CreditCard },
    ],
  },
  {
    sectionLabel: 'תכנון וניתוח',
    items: [
      { href: '/forecast',      label: 'תחזית תזרים',     icon: CalendarDays },
      { href: '/advisor',       label: 'טיפים פיננסיים',  icon: Sparkles },
      { href: '/analytics',     label: 'ניתוח שנתי',       icon: BarChart3 },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { family, isAdmin, isSolo } = useFamilyContext()
  const { user } = useUser()
  const { data: alerts } = useAlerts(user?.id)
  const { data: unreadCount } = useUnreadAlertCount(user?.id)
  const markRead = useMarkAlertRead()
  const [showInvite, setShowInvite] = useState(false)
  const [showAlerts, setShowAlerts] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const alertRef = useRef<HTMLDivElement>(null)

  const hiddenPages = ['/login', '/setup', '/onboarding', '/reset-password', '/auth']
  const isHidden = hiddenPages.some(p => pathname.startsWith(p))

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (alertRef.current && !alertRef.current.contains(e.target as Node)) {
        setShowAlerts(false)
      }
    }
    if (showAlerts) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showAlerts])

  if (isHidden) return null

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
    } catch (e) {
      console.error('Send invite email:', e)
      toast.error('שגיאה בשליחת ההזמנה')
    }
    setSendingEmail(false)
  }

  return (<>
    <aside className="hidden md:flex md:flex-col w-[var(--sidebar-width)] fixed top-0 right-0 h-screen bg-[var(--c-0-14)] border-l border-[var(--bg-hover)] z-40">
      {/* Logo */}
      <div className="px-5 pt-5 pb-4 border-b border-[var(--c-0-20)]">
        <div className="mb-1.5 flex flex-col items-center">
          <img src="/logo-familyplan.png?v=4" alt="Family Plan" width={180} height={180} className="w-[180px] h-[180px] object-contain logo-dark" />
          <img src="/logo-familyplan-light.png?v=4" alt="Family Plan" width={180} height={167} className="w-[180px] h-auto object-contain logo-light" style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.10)) contrast(1.1) saturate(1.15)' }} />
        </div>
        {/* Family name + Bell */}
        <div className="flex items-center justify-between min-h-[24px]">
          <div className="text-[11px] text-[var(--text-secondary)] tracking-wide">
            {family?.name ?? '\u00A0'}
          </div>
          <div ref={alertRef} className="relative">
            <button
              onClick={() => setShowAlerts(v => !v)}
              aria-label="התראות"
              className="relative bg-transparent border-none cursor-pointer text-[var(--text-secondary)] p-1.5 rounded-lg hover:bg-[var(--c-0-20)] transition-colors"
            >
              <Bell size={16} />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute -top-0.5 -left-0.5 min-w-[16px] h-4 rounded-full bg-[var(--accent-red)] text-[10px] font-bold text-white flex items-center justify-center px-1">
                  {unreadCount}
                </span>
              )}
            </button>
            {showAlerts && (
              <div className="absolute top-full inset-inline-start-0 mt-2 bg-[var(--c-0-18)] border border-[var(--border-light)] rounded-xl p-2 min-w-[280px] max-h-[360px] overflow-y-auto shadow-[0_4px_20px_oklch(0_0_0/0.5)] z-50">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] px-2 py-1.5 mb-1">התראות</div>
                {!(alerts?.length) ? (
                  <div className="text-[12px] text-[var(--c-0-50)] text-center py-4">אין התראות</div>
                ) : (
                  alerts.map(alert => {
                    const borderColor =
                      alert.severity === 'danger' ? 'border-r-[var(--accent-red)]'
                      : alert.severity === 'warning' ? 'border-r-[var(--accent-orange)]'
                      : alert.severity === 'success' ? 'border-r-[var(--accent-green)]'
                      : 'border-r-[var(--accent-green)]'
                    return (
                      <div
                        key={alert.id}
                        className={`px-3 py-2.5 rounded-lg mb-1 border-r-2 ${borderColor} ${
                          alert.is_read ? 'opacity-50' : 'bg-[var(--c-0-15)]'
                        }`}
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="text-[12px] font-semibold">{alert.title}</div>
                            <div className="text-[11px] text-[var(--text-secondary)] mt-0.5 leading-relaxed">{alert.message}</div>
                          </div>
                          {!alert.is_read && user && (
                            <button
                              onClick={() => markRead.mutate({ id: alert.id, user_id: user.id })}
                              aria-label="סמן כנקרא"
                              className="bg-transparent border-none cursor-pointer text-[var(--c-0-50)] p-0.5 shrink-0"
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
      </div>

      {/* View Selector */}
      <FamilyViewSelector />

      {/* Nav */}
      <nav className="flex-1 p-2 px-2.5 overflow-y-auto flex flex-col">
        {navSections.map((section, si) => {
          // Hide family-only pages in solo mode
          const soloHidden = ['/joint']
          const items = isSolo ? section.items.filter(l => !soloHidden.includes(l.href)) : section.items
          if (items.length === 0) return null
          return (
            <div key={section.sectionLabel}>
              <div
                className={cn(
                  'text-[10px] uppercase tracking-[0.05em] text-[var(--text-muted)] font-medium px-3 pb-2 select-none',
                  si === 0 ? 'pt-2' : 'pt-5'
                )}
              >
                {section.sectionLabel}
              </div>
              <div className="flex flex-col gap-0.5">
                {items.map(link => {
                  const active = pathname === link.href
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        'flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] no-underline transition-all duration-150 border-r-2 font-medium',
                        active
                          ? 'text-[var(--c-0-92)] bg-[var(--c-0-22)] border-r-[var(--accent-green)] border-r-[3px]'
                          : 'text-[var(--text-secondary)] bg-transparent border-r-transparent'
                      )}
                    >
                      <Icon size={15} className="shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
        <div className="h-px bg-[var(--bg-hover)] my-2" />
        <Link
          href="/family"
          className={cn(
            'flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] no-underline transition-all duration-150 border-r-2 font-medium',
            pathname === '/family'
              ? 'text-[var(--c-0-92)] bg-[var(--c-0-22)] border-r-[var(--accent-green)] border-r-[3px]'
              : 'text-[var(--text-secondary)] bg-transparent border-r-transparent'
          )}
        >
          <Settings size={15} className="shrink-0" />
          <span>הגדרות</span>
        </Link>
        {isAdminEmail(user?.email ?? undefined) && (
          <>
            <div className="h-px bg-[var(--bg-hover)] my-2" />
            <Link
              href="/admin"
              className={cn(
                'flex items-center gap-2.5 py-2 px-3 rounded-lg text-[13px] no-underline transition-all duration-150 border-r-2 font-medium',
                pathname === '/admin'
                  ? 'text-[var(--c-purple-0-85)] bg-[var(--c-purple-0-20)] border-r-[var(--c-purple-0-60)] border-r-[3px]'
                  : 'text-[var(--c-purple-0-60)] bg-transparent border-r-transparent'
              )}
            >
              <ShieldCheck size={15} className="shrink-0" />
              <span>ניהול</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-[var(--c-0-20)] flex flex-col gap-2">
        {isAdmin && family && !isSolo && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 bg-transparent border border-[var(--border-default)] rounded-md px-2.5 py-1.5 text-[var(--c-blue-0-60)] text-[11px] font-medium cursor-pointer"
          >
            <Users size={12} />
            הזמן חבר משפחה
          </button>
        )}
        {isSolo && isAdmin && family && (
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-1.5 bg-transparent border border-dashed border-[var(--c-blue-0-40)] rounded-md px-2.5 py-1.5 text-[var(--c-blue-0-60)] text-[11px] font-medium cursor-pointer"
          >
            <Users size={12} />
            הזמן בן/בת זוג
          </button>
        )}
        <div className="text-[11px] text-[var(--text-secondary)] leading-normal">
          מחזור: יום 11 – יום 10
        </div>
      </div>
    </aside>

    {/* Invite Modal */}
    {showInvite && (
      <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
        <div className="bg-[var(--c-0-14)] rounded-2xl p-7 w-full max-w-[400px] border border-[var(--border-default)]">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-base font-bold">הזמן חבר משפחה</h3>
            <button onClick={() => setShowInvite(false)} aria-label="סגור"
              className="bg-transparent border-none cursor-pointer text-[var(--text-secondary)] p-2">
              <X size={18} />
            </button>
          </div>

          {/* Option 1: Copy Link */}
          <div className="mb-5">
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Link2 size={14} className="text-[var(--accent-blue)]" />
              שתף לינק הזמנה
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family?.invite_code}`}
                className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg py-2 px-3 text-[var(--c-0-70)] text-xs"
                dir="ltr"
              />
              <button onClick={copyInviteLink}
                className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg py-2 px-3 cursor-pointer text-[var(--c-0-70)] flex items-center gap-1 text-xs">
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-[11px] text-[var(--text-secondary)]">או</span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          {/* Option 2: Email Invite */}
          <div>
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Mail size={14} className="text-[var(--accent-green)]" />
              שלח הזמנה במייל
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg py-2 px-3 text-inherit text-[13px]"
                dir="ltr"
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                className={cn(
                  'bg-[var(--accent-blue)] border-none rounded-lg py-2 px-4 text-[var(--c-0-10)] font-semibold text-[13px] flex items-center gap-1',
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
