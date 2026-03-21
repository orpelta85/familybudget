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
    <div className="flex items-center gap-2 px-4 py-2.5 mb-4 rounded-xl bg-[oklch(0.20_0.06_290)] border border-[oklch(0.30_0.10_290)]">
      <Eye size={14} className="shrink-0 text-[oklch(0.75_0.18_290)]" />
      <span className="text-[12px] font-medium text-[oklch(0.80_0.01_250)] flex-1">
        צופה כ: <span className="text-[oklch(0.80_0.18_290)] font-bold">{familyName}</span>
        <span className="text-[oklch(0.55_0.01_250)] mr-2">({currentEmail})</span>
      </span>
      <button
        onClick={handleReturn}
        className="flex items-center gap-1.5 bg-[oklch(0.16_0.01_250)] border border-[oklch(0.28_0.04_290)] rounded-lg py-1.5 px-3 text-[11px] text-[oklch(0.80_0.14_290)] cursor-pointer hover:bg-[oklch(0.22_0.04_290)] transition-colors"
      >
        <ArrowRight size={12} />
        חזור לחשבון שלי
      </button>
    </div>
  )
}
