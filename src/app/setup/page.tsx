'use client'

import { useUser } from '@/lib/queries/useUser'
import { useHasSetup, useRunSetup } from '@/lib/queries/useSetup'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Loader } from 'lucide-react'

export default function SetupPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const { data: hasSetup, isLoading: checkingSetup } = useHasSetup(user?.id)
  const runSetup = useRunSetup()

  useEffect(() => {
    if (!loading && !user) router.push('/login')
  }, [user, loading, router])

  useEffect(() => {
    if (hasSetup) router.push('/')
  }, [hasSetup, router])

  if (loading || checkingSetup || hasSetup) return null

  async function handleSetup() {
    if (!user) return
    try {
      await runSetup.mutateAsync(user.id)
      toast.success('הגדרות אתחול הושלמו!')
      window.location.href = '/'
    } catch (e) {
      toast.error('שגיאה בהגדרה — נסה שוב')
      console.error(e)
    }
  }

  const items = [
    '21 קטגוריות תקציב (קבועות, משתנות, חיסכון)',
    '5 קרנות צבירה (חירום, חופשה, רכב, אלקטרוניקה, מתנות)',
    'פרופיל משתמש',
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-6 me-0">
      <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-[14px] p-8 max-w-[440px] w-full">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold mb-2">ברוך הבא ל-My Family Finance</h1>
          <p className="text-[oklch(0.60_0.01_250)] text-sm leading-relaxed">
            אתחל את החשבון שלך עם ברירות מחדל מוכנות. תוכל לשנות הכל אחר כך.
          </p>
        </div>

        <div className="mb-7 flex flex-col gap-2.5">
          {items.map(item => (
            <div key={item} className="flex items-center gap-2.5 text-sm text-[oklch(0.75_0.01_250)]">
              <CheckCircle size={15} className="text-[oklch(0.70_0.18_145)] shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={handleSetup}
          disabled={runSetup.isPending}
          className={`w-full bg-[oklch(0.65_0.18_250)] border-none rounded-[9px] py-[13px] font-semibold text-[15px] text-[oklch(0.10_0.01_250)] flex items-center justify-center gap-2 ${runSetup.isPending ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
        >
          {runSetup.isPending
            ? <><Loader size={16} className="animate-spin" /> מאתחל...</>
            : 'אתחל חשבון'
          }
        </button>
      </div>
    </div>
  )
}
