import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getEffectiveUserId } from '@/lib/impersonate-server'

interface ResetBody {
  period_id: number
  reset_target: 'personal' | 'shared' | 'both'
  personal_scope: 'me' | 'partner' | 'both'
  date_from: string
  date_to: string
  family_id?: string | null
  target_user_ids?: string[]
}

export async function POST(req: NextRequest) {
  const effective = await getEffectiveUserId(req)
  if (!effective) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: ResetBody
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }

  const { period_id, reset_target, personal_scope, date_from, date_to, family_id } = body
  if (!period_id || !reset_target || !date_from || !date_to) {
    return NextResponse.json({ error: 'missing params' }, { status: 400 })
  }

  const sb = createServiceClient()

  // Verify caller's family membership
  const { data: membership } = await sb
    .from('family_members')
    .select('family_id')
    .eq('user_id', effective.userId)
    .limit(1)
    .maybeSingle()

  let deletedPersonal = 0
  let deletedShared = 0

  // ── Personal expenses ──────────────────────────────────────────────────────
  if (reset_target === 'personal' || reset_target === 'both') {
    // Resolve which user_ids' personal expenses to delete
    let targetIds: string[] = []
    if (personal_scope === 'me') {
      targetIds = [effective.userId]
    } else {
      // partner / both — pull all family members and validate
      if (!membership) {
        return NextResponse.json({ error: 'no family found' }, { status: 404 })
      }
      const { data: familyMembers } = await sb
        .from('family_members')
        .select('user_id')
        .eq('family_id', membership.family_id)
      const validIds = (familyMembers ?? []).map(m => m.user_id)
      if (personal_scope === 'both') {
        targetIds = validIds
      } else {
        // partner — everyone except the caller
        targetIds = validIds.filter(id => id !== effective.userId)
      }
      // Defence: ensure every requested id belongs to the caller's family
      const requested = body.target_user_ids ?? []
      const invalid = requested.filter(id => !validIds.includes(id))
      if (invalid.length > 0) {
        return NextResponse.json({ error: 'unauthorized member_ids' }, { status: 403 })
      }
    }

    if (targetIds.length > 0) {
      const { data: deleted, error } = await sb
        .from('personal_expenses')
        .delete()
        .eq('period_id', period_id)
        .in('user_id', targetIds)
        .gte('expense_date', date_from)
        .lte('expense_date', date_to)
        .select('id')
      if (error) {
        console.error('reset-expenses: personal delete error:', error)
        return NextResponse.json({ error: 'delete failed' }, { status: 500 })
      }
      deletedPersonal = deleted?.length ?? 0
    }
  }

  // ── Shared expenses ────────────────────────────────────────────────────────
  if (reset_target === 'shared' || reset_target === 'both') {
    if (!family_id) {
      return NextResponse.json({ error: 'missing family_id' }, { status: 400 })
    }
    // Caller must belong to the family they are clearing
    if (!membership || membership.family_id !== family_id) {
      return NextResponse.json({ error: 'unauthorized family_id' }, { status: 403 })
    }
    const { data: deleted, error } = await sb
      .from('shared_expenses')
      .delete()
      .eq('period_id', period_id)
      .eq('family_id', family_id)
      .gte('expense_date', date_from)
      .lte('expense_date', date_to)
      .select('id')
    if (error) {
      console.error('reset-expenses: shared delete error:', error)
      return NextResponse.json({ error: 'delete failed' }, { status: 500 })
    }
    deletedShared = deleted?.length ?? 0
  }

  return NextResponse.json({
    deleted_personal: deletedPersonal,
    deleted_shared: deletedShared,
    deleted_total: deletedPersonal + deletedShared,
  })
}
