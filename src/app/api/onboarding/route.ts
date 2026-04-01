import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

const STARTER_CATEGORIES = [
  { name: 'שכירות', type: 'fixed', monthly_target: 5550, sort_order: 1 },
  { name: 'חשבונות בית', type: 'fixed', monthly_target: 940, sort_order: 2 },
  { name: 'ביטוחים', type: 'fixed', monthly_target: 260, sort_order: 3 },
  { name: 'הלוואות', type: 'fixed', monthly_target: 1237, sort_order: 4 },
  { name: 'מנויים', type: 'fixed', monthly_target: 200, sort_order: 5 },
  { name: 'מכולת', type: 'variable', monthly_target: 1500, sort_order: 6 },
  { name: 'אוכל בחוץ', type: 'variable', monthly_target: 800, sort_order: 7 },
  { name: 'תחבורה', type: 'variable', monthly_target: 300, sort_order: 8 },
  { name: 'בריאות ורפואה', type: 'variable', monthly_target: 700, sort_order: 9 },
  { name: 'בגדים וקניות', type: 'variable', monthly_target: 800, sort_order: 10 },
  { name: 'בילויים ופנאי', type: 'variable', monthly_target: 1500, sort_order: 11 },
  { name: 'ילדים', type: 'variable', monthly_target: 0, sort_order: 12 },
  { name: 'חיות מחמד', type: 'variable', monthly_target: 600, sort_order: 13 },
  { name: 'חיסכון והשקעות', type: 'savings', monthly_target: 1000, sort_order: 14 },
  { name: 'שונות', type: 'variable', monthly_target: 300, sort_order: 15 },
]

const STARTER_FUNDS = [
  { name: 'קרן חירום', monthly_allocation: 500, yearly_target: 6000 },
  { name: 'חופשה', monthly_allocation: 400, yearly_target: 4800 },
  { name: 'רכב - תחזוקה', monthly_allocation: 300, yearly_target: 3600 },
  { name: 'אלקטרוניקה', monthly_allocation: 150, yearly_target: 1800 },
  { name: 'מתנות', monthly_allocation: 100, yearly_target: 1200 },
]

export async function POST(req: NextRequest) {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const body = await req.json()
  const { action } = body
  const sb = createServiceClient()

  switch (action) {
    case 'reset': {
      await sb.from('profiles').update({ onboarding_completed: false, onboarding_step: 0 }).eq('id', authUser.id)
      return NextResponse.json({ ok: true })
    }

    case 'save_step': {
      const { step } = body
      await sb.from('profiles').update({ onboarding_step: step }).eq('id', authUser.id)
      return NextResponse.json({ ok: true })
    }

    case 'save_welcome': {
      const { name, familyStatus } = body
      await sb.from('profiles').upsert({
        id: authUser.id,
        name,
        onboarding_step: 1,
      }, { onConflict: 'id' })
      return NextResponse.json({ ok: true, familyStatus })
    }

    case 'save_family': {
      const { familyName, partnerEmail, splitPct } = body

      // Update profile split
      await sb.from('profiles').update({
        shared_split_pct: (splitPct ?? 50) / 100,
        onboarding_step: 2,
      }).eq('id', authUser.id)

      // Check if user already has a family
      const { data: existingMember } = await sb
        .from('family_members')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)
        .maybeSingle()

      let familyId: string | null = null

      if (!existingMember) {
        const { data: family, error: famErr } = await sb
          .from('families')
          .insert({ name: familyName || 'המשפחה שלי', created_by: authUser.id })
          .select()
          .single()
        if (famErr) return NextResponse.json({ error: famErr.message }, { status: 500 })

        familyId = family.id
        await sb.from('family_members').insert({
          family_id: family.id,
          user_id: authUser.id,
          role: 'admin',
          show_personal_to_family: true,
        })
      }

      // Send invite email if partner email provided (placeholder - logged for now)
      // TODO: send actual invite email via email service
      // if (partnerEmail && familyId) {
      //   const { data: fam } = await sb.from('families').select('invite_code').eq('id', familyId).single()
      //   if (fam?.invite_code) { /* send email */ }
      // }

      return NextResponse.json({ ok: true })
    }

    case 'save_income': {
      const { salary, bonus, other, periodId } = body
      if (!periodId || typeof periodId !== 'number') {
        return NextResponse.json({ error: 'periodId is required' }, { status: 400 })
      }
      await sb.from('income').upsert({
        period_id: periodId,
        user_id: authUser.id,
        salary: salary || 0,
        bonus: bonus || 0,
        other: other || 0,
      }, { onConflict: 'period_id,user_id' })

      await sb.from('profiles').update({ onboarding_step: 3 }).eq('id', authUser.id)
      return NextResponse.json({ ok: true })
    }

    case 'ensure_categories': {
      // Create default categories if none exist
      const { data: existing } = await sb
        .from('budget_categories')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)
      if (!existing || existing.length === 0) {
        await sb.from('budget_categories')
          .insert(STARTER_CATEGORIES.map(c => ({ ...c, user_id: authUser.id, year: 1 })))
      }
      return NextResponse.json({ ok: true })
    }

    case 'save_step5_items': {
      const { items } = body
      const results: Record<string, boolean> = {}

      for (const item of items) {
        try {
          switch (item.type) {
            case 'budget': {
              for (const cat of item.data) {
                await sb.from('budget_categories').upsert({
                  user_id: authUser.id,
                  name: cat.name,
                  type: 'variable',
                  monthly_target: Number(cat.target) || 0,
                  year: 1,
                  sort_order: 99,
                }, { onConflict: 'user_id,name,year' })
              }
              results.budget = true
              break
            }
            case 'sinking': {
              for (const fund of item.data) {
                await sb.from('sinking_funds').insert({
                  user_id: authUser.id,
                  name: fund.name,
                  monthly_allocation: Number(fund.monthlyDeposit) || 0,
                  yearly_target: Number(fund.target) || 0,
                })
              }
              results.sinking = true
              break
            }
            case 'pension': {
              // Store as pension report summary
              for (const p of item.data) {
                await sb.from('pension_reports').insert({
                  user_id: authUser.id,
                  report_date: new Date().toISOString().split('T')[0],
                  advisor_name: p.company || '',
                  total_savings: Number(p.balance) || 0,
                  total_monthly_deposits: Number(p.monthlyDeposit) || 0,
                  ytd_return: 0,
                  insurance_premium: 0,
                  estimated_pension: 0,
                  disability_coverage: 0,
                  survivors_pension: 0,
                  death_coverage: 0,
                  summary_json: {},
                })
              }
              results.pension = true
              break
            }
            case 'mortgage': {
              for (const m of item.data) {
                await sb.from('mortgage_tracks').insert({
                  user_id: authUser.id,
                  track_name: m.name,
                  original_amount: Number(m.originalAmount) || 0,
                  remaining_balance: Number(m.balance) || 0,
                  monthly_payment: Number(m.monthlyPayment) || 0,
                  interest_rate: Number(m.interestRate) || 0,
                  track_type: 'prime',
                  start_date: new Date().toISOString().split('T')[0],
                  end_date: new Date(Date.now() + 365 * 30 * 86400000).toISOString().split('T')[0],
                })
              }
              results.mortgage = true
              break
            }
            case 'kids': {
              for (const k of item.data) {
                await sb.from('kids').insert({
                  user_id: authUser.id,
                  name: k.name,
                  birth_date: k.birthYear ? `${k.birthYear}-01-01` : null,
                  monthly_savings: Number(k.monthlyExpenses) || 0,
                  savings_years: 18,
                  is_active: true,
                })
              }
              results.kids = true
              break
            }
            case 'debts': {
              for (const d of item.data) {
                await sb.from('debts').insert({
                  user_id: authUser.id,
                  name: d.name,
                  original_amount: Number(d.originalAmount) || 0,
                  remaining_balance: Number(d.balance) || 0,
                  monthly_payment: Number(d.monthlyPayment) || 0,
                  interest_rate: 0,
                  start_date: new Date().toISOString().split('T')[0],
                })
              }
              results.debts = true
              break
            }
            case 'insurance': {
              for (const ins of item.data) {
                await sb.from('insurance_policies').insert({
                  user_id: authUser.id,
                  policy_type: ins.type || 'other',
                  company: ins.company || '',
                  monthly_cost: Number(ins.monthlyCost) || 0,
                  is_active: true,
                })
              }
              results.insurance = true
              break
            }
            case 'subscriptions': {
              for (const sub of item.data) {
                await sb.from('subscriptions').insert({
                  user_id: authUser.id,
                  name: sub.name,
                  monthly_cost: Number(sub.monthlyCost) || 0,
                  billing_day: Number(sub.billingDay) || 1,
                  is_active: true,
                })
              }
              results.subscriptions = true
              break
            }
            case 'goals': {
              for (const g of item.data) {
                await sb.from('savings_goals').insert({
                  user_id: authUser.id,
                  name: g.name,
                  target_amount: Number(g.target) || 0,
                  monthly_deposit: 0,
                  total_periods: 12,
                  is_shared: false,
                  icon: 'target',
                  color: '#3b82f6',
                  is_active: true,
                })
              }
              results.goals = true
              break
            }
            case 'shared_expenses': {
              for (const se of item.data) {
                await sb.from('shared_expenses').insert({
                  family_id: se.familyId,
                  period_id: se.periodId,
                  category: 'misc',
                  total_amount: Number(se.amount) || 0,
                  my_share: (Number(se.amount) || 0) * (Number(se.split) || 50) / 100,
                  notes: se.name,
                })
              }
              results.shared_expenses = true
              break
            }
          }
        } catch (err) {
          console.error(`Error saving ${item.type}:`, err)
          results[item.type] = false
        }
      }

      await sb.from('profiles').update({ onboarding_step: 5 }).eq('id', authUser.id)
      return NextResponse.json({ ok: true, results })
    }

    case 'complete': {
      // Ensure default categories exist
      const { data: cats } = await sb
        .from('budget_categories')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)
      if (!cats || cats.length === 0) {
        await sb.from('budget_categories')
          .insert(STARTER_CATEGORIES.map(c => ({ ...c, user_id: authUser.id, year: 1 })))
      }

      // Ensure default sinking funds exist
      const { data: funds } = await sb
        .from('sinking_funds')
        .select('id')
        .eq('user_id', authUser.id)
        .limit(1)
      if (!funds || funds.length === 0) {
        await sb.from('sinking_funds')
          .insert(STARTER_FUNDS.map(f => ({ ...f, user_id: authUser.id })))
      }

      await sb.from('profiles').update({
        onboarding_completed: true,
        onboarding_step: 6,
      }).eq('id', authUser.id)

      return NextResponse.json({ ok: true })
    }

    default:
      return NextResponse.json({ error: 'unknown action' }, { status: 400 })
  }
}

export async function GET() {
  const authUser = await getAuthUser()
  if (!authUser) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const sb = createServiceClient()
  const { data: profile } = await sb
    .from('profiles')
    .select('onboarding_completed, onboarding_step, name')
    .eq('id', authUser.id)
    .maybeSingle()

  return NextResponse.json({
    completed: profile?.onboarding_completed ?? false,
    step: profile?.onboarding_step ?? 0,
    name: profile?.name ?? '',
  })
}
