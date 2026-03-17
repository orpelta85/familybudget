import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ApartmentDeposit } from '@/lib/types'

export function useApartmentDeposits() {
  return useQuery<ApartmentDeposit[]>({
    queryKey: ['apartment_deposits'],
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('apartment_deposits')
        .select('*')
        .order('period_id')
      if (error) throw error
      return data
    },
  })
}

export function useUpsertApartmentDeposit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (deposit: Omit<ApartmentDeposit, 'id'>) => {
      const sb = createClient()
      const { data, error } = await sb
        .from('apartment_deposits')
        .upsert(deposit, { onConflict: 'period_id' })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apartment_deposits'] }),
  })
}
