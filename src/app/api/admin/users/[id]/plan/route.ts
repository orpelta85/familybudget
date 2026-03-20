import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin-server'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { plan } = await req.json()

  if (!['free', 'premium', 'family', 'business'].includes(plan)) {
    return NextResponse.json({ error: 'invalid plan' }, { status: 400 })
  }

  const sb = createServiceClient()

  const { error: upsertError } = await sb
    .from('user_plans')
    .upsert({ user_id: id, plan, started_at: new Date().toISOString(), is_active: true }, { onConflict: 'user_id' })

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
