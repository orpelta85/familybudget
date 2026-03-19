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

export function useSharedExpenses(periodId: number | undefined, familyId: string | undefined) {
  return useQuery<SharedExpense[]>({
    queryKey: ['shared_expenses', periodId, familyId],
    enabled: !!periodId && !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .select('*')
        .eq('period_id', periodId!)
        .eq('family_id', familyId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAllSharedExpenses(familyId: string | undefined) {
  return useQuery<SharedExpense[]>({
    queryKey: ['all_shared_expenses', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .select('*')
        .eq('family_id', familyId!)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function usePaginatedSharedExpenses(
  familyId: string | undefined,
  page: number = 0,
  limit: number = 50,
) {
  return useQuery<{ data: SharedExpense[]; total: number }>({
    queryKey: ['shared_expenses_paginated', familyId, page, limit],
    enabled: !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const from = page * limit
      const to = from + limit - 1
      const { data, error, count } = await sb
        .from('shared_expenses')
        .select('*', { count: 'exact' })
        .eq('family_id', familyId!)
        .order('period_id', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: data ?? [], total: count ?? 0 }
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
        .upsert(expense, { onConflict: 'family_id,period_id,category' })
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
