import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export async function GET(req: NextRequest) {
  const authUser = await getAuthUser()
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasSetup: false })

  if (!authUser || authUser.id !== userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  try {
    const sb = createServiceClient()
    const { data, error } = await sb
      .from('budget_categories')
      .select('id')
      .eq('user_id', userId)
      .limit(1)

    if (error) {
      console.error('has-setup error:', error.message)
      return NextResponse.json({ hasSetup: false })
    }
    return NextResponse.json({ hasSetup: (data?.length ?? 0) > 0 })
  } catch (e) {
    console.error('has-setup exception:', e)
    return NextResponse.json({ hasSetup: false })
  }
}
