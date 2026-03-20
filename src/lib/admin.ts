import { getAuthUser } from '@/lib/supabase/auth'
import { NextResponse } from 'next/server'

const ADMIN_EMAIL = 'orpelta85@gmail.com'

export async function requireAdmin() {
  const user = await getAuthUser()
  if (!user || user.email !== ADMIN_EMAIL) {
    return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }), user: null }
  }
  return { error: null, user }
}

export function isAdminEmail(email: string | undefined): boolean {
  return email === ADMIN_EMAIL
}
