import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { SinkingFund, SinkingFundTransaction } from '@/lib/types'

export function useSinkingFunds(userId: string | undefined) {
  return useQuery<SinkingFund[]>({
    queryKey: ['sinking_funds', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb.from('sinking_funds').select('*').eq('user_id', userId!).eq('is_active', true).order('id')
      if (error) throw error
      return data
    },
  })
}

export function useSinkingTransactions(fundId: number | undefined) {
  return useQuery<SinkingFundTransaction[]>({
    queryKey: ['sinking_transactions', fundId],
    enabled: !!fundId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb.from('sinking_fund_transactions').select('*').eq('fund_id', fundId!).order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useAllSinkingTransactions(userId: string | undefined) {
  return useQuery<SinkingFundTransaction[]>({
    queryKey: ['all_sinking_transactions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data: funds } = await sb.from('sinking_funds').select('id').eq('user_id', userId!)
      if (!funds?.length) return []
      const ids = funds.map(f => f.id)
      const { data, error } = await sb.from('sinking_fund_transactions').select('*').in('fund_id', ids)
      if (error) throw error
      return data
    },
  })
}

export function useAddSinkingTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tx: Omit<SinkingFundTransaction, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('sinking_fund_transactions').insert(tx).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['sinking_transactions', vars.fund_id] })
      qc.invalidateQueries({ queryKey: ['all_sinking_transactions'] })
    },
  })
}
