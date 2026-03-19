'use client'

import { useState, useEffect, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Skeleton } from '@/components/ui/Skeleton'

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ marginRight: 0, maxWidth: '100vw' }}>
      <div style={{ width: 380, background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>My Family Finance</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginBottom: 28 }}>
          {inviteFamilyName
            ? `הצטרפות ל${inviteFamilyName}`
            : isSignup ? 'יצירת חשבון חדש' : 'התחברות לחשבון'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'oklch(0.75 0.01 250)' }}>אימייל</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 12px', color: 'inherit', fontSize: 14, direction: 'ltr' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'oklch(0.75 0.01 250)' }}>סיסמה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 12px', color: 'inherit', fontSize: 14, direction: 'ltr' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : isSignup ? 'הרשמה' : 'התחברות'}
          </button>
        </form>

        <button
          onClick={() => setIsSignup(!isSignup)}
          style={{ marginTop: 20, width: '100%', background: 'none', border: 'none', color: 'oklch(0.65 0.18 250)', cursor: 'pointer', fontSize: 13 }}
        >
          {isSignup ? 'יש לי כבר חשבון — התחברות' : 'אין לי חשבון — הרשמה'}
        </button>

        {!isSignup && (
          <button
            onClick={handleReset}
            disabled={loading || resetSent}
            style={{ marginTop: 10, width: '100%', background: 'none', border: 'none', color: 'oklch(0.65 0.01 250)', cursor: resetSent ? 'default' : 'pointer', fontSize: 12 }}
          >
            {resetSent ? '✓ מייל נשלח' : 'שכחתי סיסמה'}
          </button>
        )}
      </div>
    </div>
  )
}
