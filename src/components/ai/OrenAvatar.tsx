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
  const hiddenPages = ['/login', '/setup', '/reset-password', '/auth']
  const isHidden = hiddenPages.some(p => pathname.startsWith(p))

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
      {/* Floating avatar button */}
      <button
        onClick={() => setChatOpen(true)}
        className="fixed left-4 bottom-[76px] md:bottom-6 z-40 w-12 h-12 md:w-14 md:h-14 rounded-full bg-[var(--c-green-0-22)] border-2 border-[var(--c-green-0-35)] shadow-[0_4px_20px_oklch(0_0_0/0.4)] cursor-pointer flex items-center justify-center transition-transform duration-200 hover:scale-110 active:scale-95 overflow-hidden p-0"
        aria-label="פתח צ'אט עם אורן"
        style={unreadCount > 0 && !chatOpen ? { animation: 'orenBounce 2s ease-in-out infinite' } : {}}
      >
        <Image
          src="/mascot/oren-poses.png"
          alt="אורן"
          width={112}
          height={112}
          className="w-full h-full object-cover"
          style={{ objectPosition: '5% 15%' }}
          priority
        />

        {/* Unread badge */}
        {unreadCount > 0 && !chatOpen && (
          <span className="absolute top-[-4px] right-[-4px] w-5 h-5 rounded-full bg-[var(--c-red-0-55)] text-[var(--c-0-98)] text-[10px] font-bold flex items-center justify-center border-2 border-[var(--bg-base)]">
            {unreadCount}
          </span>
        )}
      </button>

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
