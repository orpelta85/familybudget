'use client'
import { createContext, useContext, useState } from 'react'

const Ctx = createContext<{
  selectedPeriodId: number | undefined
  setSelectedPeriodId: (id: number) => void
}>({ selectedPeriodId: undefined, setSelectedPeriodId: () => {} })

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriodId, setSelectedPeriodId] = useState<number | undefined>()
  return <Ctx.Provider value={{ selectedPeriodId, setSelectedPeriodId }}>{children}</Ctx.Provider>
}

export function useSharedPeriod() {
  return useContext(Ctx)
}
