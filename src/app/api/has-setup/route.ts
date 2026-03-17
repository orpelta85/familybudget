import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasSetup: false })

  const sb = createServiceClient()
  const { data } = await sb
    .from('budget_categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  return NextResponse.json({ hasSetup: (data?.length ?? 0) > 0 })
}
