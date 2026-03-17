import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SharedExpense } from '@/lib/types'

export function useDeleteSharedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_id }: { id: number; period_id: number }) => {
      const sb = createClient()
      const { error } = await sb.from('shared_expenses').delete().eq('id', id)
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

export function useDeleteAllPeriodSharedExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (period_id: number) => {
      const sb = createClient()
      const { error } = await sb.from('shared_expenses').delete().eq('period_id', period_id)
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

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
