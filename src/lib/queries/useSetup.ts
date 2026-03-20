import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

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
] as const

const STARTER_FUNDS = [
  { name: 'קרן חירום', monthly_allocation: 500 },
  { name: 'חופשה', monthly_allocation: 400 },
  { name: 'רכב — תחזוקה', monthly_allocation: 300 },
  { name: 'אלקטרוניקה', monthly_allocation: 150 },
  { name: 'מתנות', monthly_allocation: 100 },
]

export function useHasSetup(userId: string | undefined) {
  return useQuery<boolean>({
    queryKey: ['has_setup', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data } = await sb
        .from('budget_categories')
        .select('id')
        .eq('user_id', userId!)
        .limit(1)
      return (data?.length ?? 0) > 0
    },
  })
}

export function useRunSetup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch('/api/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const { error } = await res.json()
        throw new Error(error ?? 'setup failed')
      }
    },
    onSuccess: (_, userId) => {
      qc.invalidateQueries({ queryKey: ['has_setup', userId] })
      qc.invalidateQueries({ queryKey: ['budget_categories', userId] })
      qc.invalidateQueries({ queryKey: ['sinking_funds', userId] })
    },
  })
}
