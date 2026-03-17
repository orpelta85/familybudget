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
      <div style={{ width: 380, background: 'oklch(0.16 0.01 250)', border: '1px solid oklch(0.25 0.01 250)', borderRadius: 12, padding: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>איפוס סיסמה</h1>
        <p style={{ color: 'oklch(0.60 0.01 250)', fontSize: 14, marginBottom: 28 }}>הזן סיסמה חדשה</p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ fontSize: 13, display: 'block', marginBottom: 6, color: 'oklch(0.75 0.01 250)' }}>סיסמה חדשה</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={6}
              style={{ width: '100%', background: 'oklch(0.22 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: '10px 12px', color: 'inherit', fontSize: 14, direction: 'ltr' }}
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{ width: '100%', background: 'oklch(0.65 0.18 250)', color: 'oklch(0.12 0.01 250)', border: 'none', borderRadius: 8, padding: '11px 0', fontWeight: 600, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}
          >
            {loading ? '...' : 'עדכן סיסמה'}
          </button>
        </form>
      </div>
    </div>
  )
}
