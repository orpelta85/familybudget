import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { email, familyName, inviteCode } = await req.json()
  if (!email || !inviteCode) {
    return NextResponse.json({ error: 'missing email or inviteCode' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Verify the invite code belongs to the caller's family
  const { data: family } = await sb
    .from('families')
    .select('id, created_by')
    .eq('invite_code', inviteCode)
    .single()

  if (!family || family.created_by !== authUser.id) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  }

  // Send invite email via Supabase Auth (invites the user to sign up)
  const origin = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/+$/, '') || ''
  const redirectUrl = `${origin}/auth/callback?next=/setup?invite=${inviteCode}`

  try {
    const { error } = await sb.auth.admin.inviteUserByEmail(email, {
      redirectTo: redirectUrl,
      data: {
        invited_to_family: familyName,
        invite_code: inviteCode,
      },
    })

    if (error) {
      // If user already exists, just send them the link info
      if (error.message.includes('already') || error.message.includes('registered')) {
        return NextResponse.json({
          ok: true,
          note: 'המשתמש כבר רשום — שלח לו את הלינק ישירות',
        })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  } catch (err) {
    console.error('Invite email error:', err)
    const msg = err instanceof Error ? err.message : 'unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
