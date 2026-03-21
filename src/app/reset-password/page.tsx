'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const sb = createClient()
    const { error } = await sb.auth.updateUser({ password })
    setLoading(false)
    if (error) { toast.error(error.message); return }
    toast.success('סיסמה עודכנה בהצלחה!')
    router.push('/')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ marginRight: 0, maxWidth: '100vw' }}>
      <div style={{ width: 380, background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>איפוס סיסמה</h1>
        <p style={{ color: 'var(--c-0-60)', fontSize: 14, marginBottom: 28 }}>הזן סיסמה חדשה</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'var(--text-body)' }}>סיסמה חדשה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', background: 'var(--bg-hover)', border: '1px solid var(--border-light)', borderRadius: 8, padding: '10px 12px', color: 'inherit', fontSize: 14, direction: 'ltr' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: 'var(--accent-blue)', color: 'var(--c-0-10)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'עדכן סיסמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
