import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { JointPoolIncome, JointPoolExpense } from '@/lib/types'

export function useJointPoolIncome(periodId: number | undefined, familyId: string | undefined) {
  return useQuery<JointPoolIncome | null>({
    queryKey: ['joint_pool_income', periodId, familyId],
    enabled: !!periodId && !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb.from('joint_pool_income').select('*').eq('period_id', periodId!).eq('family_id', familyId!).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useJointPoolExpenses(periodId: number | undefined, familyId: string | undefined) {
  return useQuery<JointPoolExpense[]>({
    queryKey: ['joint_pool_expenses', periodId, familyId],
    enabled: !!periodId && !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb.from('joint_pool_expenses').select('*').eq('period_id', periodId!).eq('family_id', familyId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useUpsertJointIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (income: Omit<JointPoolIncome, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('joint_pool_income').upsert(income, { onConflict: 'family_id,period_id' }).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['joint_pool_income', vars.period_id] }),
  })
}

export function useAddJointExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Omit<JointPoolExpense, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('joint_pool_expenses').insert(expense).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['joint_pool_expenses', vars.period_id] }),
  })
}

export function useDeleteJointExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, periodId }: { id: number; periodId: number }) => {
      const sb = createClient()
      const { error } = await sb.from('joint_pool_expenses').delete().eq('id', id)
      if (error) throw error
      return periodId
    },
    onSuccess: (periodId) => qc.invalidateQueries({ queryKey: ['joint_pool_expenses', periodId] }),
  })
}

export function useJointCarryOver(currentPeriodId: number | undefined, familyId: string | undefined, periods: { id: number }[] | undefined) {
  return useQuery<number>({
    queryKey: ['joint_carry_over', currentPeriodId, familyId],
    enabled: !!currentPeriodId && !!familyId && !!periods,
    queryFn: async () => {
      const sb = createClient()
      const priorPeriodIds = (periods ?? []).filter(p => p.id < currentPeriodId!).map(p => p.id)
      if (priorPeriodIds.length === 0) return 0

      const { data: incomes, error: incErr } = await sb
        .from('joint_pool_income')
        .select('my_contribution, partner_contribution')
        .eq('family_id', familyId!)
        .in('period_id', priorPeriodIds)
      if (incErr) throw incErr

      const { data: expenses, error: expErr } = await sb
        .from('joint_pool_expenses')
        .select('amount')
        .eq('family_id', familyId!)
        .in('period_id', priorPeriodIds)
      if (expErr) throw expErr

      const totalIncome = (incomes ?? []).reduce((s, r) => s + Number(r.my_contribution) + Number(r.partner_contribution), 0)
      const totalExpenses = (expenses ?? []).reduce((s, r) => s + Number(r.amount), 0)
      return totalIncome - totalExpenses
    },
  })
}
