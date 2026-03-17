import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

const STARTER_CATEGORIES = [
  // Fixed (shared expenses reflected here as my share)
  { name: 'שכירות (חלקי)', type: 'fixed', monthly_target: 2500, sort_order: 1 },
  { name: 'ארנונה (חלקי)', type: 'fixed', monthly_target: 150, sort_order: 2 },
  { name: 'חשמל (חלקי)', type: 'fixed', monthly_target: 100, sort_order: 3 },
  { name: 'מים+גז (חלקי)', type: 'fixed', monthly_target: 75, sort_order: 4 },
  { name: 'ועד בית (חלקי)', type: 'fixed', monthly_target: 125, sort_order: 5 },
  { name: 'אינטרנט (חלקי)', type: 'fixed', monthly_target: 50, sort_order: 6 },
  { name: 'ביטוח דירה (חלקי)', type: 'fixed', monthly_target: 60, sort_order: 7 },
  { name: 'נטפליקס (חלקי)', type: 'fixed', monthly_target: 30, sort_order: 8 },
  { name: 'ספוטיפיי (חלקי)', type: 'fixed', monthly_target: 25, sort_order: 9 },
  // Variable
  { name: 'מכולת (חלקי)', type: 'variable', monthly_target: 600, sort_order: 10 },
  { name: 'הוצאות אישיות', type: 'variable', monthly_target: 1500, sort_order: 11 },
  { name: 'בגדים', type: 'variable', monthly_target: 300, sort_order: 12 },
  { name: 'בריאות', type: 'variable', monthly_target: 200, sort_order: 13 },
  { name: 'תחבורה', type: 'variable', monthly_target: 400, sort_order: 14 },
  { name: 'ספורט', type: 'variable', monthly_target: 200, sort_order: 15 },
  { name: 'שונות', type: 'variable', monthly_target: 200, sort_order: 16 },
  // Sinking
  { name: 'קרן חירום', type: 'sinking', monthly_target: 500, sort_order: 17 },
  { name: 'חופשה', type: 'sinking', monthly_target: 400, sort_order: 18 },
  { name: 'רכב', type: 'sinking', monthly_target: 300, sort_order: 19 },
  // Savings
  { name: 'דירה', type: 'savings', monthly_target: 3500, sort_order: 20 },
  { name: 'השקעות', type: 'savings', monthly_target: 500, sort_order: 21 },
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
