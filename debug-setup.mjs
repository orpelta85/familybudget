import { createClient } from '@supabase/supabase-js'

const URL = 'https://omvszlkasuuoffewlwiv.supabase.co'
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tdnN6bGthc3V1b2ZmZXdsd2l2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzY3OTQ2MCwiZXhwIjoyMDg5MjU1NDYwfQ.ugf_4B2z_HcUec-cTgiQoLjn_BPbZSr8dQkSjmlXRTs'

const sb = createClient(URL, KEY)

// 1. Check users
const { data: users } = await sb.auth.admin.listUsers()
console.log('Users:', users?.users?.map(u => ({ id: u.id, email: u.email })))

if (!users?.users?.length) { console.log('No users found'); process.exit(1) }
const userId = users.users[0].id
console.log('\nUsing userId:', userId)

// 2. skip columns check

// 3. Check existing budget_categories
const { data: cats, error: catsErr } = await sb.from('budget_categories').select('*').eq('user_id', userId).limit(3)
console.log('\nExisting categories:', catsErr?.message || `${cats?.length} rows`, cats?.slice(0,2))

// 4. Check profiles
const { data: profile, error: profErr } = await sb.from('profiles').select('*').eq('id', userId)
console.log('\nProfile:', profErr?.message || profile)

// 5. Try inserting one category to see the error
if (!cats?.length) {
  const { error: insertErr } = await sb.from('budget_categories').insert({
    user_id: userId,
    name: 'test',
    type: 'fixed',
    monthly_target: 100,
    sort_order: 1
  })
  console.log('\nTest insert error:', insertErr?.message || 'SUCCESS')
}
