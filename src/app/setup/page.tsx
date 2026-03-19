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

  const card: React.CSSProperties = {
    background: 'oklch(0.16 0.01 250)',
    border: '1px solid oklch(0.25 0.01 250)',
    borderRadius: 14, padding: 32,
  }

  const items = [
    '21 קטגוריות תקציב (קבועות, משתנות, חיסכון)',
    '5 קרנות צבירה (חירום, חופשה, רכב, אלקטרוניקה, מתנות)',
    'פרופיל משתמש',
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, marginRight: 0 }}>
      <div style={{ ...card, maxWidth: 440, width: '100%' }}>
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>ברוך הבא ל-My Family Finance</h1>
          <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, lineHeight: 1.6 }}>
            אתחל את החשבון שלך עם ברירות מחדל מוכנות. תוכל לשנות הכל אחר כך.
          </p>
        </div>

        <div style={{ marginBottom: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map(item => (
            <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: 'oklch(0.75 0.01 250)' }}>
              <CheckCircle size={15} style={{ color: 'oklch(0.70 0.18 145)', flexShrink: 0 }} />
              {item}
            </div>
          ))}
        </div>

        <button
          onClick={handleSetup}
          disabled={runSetup.isPending}
          style={{
            width: '100%', background: 'oklch(0.65 0.18 250)', border: 'none',
            borderRadius: 9, padding: '13px 0', fontWeight: 600, fontSize: 15,
            color: 'oklch(0.10 0.01 250)', cursor: runSetup.isPending ? 'not-allowed' : 'pointer',
            opacity: runSetup.isPending ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {runSetup.isPending
            ? <><Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> מאתחל...</>
            : 'אתחל חשבון'
          }
        </button>
      </div>
    </div>
  )
}
