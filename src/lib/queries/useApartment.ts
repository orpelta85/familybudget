import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { ApartmentDeposit } from '@/lib/types'

export function useApartmentDeposits(familyId: string | undefined) {
  return useQuery<ApartmentDeposit[]>({
    queryKey: ['apartment_deposits', familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('apartment_deposits')
        .select('*')
        .eq('family_id', familyId!)
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
        .upsert(deposit, { onConflict: 'family_id,period_id' })
        .select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['apartment_deposits'] }),
  })
}
