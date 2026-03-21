import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/admin-server'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const limited = checkRateLimit(req, { maxRequests: 10, windowMs: 60_000, prefix: 'admin-block' })
  if (limited) return limited

  const { error } = await requireAdmin()
  if (error) return error

  const { id } = await params
  const { block } = await req.json() as { block: boolean }

  const sb = createServiceClient()

  if (block) {
    const { error: banError } = await sb.auth.admin.updateUserById(id, {
      ban_duration: '876000h', // ~100 years
    })
    if (banError) return NextResponse.json({ error: banError.message }, { status: 500 })
  } else {
    const { error: unbanError } = await sb.auth.admin.updateUserById(id, {
      ban_duration: 'none',
    })
    if (unbanError) return NextResponse.json({ error: unbanError.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
