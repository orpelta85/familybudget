import { createClient } from '@supabase/supabase-js'

const URL = 'https://omvszlkasuuoffewlwiv.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnN6bGthc3V1b2ZmZXdsd2l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3OTQ2MCwiZXhwIjoyMDg5MjU1NDYwfQ.ugf_4B2z_HcUec-cTgiQoLjn_BPbZSr8dQkSjmlXRTs'
const sb = createClient(URL, KEY)

const CATEGORIES = [
  { name: 'שכירות (חלקי)', type: 'fixed', monthly_target: 2500, sort_order: 1 },
  { name: 'ארנונה (חלקי)', type: 'fixed', monthly_target: 150, sort_order: 2 },
  { name: 'חשמל (חלקי)', type: 'fixed', monthly_target: 100, sort_order: 3 },
  { name: 'מים+גז (חלקי)', type: 'fixed', monthly_target: 75, sort_order: 4 },
  { name: 'ועד בית (חלקי)', type: 'fixed', monthly_target: 125, sort_order: 5 },
  { name: 'אינטרנט (חלקי)', type: 'fixed', monthly_target: 50, sort_order: 6 },
  { name: 'ביטוח דירה (חלקי)', type: 'fixed', monthly_target: 60, sort_order: 7 },
  { name: 'נטפליקס (חלקי)', type: 'fixed', monthly_target: 30, sort_order: 8 },
  { name: 'ספוטיפיי (חלקי)', type: 'fixed', monthly_target: 25, sort_order: 9 },
  { name: 'מכולת (חלקי)', type: 'variable', monthly_target: 600, sort_order: 10 },
  { name: 'הוצאות אישיות', type: 'variable', monthly_target: 1500, sort_order: 11 },
  { name: 'בגדים', type: 'variable', monthly_target: 300, sort_order: 12 },
  { name: 'בריאות', type: 'variable', monthly_target: 200, sort_order: 13 },
  { name: 'תחבורה', type: 'variable', monthly_target: 400, sort_order: 14 },
  { name: 'ספורט', type: 'variable', monthly_target: 200, sort_order: 15 },
  { name: 'שונות', type: 'variable', monthly_target: 200, sort_order: 16 },
  { name: 'קרן חירום', type: 'sinking', monthly_target: 500, sort_order: 17 },
  { name: 'חופשה', type: 'sinking', monthly_target: 400, sort_order: 18 },
  { name: 'רכב', type: 'sinking', monthly_target: 300, sort_order: 19 },
  { name: 'דירה', type: 'savings', monthly_target: 3500, sort_order: 20 },
  { name: 'השקעות', type: 'savings', monthly_target: 500, sort_order: 21 },
]

const FUNDS = [
  { name: 'קרן חירום', monthly_allocation: 500, target_amount: 20000 },
  { name: 'חופשה', monthly_allocation: 400, target_amount: 8000 },
  { name: 'רכב — תחזוקה', monthly_allocation: 300, target_amount: 5000 },
  { name: 'אלקטרוניקה', monthly_allocation: 150, target_amount: 3000 },
  { name: 'מתנות', monthly_allocation: 100, target_amount: 1200 },
]

// Get all users
const { data: { users } } = await sb.auth.admin.listUsers()
console.log('Users:', users.map(u => u.email))

for (const user of users) {
  const userId = user.id
  console.log(`\n--- Processing ${user.email} (${userId}) ---`)

  // Check existing categories
  const { data: existing } = await sb.from('budget_categories').select('id').eq('user_id', userId).limit(1)
  if (existing?.length > 0) {
    console.log('Already has categories, skipping')
    continue
  }

  // Try inserting without year first
  const { error: e1 } = await sb.from('budget_categories').insert(
    [{ ...CATEGORIES[0], user_id: userId }]
  )

  let rows
  if (e1?.message?.includes('year')) {
    // year column exists and is required — try year_number values
    console.log('year column required, inserting with year=1')
    rows = CATEGORIES.map(c => ({ ...c, user_id: userId, year: 1 }))
  } else if (e1) {
    console.log('Insert error:', e1.message)
    continue
  } else {
    // first row succeeded without year
    await sb.from('budget_categories').delete().eq('user_id', userId).eq('sort_order', 1)
    rows = CATEGORIES.map(c => ({ ...c, user_id: userId }))
  }

  const { error: catErr } = await sb.from('budget_categories').insert(rows)
  if (catErr) {
    console.log('Categories error:', catErr.message)
  } else {
    console.log('✓ Inserted', rows.length, 'categories')
  }

  // Check existing funds
  const { data: existingFunds } = await sb.from('sinking_funds').select('id').eq('user_id', userId).limit(1)
  if (!existingFunds?.length) {
    const { error: fundErr } = await sb.from('sinking_funds').insert(
      FUNDS.map(f => ({ ...f, user_id: userId }))
    )
    if (fundErr) console.log('Funds error:', fundErr.message)
    else console.log('✓ Inserted', FUNDS.length, 'sinking funds')
  } else {
    console.log('Already has funds, skipping')
  }

  // Upsert profile
  const { error: profErr } = await sb.from('profiles').upsert({ id: userId, name: user.email.split('@')[0] }, { onConflict: 'id' })
  if (profErr) console.log('Profile error:', profErr.message)
  else console.log('✓ Profile ok')
}

console.log('\nDone!')
