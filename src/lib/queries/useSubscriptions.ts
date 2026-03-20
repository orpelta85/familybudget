import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Subscription {
  id: number
  user_id: string
  name: string
  amount: number
  billing_day: number
  category_id: number | null
  is_active: boolean
}

export function useSubscriptions(userId: string | undefined) {
  return useQuery<Subscription[]>({
    queryKey: ['subscriptions', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId!)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useAddSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (sub: Omit<Subscription, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('subscriptions').insert(sub).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['subscriptions', vars.user_id] }),
  })
}

export function useUpdateSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id, ...updates }: Partial<Subscription> & { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('subscriptions').update(updates).eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['subscriptions', user_id] }),
  })
}

export function useFamilySubscriptions(memberIds: string[], enabled: boolean) {
  return useQuery<Subscription[]>({
    queryKey: ['family_subscriptions', memberIds],
    enabled: memberIds.length > 0 && enabled,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('subscriptions')
        .select('*')
        .in('user_id', memberIds)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useDeleteSubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('subscriptions').delete().eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['subscriptions', user_id] }),
  })
}
