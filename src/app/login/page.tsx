'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/Skeleton'
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton variant="card" width={360} height={320} />
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [inviteFamilyName, setInviteFamilyName] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')

  // Store invite code and fetch family name
  useEffect(() => {
    if (inviteCode) {
      localStorage.setItem('familyInvite', inviteCode)
      setIsSignup(true)
      fetch(`/api/family/join?code=${inviteCode}`)
        .then(r => r.json())
        .then(d => { if (d.family_name) setInviteFamilyName(d.family_name) })
        .catch(() => {})
    }
  }, [inviteCode])

  async function handleReset() {
    if (!email) { toast.error('הזן אימייל קודם'); return }
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`
    })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    setResetSent(true)
    toast.success('נשלח מייל לאיפוס סיסמה — בדוק את תיבת הדואר')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()

    if (isSignup) {
      if (password.length < 8) {
        toast.error('הסיסמה חייבת להכיל לפחות 8 תווים')
        setLoading(false)
        return
      }
      if (!/\d/.test(password)) {
        toast.error('הסיסמה חייבת להכיל לפחות ספרה אחת')
        setLoading(false)
        return
      }
      const invite = inviteCode || localStorage.getItem('familyInvite') || ''
      const setupUrl = invite ? `/setup?invite=${invite}` : '/setup'
      const { error } = await sb.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${setupUrl}` }
      })
      if (error) { toast.error(error.message); setLoading(false); return }
      toast.success('נרשמת! בדוק את המייל לאימות ולחץ על הקישור.')
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) { toast.error('שם משתמש או סיסמה שגויים'); setLoading(false); return }
      toast.success('ברוך הבא!')
      router.push('/')
      router.refresh()
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 ml-0 max-w-[100vw]">
      <div className="w-full max-w-[380px] bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-8">
        <div className="flex flex-col items-center mb-6">
          <img src="/logo-familyplan.png?v=3" alt="Family Plan" className="logo-dark" style={{ width: 180, height: 'auto' }} />
          <img src="/logo-familyplan-light.png?v=3" alt="Family Plan" className="logo-light" style={{ width: 180, height: 'auto' }} />
          <div className="text-[13px] text-[var(--text-muted)] mt-1.5 tracking-wide">סדר בבית, שקט בכיס.</div>
        </div>
        <p className="text-[var(--c-0-60)] text-sm mb-7 text-center">
          {inviteFamilyName
            ? `הצטרפות ל${inviteFamilyName}`
            : isSignup ? 'יצירת חשבון חדש' : 'התחברות לחשבון'}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-[13px] block mb-1.5 text-[var(--text-body)]">אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm ltr"
            />
          </div>
          <div>
            <label className="text-[13px] block mb-1.5 text-[var(--text-body)]">סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="w-full bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2.5 text-inherit text-sm ltr"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full bg-[var(--accent-blue)] text-[var(--c-0-10)] border-none rounded-lg py-[11px] font-semibold text-[15px] ${loading ? 'cursor-not-allowed opacity-70' : 'cursor-pointer opacity-100'}`}
          >
            {loading ? '...' : isSignup ? 'הרשמה' : 'התחברות'}
          </button>
        </form>

        <button
          onClick={() => setIsSignup(!isSignup)}
          className="mt-5 w-full bg-transparent border-none text-[var(--accent-blue)] cursor-pointer text-[13px]"
        >
          {isSignup ? 'יש לי כבר חשבון — התחברות' : 'אין לי חשבון — הרשמה'}
        </button>

        {!isSignup && (
          <button
            onClick={handleReset}
            disabled={loading || resetSent}
            className={`mt-2.5 w-full bg-transparent border-none text-[var(--text-secondary)] text-xs ${resetSent ? 'cursor-default' : 'cursor-pointer'}`}
          >
            {resetSent ? '✓ מייל נשלח' : 'שכחתי סיסמה'}
          </button>
        )}
      </div>
    </div>
  )
}
