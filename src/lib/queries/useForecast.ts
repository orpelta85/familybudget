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
    }) => {
      const sb = createClient()
      const { error } = await sb
        .from('forecast_settings')
        .upsert({
          ...settings,
          credit_card_day: 2, // keep column happy but unused
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['forecast_settings', vars.user_id] }),
  })
}

// --- Forecast Events (manual recurring) ---

export type AmountMode = 'fixed' | 'average'

export interface ForecastEventRow {
  id: number
  user_id: string
  name: string
  amount: number
  day_of_month: number
  type: 'income' | 'expense'
  amount_mode: AmountMode
  is_active: boolean
  created_at: string
}

export function useForecastEvents(userId: string | undefined) {
  return useQuery<ForecastEventRow[]>({
    queryKey: ['forecast_events', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('forecast_events')
        .select('*')
        .eq('user_id', userId!)
        .order('day_of_month')
      if (error) throw error
      // Default amount_mode for old rows that don't have it
      return (data ?? []).map(row => ({
        ...row,
        amount_mode: (row as Record<string, unknown>).amount_mode ?? 'fixed',
      })) as ForecastEventRow[]
    },
  })
}

export function useUpsertForecastEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (event: {
      id?: number
      user_id: string
      name: string
      amount: number
      day_of_month: number
      type: 'income' | 'expense'
      amount_mode?: AmountMode
      is_active?: boolean
    }) => {
      const sb = createClient()
      if (event.id) {
        const { error } = await sb.from('forecast_events').update({
          name: event.name,
          amount: event.amount,
          day_of_month: event.day_of_month,
          type: event.type,
          amount_mode: event.amount_mode ?? 'fixed',
          is_active: event.is_active ?? true,
        }).eq('id', event.id)
        if (error) throw error
      } else {
        const { error } = await sb.from('forecast_events').insert({
          user_id: event.user_id,
          name: event.name,
          amount: event.amount,
          day_of_month: event.day_of_month,
          type: event.type,
          amount_mode: event.amount_mode ?? 'fixed',
          is_active: event.is_active ?? true,
        })
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['forecast_events', vars.user_id] }),
  })
}

export function useDeleteForecastEvent() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('forecast_events').delete().eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => qc.invalidateQueries({ queryKey: ['forecast_events', user_id] }),
  })
}
