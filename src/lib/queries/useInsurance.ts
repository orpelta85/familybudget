import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'

export interface InsurancePolicy {
  id: number
  user_id: string
  family_id: string | null
  name: string
  provider: string | null
  policy_type: 'health' | 'life' | 'car' | 'home' | 'travel' | 'dental' | 'other'
  monthly_cost: number
  annual_cost: number | null
  renewal_date: string | null
  is_shared: boolean
  is_active: boolean
  notes: string | null
  created_at: string
}

export const POLICY_TYPE_LABELS: Record<string, string> = {
  health: 'בריאות',
  life: 'חיים',
  car: 'רכב',
  home: 'דירה',
  travel: 'נסיעות',
  dental: 'שיניים',
  other: 'אחר',
}

export function useInsurancePolicies(userId: string | undefined, familyId: string | undefined) {
  return useQuery<InsurancePolicy[]>({
    queryKey: ['insurance_policies', userId, familyId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      let query = sb.from('insurance_policies').select('*').eq('is_active', true)
      if (familyId) {
        query = query.or(`user_id.eq.${userId},family_id.eq.${familyId}`)
      } else {
        query = query.eq('user_id', userId!)
      }
      const { data, error } = await query.order('policy_type').order('name')
      if (error) throw error
      return (data ?? []).map(p => ({
        ...p,
        monthly_cost: Number(p.monthly_cost),
        annual_cost: p.annual_cost != null ? Number(p.annual_cost) : null,
      }))
    },
  })
}

export function useAddInsurancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (policy: Omit<InsurancePolicy, 'id' | 'created_at' | 'is_active'>) => {
      const sb = createClient()
      const { data, error } = await sb.from('insurance_policies').insert(policy).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_policies'] }),
  })
}

export function useUpdateInsurancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<InsurancePolicy> & { id: number }) => {
      const sb = createClient()
      const { data, error } = await sb.from('insurance_policies').update(updates).eq('id', id).select().single()
      if (error) throw error
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_policies'] }),
  })
}

export function useDeleteInsurancePolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: number) => {
      const sb = createClient()
      const { error } = await sb.from('insurance_policies').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insurance_policies'] }),
  })
}
