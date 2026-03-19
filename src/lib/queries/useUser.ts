'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function useUser() {
  const qc = useQueryClient()

  const { data: user = null, isLoading: loading } = useQuery<User | null>({
    queryKey: ['user'],
    queryFn: async () => {
      const sb = createClient()
      const { data } = await sb.auth.getUser()
      return data.user
    },
    staleTime: 1000 * 60 * 5,
  })

  useEffect(() => {
    const sb = createClient()
    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      qc.setQueryData<User | null>(['user'], session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [qc])

  return { user, loading }
}
