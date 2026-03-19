import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface ForecastSettings {
  id: number
  user_id: string
  current_balance: number
  payday: number
  credit_card_day: number
  updated_at: string
}

export function useForecastSettings(userId: string | undefined) {
  return useQuery<ForecastSettings | null>({
    queryKey: ['forecast_settings', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('forecast_settings')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return data
    },
  })
}

export function useUpsertForecastSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (settings: {
      user_id: string
      current_balance: number
      payday: number
      credit_card_day: number
    }) => {
      const sb = createClient()
      const { error } = await sb
        .from('forecast_settings')
        .upsert({
          ...settings,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['forecast_settings', vars.user_id] }),
  })
}
