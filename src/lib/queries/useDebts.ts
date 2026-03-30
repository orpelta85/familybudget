import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Debt {
  id: number
  user_id: string
  name: string
  balance: number
  interest_rate: number
  minimum_payment: number
  debt_type: 'fixed' | 'prime' | 'cpi_linked'
  early_payoff_penalty: boolean
  created_at: string
}

export function useDebts(userId: string | undefined) {
  return useQuery<Debt[]>({
    queryKey: ['debts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('debts')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useFamilyDebts(memberIds: string[], enabled: boolean) {
  return useQuery<Debt[]>({
    queryKey: ['family_debts', memberIds],
    enabled: memberIds.length > 0 && enabled,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('debts')
        .select('*')
        .in('user_id', memberIds)
        .order('created_at')
      if (error) throw error
      return data
    },
  })
}

export function useAddDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (debt: Omit<Debt, 'id' | 'created_at'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('debts').insert(debt).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['debts', vars.user_id] }),
  })
}

export function useUpdateDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id, ...fields }: Partial<Debt> & { id: number; user_id: string }) => {
      const sb = createClient()
      const { data, error } = await sb.from('debts').update(fields).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['debts', vars.user_id] }),
  })
}

export function useDeleteDebt() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('debts').delete().eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['debts', user_id] }),
  })
}
