'use client'
import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'familybudget_selected_period'

const Ctx = createContext<{
  selectedPeriodId: number | undefined
  setSelectedPeriodId: (id: number) => void
}>({ selectedPeriodId: undefined, setSelectedPeriodId: () => {} })

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriodId, setSelectedPeriodIdRaw] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : undefined
  })

  const setSelectedPeriodId = useCallback((id: number) => {
    setSelectedPeriodIdRaw(id)
    try { localStorage.setItem(STORAGE_KEY, String(id)) } catch {}
  }, [])

  return <Ctx.Provider value={{ selectedPeriodId, setSelectedPeriodId }}>{children}</Ctx.Provider>
}

export function useSharedPeriod() {
  return useContext(Ctx)
}
