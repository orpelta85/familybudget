import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface Alert {
  id: number
  user_id: string
  type: string
  severity: 'info' | 'warning' | 'danger' | 'success'
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export function useAlerts(userId: string | undefined) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('alerts')
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return data
    },
  })
}

export function useUnreadAlertCount(userId: string | undefined) {
  return useQuery<number>({
    queryKey: ['alerts_unread', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { count, error } = await sb
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId!)
        .eq('is_read', false)
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useMarkAlertRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: number; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('alerts').update({ is_read: true }).eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => {
      qc.invalidateQueries({ queryKey: ['alerts', user_id] })
      qc.invalidateQueries({ queryKey: ['alerts_unread', user_id] })
    },
  })
}

export function useGenerateAlerts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id, alerts }: { user_id: string; alerts: Omit<Alert, 'id' | 'created_at' | 'is_read'>[] }) => {
      const sb = createClient()
      // Delete old generated alerts (older than 1 day)
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      await sb.from('alerts').delete().eq('user_id', user_id).lt('created_at', yesterday)

      if (alerts.length === 0) return

      // Check which types already exist today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { data: existing } = await sb
        .from('alerts')
        .select('type')
        .eq('user_id', user_id)
        .gte('created_at', today.toISOString())

      const existingTypes = new Set((existing ?? []).map(a => a.type))
      const newAlerts = alerts
        .filter(a => !existingTypes.has(a.type))
        .slice(0, 5)

      if (newAlerts.length > 0) {
        const { error } = await sb.from('alerts').insert(
          newAlerts.map(a => ({ ...a, is_read: false }))
        )
        if (error) throw error
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['alerts', vars.user_id] })
      qc.invalidateQueries({ queryKey: ['alerts_unread', vars.user_id] })
    },
  })
}
