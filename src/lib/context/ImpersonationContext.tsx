'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'

interface ImpersonationState {
  userId: string
  familyId: string
  name: string
}

interface ImpersonationContextValue {
  /** Currently impersonated user info, or null if not impersonating */
  impersonation: ImpersonationState | null
  /** Start impersonating a test family */
  startImpersonation: (userId: string, familyId: string, name: string) => void
  /** Stop impersonating and return to admin view */
  stopImpersonation: () => void
  /** Whether we are currently impersonating */
  isImpersonating: boolean
}

const STORAGE_KEY = 'impersonation_state'

const Ctx = createContext<ImpersonationContextValue>({
  impersonation: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
  isImpersonating: false,
})

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [impersonation, setImpersonation] = useState<ImpersonationState | null>(null)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ImpersonationState
        if (parsed.userId && parsed.familyId && parsed.name) {
          setImpersonation(parsed)
        }
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  const startImpersonation = useCallback((userId: string, familyId: string, name: string) => {
    const state: ImpersonationState = { userId, familyId, name }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    setImpersonation(state)
  }, [])

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY)
    setImpersonation(null)
  }, [])

  return (
    <Ctx.Provider value={{
      impersonation,
      startImpersonation,
      stopImpersonation,
      isImpersonating: impersonation !== null,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useImpersonation() {
  return useContext(Ctx)
}
