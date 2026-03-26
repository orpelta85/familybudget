import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Mortgage {
  id: number
  user_id: string
  family_id: string | null
  name: string
  total_amount: number
  remaining_balance: number
  start_date: string | null
  end_date: string | null
  is_shared: boolean
  created_at: string
  mortgage_tracks?: MortgageTrack[]
}

export interface MortgageTrack {
  id: number
  mortgage_id: number
  track_name: string
  track_type: 'prime' | 'fixed' | 'cpi_linked' | 'variable'
  original_amount: number
  remaining_amount: number
  interest_rate: number
  monthly_payment: number
  cpi_linked: boolean
  start_date: string | null
  end_date: string | null
}

const TRACK_TYPE_LABELS: Record<string, string> = {
  prime: 'פריים',
  fixed: 'קבועה',
  cpi_linked: 'צמודה למדד',
  variable: 'משתנה',
}

export { TRACK_TYPE_LABELS }

export function useMortgages(userId: string | undefined, familyId: string | undefined) {
  return useQuery<Mortgage[]>({
    queryKey: ['mortgages', userId, familyId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      let query = sb
        .from('mortgages')
        .select('*, mortgage_tracks(*)')
      if (familyId) {
        query = query.or(`user_id.eq.${userId},family_id.eq.${familyId}`)
      } else {
        query = query.eq('user_id', userId!)
      }
      const { data, error } = await query.order('created_at')
      if (error) throw error
      return (data ?? []).map(m => ({
        ...m,
        total_amount: Number(m.total_amount),
        remaining_balance: Number(m.remaining_balance),
        mortgage_tracks: (m.mortgage_tracks ?? []).map((t: Record<string, unknown>) => ({
          ...t,
          original_amount: Number(t.original_amount),
          remaining_amount: Number(t.remaining_amount),
          interest_rate: Number(t.interest_rate),
          monthly_payment: Number(t.monthly_payment),
        })),
      }))
    },
  })
}

export function useAddMortgage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (mortgage: {
      user_id: string
      family_id?: string | null
      name: string
      total_amount: number
      remaining_balance: number
      start_date?: string
      end_date?: string
      is_shared: boolean
    }) => {
      const sb = createClient()
      const { data, error } = await sb.from('mortgages').insert(mortgage).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgages'] }),
  })
}

export function useDeleteMortgage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('mortgages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgages'] }),
  })
}

export function useAddMortgageTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (track: Omit<MortgageTrack, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('mortgage_tracks').insert(track).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgages'] }),
  })
}

export function useDeleteMortgageTrack() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('mortgage_tracks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgages'] }),
  })
}

export function useUpdateMortgage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Mortgage> & { id: number }) => {
      const sb = createClient()
      const { error } = await sb.from('mortgages').update(updates).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['mortgages'] }),
  })
}
