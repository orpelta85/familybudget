'use client'

import { Eye, ArrowRight } from 'lucide-react'
import { useImpersonation } from '@/lib/context/ImpersonationContext'
import { toast } from 'sonner'

export function ImpersonationBanner() {
  const { impersonation, stopImpersonation, isImpersonating } = useImpersonation()

  if (!isImpersonating || !impersonation) return null

  function handleReturn() {
    stopImpersonation()
    toast.success('חזרת לחשבון שלך')
    window.location.href = '/'
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-[var(--c-purple-0-20)] border border-[var(--c-purple-0-30)]">
      <Eye size={14} className="shrink-0 text-[var(--c-purple-0-75)]" />
      <span className="text-[12px] font-medium text-[var(--text-heading)] flex-1">
        צופה כ: <span className="text-[var(--c-purple-0-80)] font-bold">{impersonation.name}</span>
      </span>
      <button
        onClick={handleReturn}
        className="flex items-center gap-1.5 bg-[var(--bg-card)] border border-[var(--c-purple-0-28)] rounded-lg py-1.5 px-3 text-[11px] text-[var(--c-purple-0-80)] cursor-pointer hover:bg-[var(--c-purple-0-22)] transition-colors"
      >
        <ArrowRight size={12} />
        חזור לחשבון שלי
      </button>
    </div>
  )
}
