import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/supabase/auth'
import { ADMIN_EMAIL } from '@/lib/constants'

/**
 * Gets the effective user ID for API routes.
 * If the caller is admin and passes ?impersonate_user_id=xxx, returns the impersonated ID.
 * Otherwise returns the authenticated user's ID.
 */
export async function getEffectiveUserId(req: NextRequest): Promise<{ userId: string; authUser: { id: string; email?: string } } | null> {
  const authUser = await getAuthUser()
  if (!authUser) return null

  const impersonateUserId = req.nextUrl.searchParams.get('impersonate_user_id')

  if (impersonateUserId && authUser.email === ADMIN_EMAIL) {
    return { userId: impersonateUserId, authUser }
  }

  return { userId: authUser.id, authUser }
}
