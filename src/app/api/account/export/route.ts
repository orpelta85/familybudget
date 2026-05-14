import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/supabase/auth'

// GET /api/account/export - returns all of the user's data as JSON download
export async function GET() {
  const authUser = await getAuthUser()
  if (!authUser) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const userId = authUser.id
  const sb = createServiceClient()

  // Fetch every table that belongs to this user
  const [
    profile,
    familyMembers,
    budgetCategories,
    sinkingFunds,
    sinkingTxns,
    personalExpenses,
    income,
    sharedExpenses,
    goals,
    goalDeposits,
    kids,
    mortgages,
    mortgageTracks,
    netWorthEntries,
    netWorthSnapshots,
    debts,
    insurance,
    subscriptions,
    pensionReports,
    pensionProducts,
    pensionHealthCoverages,
    periods,
    categoryRules,
  ] = await Promise.all([
    sb.from('profiles').select('*').eq('id', userId).maybeSingle(),
    sb.from('family_members').select('*').eq('user_id', userId),
    sb.from('budget_categories').select('*').eq('user_id', userId),
    sb.from('sinking_funds').select('*').eq('user_id', userId),
    sb.from('sinking_fund_transactions').select('*').eq('user_id', userId),
    sb.from('personal_expenses').select('*').eq('user_id', userId),
    sb.from('income').select('*').eq('user_id', userId),
    sb.from('shared_expenses').select('*').eq('user_id', userId),
    sb.from('goals').select('*').eq('user_id', userId),
    sb.from('goal_deposits').select('*, goals!inner(user_id)').eq('goals.user_id', userId),
    sb.from('kids').select('*').eq('user_id', userId),
    sb.from('mortgages').select('*').eq('user_id', userId),
    sb.from('mortgage_tracks').select('*, mortgages!inner(user_id)').eq('mortgages.user_id', userId),
    sb.from('net_worth_entries').select('*').eq('user_id', userId),
    sb.from('net_worth_snapshots').select('*').eq('user_id', userId),
    sb.from('debts').select('*').eq('user_id', userId),
    sb.from('insurance_policies').select('*').eq('user_id', userId),
    sb.from('subscriptions').select('*').eq('user_id', userId),
    sb.from('pension_reports').select('*').eq('user_id', userId),
    sb.from('pension_products').select('*, pension_reports!inner(user_id)').eq('pension_reports.user_id', userId),
    sb.from('pension_health_coverages').select('*, pension_reports!inner(user_id)').eq('pension_reports.user_id', userId),
    sb.from('periods').select('*').eq('user_id', userId),
    sb.from('category_rules').select('*').eq('user_id', userId),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    user: {
      id: userId,
      email: authUser.email,
    },
    data: {
      profile: profile.data,
      family_members: familyMembers.data,
      budget_categories: budgetCategories.data,
      sinking_funds: sinkingFunds.data,
      sinking_fund_transactions: sinkingTxns.data,
      personal_expenses: personalExpenses.data,
      income: income.data,
      shared_expenses: sharedExpenses.data,
      goals: goals.data,
      goal_deposits: goalDeposits.data,
      kids: kids.data,
      mortgages: mortgages.data,
      mortgage_tracks: mortgageTracks.data,
      net_worth_entries: netWorthEntries.data,
      net_worth_snapshots: netWorthSnapshots.data,
      debts: debts.data,
      insurance_policies: insurance.data,
      subscriptions: subscriptions.data,
      pension_reports: pensionReports.data,
      pension_products: pensionProducts.data,
      pension_health_coverages: pensionHealthCoverages.data,
      periods: periods.data,
      category_rules: categoryRules.data,
    },
  }

  const filename = `familyplan-export-${new Date().toISOString().slice(0, 10)}.json`
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
