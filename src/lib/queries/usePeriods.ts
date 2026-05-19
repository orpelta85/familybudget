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
        .gte('start_date', '2025-01-01')
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

/**
 * Returns the ids of all periods whose [start_date, end_date] range overlaps
 * the given [from, to] window. Used for range-mode filtering on tables that
 * only have a `period_id` column (no real date column).
 */
export function periodIdsInRange(
  periods: Period[] | undefined,
  from: string,
  to: string,
): number[] {
  if (!periods || !from || !to) return []
  return periods.filter(p => p.start_date <= to && p.end_date >= from).map(p => p.id)
}
