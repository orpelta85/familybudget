import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import { withImpersonation } from '@/lib/impersonate-client'
import type { Income } from '@/lib/types'

export function useIncome(periodId: number | undefined, userId: string | undefined) {
  return useQuery<Income | null>({
    queryKey: ['income', periodId, userId],
    enabled: !!periodId && !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('income')
        .select('*')
        .eq('period_id', periodId!)
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

/**
 * Income rows for a set of periods (range mode).
 * The `income` table has no real date column, so callers compute the
 * overlapping period ids via `periodIdsInRange` and pass them here.
 */
export function useIncomeByPeriods(periodIds: number[], userId: string | undefined) {
  return useQuery<Income[]>({
    queryKey: ['income', 'range', [...periodIds].sort((a, b) => a - b), userId],
    enabled: !!userId && periodIds.length > 0,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('income')
        .select('*')
        .eq('user_id', userId!)
        .in('period_id', periodIds)
      if (error) throw error
      return data
    },
  })
}

export function useAllIncome(userId: string | undefined) {
  return useQuery<Income[]>({
    queryKey: ['all_income', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('income')
        .select('*')
        .eq('user_id', userId!)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export interface FamilyMemberIncome {
  user_id: string
  display_name: string
  salary: number
  bonus: number
  other: number
  total: number
}

/**
 * Family members' income.
 * - Month mode: pass `periodId`, filtering happens by `period_id`.
 * - Range mode: pass `rangePeriodIds` (the period ids overlapping the date
 *   range — `income` has no real date column). When supplied it takes
 *   precedence over `periodId`.
 */
export function useFamilyIncome(
  periodId: number | undefined,
  memberIds: string[],
  enabled: boolean,
  rangePeriodIds?: number[],
) {
  const rangeActive = !!rangePeriodIds && rangePeriodIds.length > 0
  return useQuery<FamilyMemberIncome[]>({
    queryKey: rangeActive
      ? ['family_income', 'range', [...rangePeriodIds!].sort((a, b) => a - b), memberIds]
      : ['family_income', periodId, memberIds],
    enabled: (rangeActive || !!periodId) && memberIds.length > 0 && enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ member_ids: memberIds.join(',') })
      if (rangeActive) {
        params.set('period_ids', rangePeriodIds!.join(','))
      } else {
        params.set('period_id', String(periodId))
      }
      const res = await fetch(withImpersonation(`/api/family/income?${params.toString()}`))
      if (!res.ok) throw new Error('Failed to fetch family income')
      return res.json()
    },
  })
}

export function useFamilyAllIncome(memberIds: string[], enabled: boolean) {
  return useQuery<Income[]>({
    queryKey: ['family_all_income', memberIds],
    enabled: memberIds.length > 0 && enabled,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('income')
        .select('*')
        .in('user_id', memberIds)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (income: Partial<Income> & { period_id: number; user_id: string }) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('income')
        .upsert(income, { onConflict: 'period_id,user_id' })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['income', vars.period_id, vars.user_id] })
    },
  })
}
