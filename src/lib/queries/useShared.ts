import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SharedExpense } from '@/lib/types'

export function useSharedExpenses(periodId: number | undefined) {
  return useQuery<SharedExpense[]>({
    queryKey: ['shared_expenses', periodId],
    enabled: !!periodId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .select('*')
        .eq('period_id', periodId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAllSharedExpenses() {
  return useQuery<SharedExpense[]>({
    queryKey: ['all_shared_expenses'],
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .select('*')
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertSharedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Omit<SharedExpense, 'id' | 'my_share'>) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .upsert(expense, { onConflict: 'period_id,category' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['shared_expenses', vars.period_id] })
    },
  })
}
