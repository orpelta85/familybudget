import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  const { invite_code, userId } = await req.json()
  if (!invite_code || !userId) {
    return NextResponse.json({ error: 'missing invite_code or userId' }, { status: 400 })
  }

  if (!authUser || authUser.id !== userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()

  // Find family by invite code
  const { data: family, error: famErr } = await sb
    .from('families')
    .select('id, name')
    .eq('invite_code', invite_code)
    .single()

  if (famErr || !family) {
    return NextResponse.json({ error: 'קוד הזמנה לא תקין' }, { status: 404 })
  }

  // Check if already a member
  const { data: existing } = await sb
    .from('family_members')
    .select('id')
    .eq('family_id', family.id)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, family_name: family.name, already_member: true })
  }

  // Join family
  const { error: joinErr } = await sb
    .from('family_members')
    .insert({ family_id: family.id, user_id: userId, role: 'member' })

  if (joinErr) {
    return NextResponse.json({ error: joinErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, family_name: family.name })
}

// Rate limit: max 5 lookups per IP per minute
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

// GET: lookup family name by invite code (for display on signup page)
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const now = Date.now()
  const entry = rateLimitMap.get(ip)

  if (entry && now < entry.resetAt) {
    if (entry.count >= 5) {
      return NextResponse.json({ error: 'too many requests' }, { status: 429 })
    }
    entry.count++
  } else {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 })
  }

  // Clean old entries every 100 requests
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }

  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'missing code' }, { status: 400 })

  const sb = createServiceClient()
  const { data: family } = await sb
    .from('families')
    .select('name')
    .eq('invite_code', code)
    .single()

  if (!family) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ family_name: family.name })
}
