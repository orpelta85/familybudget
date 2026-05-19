import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SharedExpense } from '@/lib/types'

export function useDeleteSharedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_id, family_id }: { id: number; period_id: number; family_id?: string }) => {
      const sb = createClient()
      let query = sb.from('shared_expenses').delete().eq('id', id)
      if (family_id) query = query.eq('family_id', family_id)
      const { error } = await query
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

export function useDeleteAllPeriodSharedExpenses() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ period_id, family_id }: { period_id: number; family_id?: string }) => {
      const sb = createClient()
      let query = sb.from('shared_expenses').delete().eq('period_id', period_id)
      if (family_id) query = query.eq('family_id', family_id)
      const { error } = await query
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

/**
 * Shared expenses for the expenses page.
 * - Month mode: pass `periodId`, filtering happens by `period_id` (default behavior).
 * - Range mode: pass `dateRange` ({ from, to }), filtering happens by `expense_date`.
 *   When a range is supplied it takes precedence over `periodId`.
 */
export function useSharedExpenses(
  periodId: number | undefined,
  familyId: string | undefined,
  dateRange?: { from: string; to: string },
) {
  const rangeActive = !!dateRange?.from && !!dateRange?.to
  return useQuery<SharedExpense[]>({
    queryKey: rangeActive
      ? ['shared_expenses', 'range', dateRange!.from, dateRange!.to, familyId]
      : ['shared_expenses', periodId, familyId],
    enabled: !!familyId && (rangeActive || !!periodId),
    queryFn: async () => {
      const sb = createClient()
      let query = sb
        .from('shared_expenses')
        .select('*')
        .eq('family_id', familyId!)
      if (rangeActive) {
        query = query
          .gte('expense_date', dateRange!.from)
          .lte('expense_date', dateRange!.to)
      } else {
        query = query.eq('period_id', periodId!)
      }
      const { data, error } = await query.order('created_at')
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

export function useUpdateSharedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_id, category, total_amount, notes, family_id, paid_by }: { id: number; period_id: number; category: string; total_amount: number; notes?: string; family_id?: string; paid_by?: string | null }) => {
      const sb = createClient()
      const patch: { category: string; total_amount: number; notes?: string; paid_by?: string | null } = { category, total_amount, notes }
      if (paid_by !== undefined) patch.paid_by = paid_by
      let query = sb.from('shared_expenses').update(patch).eq('id', id)
      if (family_id) query = query.eq('family_id', family_id)
      const { error } = await query
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

export function useToggleSharedFixed() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, period_id, is_fixed }: { id: number; period_id: number; is_fixed: boolean | null }) => {
      const sb = createClient()
      const { error } = await sb.from('shared_expenses').update({ is_fixed }).eq('id', id)
      if (error) throw error
      return period_id
    },
    onSuccess: (period_id) => qc.invalidateQueries({ queryKey: ['shared_expenses', period_id] }),
  })
}

export function useUpsertSharedExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Omit<SharedExpense, 'id' | 'my_share'>) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('shared_expenses')
        .insert(expense)
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
