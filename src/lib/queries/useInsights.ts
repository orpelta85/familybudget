import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export type InsightCategory = 'spending' | 'saving' | 'alert' | 'achievement' | 'action'
export type InsightSeverity = 'info' | 'warning' | 'positive'

export interface AiInsight {
  id: string
  user_id: string
  family_id: string | null
  insight_text: string
  category: InsightCategory
  severity: InsightSeverity
  is_read: boolean
  generated_at: string
}

export function useInsights(userId: string | undefined) {
  return useQuery<AiInsight[]>({
    queryKey: ['ai_insights', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId!)
        .order('generated_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return (data ?? []) as AiInsight[]
    },
  })
}

export function useMarkInsightRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, user_id }: { id: string; user_id: string }) => {
      const sb = createClient()
      const { error } = await sb.from('ai_insights').update({ is_read: true }).eq('id', id)
      if (error) throw error
      return user_id
    },
    onSuccess: (user_id) => {
      qc.invalidateQueries({ queryKey: ['ai_insights', user_id] })
    },
  })
}

export function useGenerateInsights() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ user_id }: { user_id: string }) => {
      const res = await fetch('/api/ai/insights/generate', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'שגיאה בייצור תובנות')
      return { user_id, insights: json.insights as AiInsight[] }
    },
    onSuccess: ({ user_id }) => {
      qc.invalidateQueries({ queryKey: ['ai_insights', user_id] })
    },
  })
}
