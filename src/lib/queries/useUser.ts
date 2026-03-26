'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useImpersonation } from '@/lib/context/ImpersonationContext'

export function useUser() {
  const qc = useQueryClient()
  const { impersonation } = useImpersonation()

  const { data: realUser = null, isLoading: loading } = useQuery<User | null>({
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

  // When impersonating, return a fake User object with the impersonated userId
  if (impersonation) {
    const fakeUser = {
      id: impersonation.userId,
      email: `${impersonation.name}@test.impersonation`,
      user_metadata: { name: impersonation.name },
    } as unknown as User

    return { user: fakeUser, loading: false, realUser }
  }

  return { user: realUser, loading, realUser }
}
