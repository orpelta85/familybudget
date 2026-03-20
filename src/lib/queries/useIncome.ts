import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
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

export function useFamilyIncome(periodId: number | undefined, memberIds: string[], enabled: boolean) {
  return useQuery<FamilyMemberIncome[]>({
    queryKey: ['family_income', periodId, memberIds],
    enabled: !!periodId && memberIds.length > 0 && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/family/income?period_id=${periodId}&member_ids=${memberIds.join(',')}`)
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
