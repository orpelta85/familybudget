import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SavingsGoal, GoalDeposit } from '@/lib/types'

export function useSavingsGoals(userId: string | undefined, familyId: string | undefined) {
  return useQuery<SavingsGoal[]>({
    queryKey: ['savings_goals', userId, familyId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      let query = sb.from('savings_goals').select('*').eq('is_active', true)
      if (familyId) {
        query = query.or(`user_id.eq.${userId},family_id.eq.${familyId}`)
      } else {
        query = query.eq('user_id', userId!)
      }
      const { data, error } = await query.order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useGoalDeposits(goalId: number | undefined) {
  return useQuery<GoalDeposit[]>({
    queryKey: ['goal_deposits', goalId],
    enabled: !!goalId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('goal_deposits')
        .select('*')
        .eq('goal_id', goalId!)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useAllGoalDeposits(goalIds: number[]) {
  const key = goalIds.slice().sort().join(',')
  return useQuery<GoalDeposit[]>({
    queryKey: ['goal_deposits_all', key],
    enabled: goalIds.length > 0,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('goal_deposits')
        .select('*')
        .in('goal_id', goalIds)
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useCreateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (goal: Omit<SavingsGoal, 'id' | 'created_at' | 'is_active'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('savings_goals').insert(goal).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })
}

export function useUpdateGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<SavingsGoal> & { id: number }) => {
      const sb = createClient()
      const { data, error } = await sb.from('savings_goals').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })
}

export function useDeleteGoal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('savings_goals').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['savings_goals'] }),
  })
}

export function useAddGoalDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deposit: Omit<GoalDeposit, 'id' | 'created_at'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('goal_deposits').insert(deposit).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal_deposits'] })
      qc.invalidateQueries({ queryKey: ['goal_deposits_all'] })
    },
  })
}

export function useDeleteGoalDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('goal_deposits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goal_deposits'] })
      qc.invalidateQueries({ queryKey: ['goal_deposits_all'] })
    },
  })
}
