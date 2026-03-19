import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Kid, KidExpense, KidActivity } from '@/lib/types'

export function useKids(userId: string | undefined, familyId: string | undefined) {
  return useQuery<Kid[]>({
    queryKey: ['kids', userId, familyId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      let query = sb.from('kids').select('*').eq('is_active', true)
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

export function useCreateKid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (kid: Omit<Kid, 'id' | 'created_at' | 'is_active'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('kids').insert(kid).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kids'] }),
  })
}

export function useUpdateKid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Kid> & { id: number }) => {
      const sb = createClient()
      const { data, error } = await sb.from('kids').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kids'] }),
  })
}

export function useDeleteKid() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('kids').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['kids'] }),
  })
}

// Kid Expenses
export function useKidExpenses(kidId: number | undefined, periodId: number | undefined) {
  return useQuery<KidExpense[]>({
    queryKey: ['kid_expenses', kidId, periodId],
    enabled: !!kidId,
    queryFn: async () => {
      const sb = createClient()
      let query = sb.from('kid_expenses').select('*').eq('kid_id', kidId!)
      if (periodId) query = query.eq('period_id', periodId)
      const { data, error } = await query.order('expense_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAllKidExpenses(kidIds: number[]) {
  return useQuery<KidExpense[]>({
    queryKey: ['kid_expenses_all', kidIds],
    enabled: kidIds.length > 0,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('kid_expenses')
        .select('*')
        .in('kid_id', kidIds)
        .order('expense_date', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreateKidExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (expense: Omit<KidExpense, 'id' | 'created_at'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('kid_expenses').insert(expense).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kid_expenses'] })
      qc.invalidateQueries({ queryKey: ['kid_expenses_all'] })
    },
  })
}

export function useDeleteKidExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('kid_expenses').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kid_expenses'] })
      qc.invalidateQueries({ queryKey: ['kid_expenses_all'] })
    },
  })
}

// Kid Activities
export function useKidActivities(kidId: number | undefined) {
  return useQuery<KidActivity[]>({
    queryKey: ['kid_activities', kidId],
    enabled: !!kidId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('kid_activities')
        .select('*')
        .eq('kid_id', kidId!)
        .eq('is_active', true)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAllKidActivities(kidIds: number[]) {
  return useQuery<KidActivity[]>({
    queryKey: ['kid_activities_all', kidIds],
    enabled: kidIds.length > 0,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('kid_activities')
        .select('*')
        .in('kid_id', kidIds)
        .eq('is_active', true)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useCreateKidActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (activity: Omit<KidActivity, 'id' | 'created_at' | 'is_active'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('kid_activities').insert(activity).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kid_activities'] })
      qc.invalidateQueries({ queryKey: ['kid_activities_all'] })
    },
  })
}

export function useUpdateKidActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<KidActivity> & { id: number }) => {
      const sb = createClient()
      const { data, error } = await sb.from('kid_activities').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kid_activities'] })
      qc.invalidateQueries({ queryKey: ['kid_activities_all'] })
    },
  })
}

export function useDeleteKidActivity() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('kid_activities').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kid_activities'] })
      qc.invalidateQueries({ queryKey: ['kid_activities_all'] })
    },
  })
}
