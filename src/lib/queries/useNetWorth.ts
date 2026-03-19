import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface NetWorthEntry {
  id: number
  user_id: string
  category: string
  type: 'asset' | 'liability'
  amount: number
  updated_at: string
}

export function useNetWorthEntries(userId: string | undefined) {
  return useQuery<NetWorthEntry[]>({
    queryKey: ['net_worth_entries', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('net_worth_entries')
        .select('*')
        .eq('user_id', userId!)
        .order('type')
        .order('category')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertNetWorthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (entry: { id?: number; user_id: string; category: string; type: 'asset' | 'liability'; amount: number }) => {
      const sb = createClient()
      if (entry.id) {
        const { error } = await sb.from('net_worth_entries').update({ amount: entry.amount, category: entry.category, type: entry.type, updated_at: new Date().toISOString() }).eq('id', entry.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('net_worth_entries').insert({ user_id: entry.user_id, category: entry.category, type: entry.type, amount: entry.amount })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['net_worth_entries', vars.user_id] }),
  })
}

export function useDeleteNetWorthEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('net_worth_entries').delete().eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['net_worth_entries', user_id] }),
  })
}
