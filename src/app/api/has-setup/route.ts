import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) return NextResponse.json({ hasSetup: false })

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
