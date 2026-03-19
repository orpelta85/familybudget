import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Period } from '@/lib/types'

export function usePeriods() {
  return useQuery<Period[]>({
    queryKey: ['periods'],
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('periods')
        .select('*')
        .gte('start_date', '2025-11-11')
        .order('id')
      if (error) throw error
      return data
    },
    staleTime: Infinity,
  })
}

export function useCurrentPeriod() {
  const { data: periods } = usePeriods()
  if (!periods) return null
  const today = new Date().toISOString().split('T')[0]
  return periods.find(p => p.start_date <= today && p.end_date >= today) ?? periods[periods.length - 1]
}
