'use client'

import { useUser } from '@/lib/queries/useUser'
import { useHasSetup, useRunSetup } from '@/lib/queries/useSetup'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, Suspense } from 'react'
import { toast } from 'sonner'
import { CheckCircle, Loader } from 'lucide-react'

export default function SetupPage() {
  return <Suspense fallback={null}><SetupForm /></Suspense>
}

function SetupForm() {
  const { user, loading } = useUser()
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite') || ''
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
      await runSetup.mutateAsync({ userId: user.id, inviteCode })
      toast.success(inviteCode ? 'הצטרפת למשפחה!' : 'הגדרות אתחול הושלמו!')
      window.location.href = '/'
    } catch (e) {
      toast.error('שגיאה בהגדרה — נסה שוב')
      console.error(e)
    }
  }

  const items = [
    '15 קטגוריות תקציב (קבועות, משתנות, חיסכון)',
    '5 קרנות צבירה (חירום, חופשה, רכב, אלקטרוניקה, מתנות)',
    'פרופיל משתמש',
  ]

  return (
    <div className="min-h-screen flex items-center justify-center p-6 ml-0">
      <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-[14px] p-8 max-w-[440px] w-full">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold mb-2">ברוך הבא ל-Family Plan</h1>
          <p className="text-[var(--c-0-60)] text-sm leading-relaxed">
            אתחל את החשבון שלך עם ברירות מחדל מוכנות. תוכל לשנות הכל אחר כך.
          </p>
        </div>

        <div className="mb-7 flex flex-col gap-2.5">
          {items.map(item => (
            <div key={item} className="flex items-center gap-2.5 text-sm text-[var(--text-body)]">
              <CheckCircle size={15} className="text-[var(--accent-green)] shrink-0" />
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={handleSetup}
          disabled={runSetup.isPending}
          className={`w-full bg-[var(--accent-blue)] border-none rounded-[9px] py-[13px] font-semibold text-[15px] text-[var(--c-0-10)] flex items-center justify-center gap-2 ${runSetup.isPending ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
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
