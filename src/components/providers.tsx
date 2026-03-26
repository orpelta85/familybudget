'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { PeriodProvider } from '@/lib/context/PeriodContext'
import { FamilyProvider } from '@/lib/context/FamilyContext'
import { ImpersonationProvider } from '@/lib/context/ImpersonationContext'
import { ConfirmDialogProvider } from '@/components/ui/ConfirmDialog'
import { FamilyViewProvider } from '@/contexts/FamilyViewContext'
import { ThemeProvider } from '@/contexts/ThemeContext'

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  }))

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ImpersonationProvider>
          <PeriodProvider>
            <FamilyProvider>
              <FamilyViewProvider>
                <ConfirmDialogProvider>
                  {children}
                </ConfirmDialogProvider>
              </FamilyViewProvider>
            </FamilyProvider>
          </PeriodProvider>
        </ImpersonationProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
