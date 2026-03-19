import { useQuery } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

export function useProfile(userId: string | undefined) {
  return useQuery<Profile | null>({
    queryKey: ['profile', userId],
    enabled: !!userId,
    queryFn: async () => {
      const sb = createClient()
      const { data, error } = await sb
        .from('profiles')
        .select('*')
        .eq('id', userId!)
        .single()
      if (error) return null
      return data
    },
    staleTime: 1000 * 60 * 10,
  })
}

/** Returns the user's split fraction (0-1). Defaults to 0.5 if not set. */
export function useSplitFraction(userId: string | undefined): number {
  const { data: profile } = useProfile(userId)
  const pct = profile?.shared_split_pct ?? 50
  return pct / 100
}
