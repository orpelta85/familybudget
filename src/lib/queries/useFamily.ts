import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Family, FamilyMember } from '@/lib/types'

export interface FamilyMemberProfile {
  user_id: string
  name: string
  role: 'admin' | 'member'
  show_personal_to_family: boolean
}

export function useFamilyMemberProfiles(memberIds: string[], enabled: boolean) {
  return useQuery<FamilyMemberProfile[]>({
    queryKey: ['family_member_profiles', memberIds],
    enabled: enabled && memberIds.length > 0,
    queryFn: async () => {
      const sb = createClient()
      const { data: profiles } = await sb
        .from('profiles')
        .select('id, name')
        .in('id', memberIds)
      const { data: memberships } = await sb
        .from('family_members')
        .select('user_id, role, show_personal_to_family')
        .in('user_id', memberIds)
      const membershipMap = new Map((memberships ?? []).map(m => [m.user_id, m]))
      return (profiles ?? []).map(p => ({
        user_id: p.id,
        name: p.name ?? 'חבר/ת משפחה',
        role: (membershipMap.get(p.id)?.role ?? 'member') as 'admin' | 'member',
        show_personal_to_family: membershipMap.get(p.id)?.show_personal_to_family ?? false,
      }))
    },
    staleTime: 1000 * 60 * 5,
  })
}

export interface FamilyMemberSummary {
  user_id: string
  display_name: string
  income: number
  personal_expenses: number
  show_details: boolean
}

export interface FamilySummary {
  total_income: number
  total_personal_expenses: number
  total_shared_expenses: number
  members: FamilyMemberSummary[]
}

export function useFamilySummary(periodId: number | undefined, enabled: boolean) {
  return useQuery<FamilySummary>({
    queryKey: ['family_summary', periodId],
    enabled: !!periodId && enabled,
    queryFn: async () => {
      const res = await fetch(`/api/family/summary?period_id=${periodId}`)
      if (!res.ok) throw new Error('Failed to fetch family summary')
      return res.json()
    },
  })
}

export function useFamily(userId: string | undefined) {
  return useQuery<{ family: Family | null; members: FamilyMember[] }>({
    queryKey: ['family', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()

      // Step 1: Get user's membership row
      const { data: membership } = await sb
        .from('family_members')
        .select('*')
        .eq('user_id', userId!)
        .limit(1)
        .maybeSingle()

      if (!membership) return { family: null, members: [] }

      // Step 2: Get family details
      const { data: family } = await sb
        .from('families')
        .select('*')
        .eq('id', membership.family_id)
        .single()

      if (!family) return { family: null, members: [] }

      // Step 3: Get all members of this family
      const { data: members } = await sb
        .from('family_members')
        .select('*')
        .eq('family_id', family.id)
        .order('joined_at')

      return {
        family: family as Family,
        members: (members ?? []) as FamilyMember[],
      }
    },
  })
}

export function useCreateFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ name, userId }: { name: string; userId: string }) => {
      const res = await fetch('/api/family/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, userId }),
      })
      if (!res.ok) throw new Error('Failed to create family')
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['family', vars.userId] })
    },
  })
}

export function useJoinFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ inviteCode, userId }: { inviteCode: string; userId: string }) => {
      const res = await fetch('/api/family/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invite_code: inviteCode, userId }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to join family')
      }
      return res.json()
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['family', vars.userId] })
    },
  })
}
