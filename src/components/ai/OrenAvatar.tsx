'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Image from 'next/image'
import { useUser } from '@/lib/queries/useUser'
import { useSharedPeriod } from '@/lib/context/PeriodContext'
import { generateTips } from '@/lib/ai/oren-tips'
import { fetchTipData, buildFinancialContext } from '@/lib/ai/financial-context'
import type { OrenTip } from '@/lib/ai/oren-tips'
import { OrenChat } from './OrenChat'
import { usePathname } from 'next/navigation'

const MAX_TIPS_PER_SESSION = 3
const SEEN_TIPS_KEY = 'oren_seen_tips'

export function OrenAvatar() {
  const { user } = useUser()
  const { selectedPeriodId } = useSharedPeriod()
  const pathname = usePathname()

  const [chatOpen, setChatOpen] = useState(false)
  const [tips, setTips] = useState<OrenTip[]>([])
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = JSON.parse(localStorage.getItem(SEEN_TIPS_KEY) ?? '[]')
      return new Set(stored)
    } catch {
      return new Set()
    }
  })
  const [financialContext, setFinancialContext] = useState('')
  const [hasFetched, setHasFetched] = useState(false)

  // Skip on login/setup pages
  const hiddenPages = ['/login', '/setup', '/onboarding', '/reset-password', '/auth']
  const isHidden = hiddenPages.some(p => pathname.startsWith(p))

  // Pages with bottom CTA buttons - minimize avatar to avoid overlap
  const ctaPages = ['/income', '/debts', '/forecast']
  const hasBottomCTA = ctaPages.some(p => pathname === p)

  // Fetch tip data when user/period changes
  useEffect(() => {
    if (!user?.id || !selectedPeriodId || isHidden) return

    let cancelled = false

    async function load() {
      try {
        const [tipData, ctx] = await Promise.all([
          fetchTipData(user!.id, selectedPeriodId!),
          buildFinancialContext(user!.id, selectedPeriodId!),
        ])

        if (cancelled) return

        const generated = generateTips(tipData)
        // Limit to MAX_TIPS_PER_SESSION, excluding already-seen
        const newTips = generated.slice(0, MAX_TIPS_PER_SESSION).map(t => ({
          ...t,
          seen: seenIds.has(t.id),
        }))

        setTips(newTips)
        setFinancialContext(ctx)
        setHasFetched(true)
      } catch (err) {
        console.error('Oren tips fetch error:', err)
      }
    }

    load()
    return () => { cancelled = true }
    // Intentionally not depending on seenIds to avoid refetch loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, selectedPeriodId, isHidden])

  const handleTipSeen = useCallback((id: string) => {
    setSeenIds(prev => {
      const next = new Set(prev)
      next.add(id)
      try { localStorage.setItem(SEEN_TIPS_KEY, JSON.stringify([...next])) } catch {}
      return next
    })
    setTips(prev => prev.map(t => t.id === id ? { ...t, seen: true } : t))
  }, [])

  const unreadCount = useMemo(() => tips.filter(t => !t.seen).length, [tips])

  if (isHidden || !user) return null

  return (
    <>
      {/* Floating Oren character */}
      <div className={`fixed left-4 bottom-[76px] md:bottom-6 z-30 flex flex-col items-center gap-0 max-[430px]:bottom-[68px] max-[430px]:left-2 max-[430px]:origin-bottom-left transition-all duration-300 ${hasBottomCTA ? 'max-md:scale-[0.65] max-md:opacity-60 max-md:bottom-[100px]' : 'max-[430px]:scale-90'}`}>
        {/* AI badge above character */}
        <div className="flex items-center gap-1 bg-[var(--c-green-0-30)] text-[var(--c-green-0-85)] text-[9px] font-bold tracking-wider px-2 py-0.5 rounded-full mb-[-6px] z-10 border border-[var(--c-green-0-40)]">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          AI יועץ
        </div>
        {/* Character button */}
        <button
          onClick={() => setChatOpen(true)}
          className="relative w-14 h-16 md:w-16 md:h-[72px] bg-transparent border-none cursor-pointer p-0 transition-transform duration-200 hover:scale-110 active:scale-95"
          aria-label="פתח צ'אט עם אורן — היועץ הפיננסי"
          style={unreadCount > 0 && !chatOpen ? { animation: 'orenBounce 2s ease-in-out infinite' } : {}}
        >
          <Image
            src="/mascot/oren-poses.png"
            alt="אורן — היועץ הפיננסי"
            width={128}
            height={144}
            className="w-full h-full object-cover rounded-2xl"
            style={{ objectPosition: '5% 5%', filter: 'drop-shadow(0 4px 12px oklch(0 0 0 / 0.5))' }}
            priority
          />

          {/* Unread badge */}
          {unreadCount > 0 && !chatOpen && (
            <span className="absolute top-[-6px] right-[-6px] w-5 h-5 rounded-full bg-[var(--c-red-0-55)] text-[var(--c-0-98)] text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-base)]">
              {unreadCount}
            </span>
          )}
        </button>
        {/* Name label */}
        <div className="text-[9px] font-semibold text-[var(--c-green-0-75)] mt-[-2px] tracking-wide">אורן</div>
      </div>

      {/* Chat panel */}
      <OrenChat
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        tips={tips}
        onTipSeen={handleTipSeen}
        financialContext={financialContext}
      />
    </>
  )
}
