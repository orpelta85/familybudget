'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { PeriodProvider } from '@/lib/context/PeriodContext'
import { FamilyProvider } from '@/lib/context/FamilyContext'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <PeriodProvider>
        <FamilyProvider>
          {children}
        </FamilyProvider>
      </PeriodProvider>
    </QueryClientProvider>
  )
}
