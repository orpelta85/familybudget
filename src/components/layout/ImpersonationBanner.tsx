'use client'

import { useState, useEffect } from 'react'
import { Eye, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/queries/useUser'
import { toast } from 'sonner'

const ADMIN_EMAIL = 'orpelta85@gmail.com'

const TEST_EMAILS: Record<string, string> = {
  'avi.cohen@test.com': 'משפחת כהן',
  'michal.cohen@test.com': 'משפחת כהן',
  'dani.levi@test.com': 'משפחת לוי',
  'ronit.levi@test.com': 'משפחת לוי',
  'amit.zahavi@test.com': 'עמית זהבי',
  'moshe.rachamim@test.com': 'משפחת רחמים',
  'orly.rachamim@test.com': 'משפחת רחמים',
  'yonatan.biton@test.com': 'משפחת ביטון',
  'shirly.biton@test.com': 'משפחת ביטון',
  'gilad.sharon@test.com': 'משפחת שרון',
  'anat.sharon@test.com': 'משפחת שרון',
  'yaakov.adler@test.com': 'משפחת אדלר',
  'rachel.adler@test.com': 'משפחת אדלר',
}

export function ImpersonationBanner() {
  const { user } = useUser()
  const [adminEmail, setAdminEmail] = useState<string | null>(null)

  useEffect(() => {
    setAdminEmail(localStorage.getItem('admin_original_email'))
  }, [])

  const currentEmail = user?.email
  if (!currentEmail) return null

  const familyName = TEST_EMAILS[currentEmail]
  if (!familyName || !adminEmail) return null

  async function handleReturn() {
    const sb = createClient()
    if (!adminEmail) return

    // Sign in back as admin
    // We need to know the admin's password - but we don't store it
    // Instead, just sign out and redirect to login
    await sb.auth.signOut()
    localStorage.removeItem('admin_original_email')
    toast.success('חזרת לחשבון שלך — יש להתחבר מחדש')
    window.location.href = '/login'
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-[var(--c-purple-0-20)] border border-[var(--c-purple-0-30)]">
      <Eye size={14} className="shrink-0 text-[var(--c-purple-0-75)]" />
      <span className="text-[12px] font-medium text-[var(--text-heading)] flex-1">
        צופה כ: <span className="text-[var(--c-purple-0-80)] font-bold">{familyName}</span>
        <span className="text-[var(--text-muted)] mr-2">({currentEmail})</span>
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
