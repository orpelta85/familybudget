import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getAuthUser() {
  const cookieStore = await cookies()
  const sb = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } }
  )
  const { data: { user } } = await sb.auth.getUser()
  return user
}
