'use client'
import { createContext, useContext, useState, useCallback } from 'react'

const STORAGE_KEY = 'familybudget_selected_period'
const VIEWMODE_KEY = 'familybudget_period_viewmode'
const RANGE_FROM_KEY = 'familybudget_period_range_from'
const RANGE_TO_KEY = 'familybudget_period_range_to'

export type PeriodViewMode = 'month' | 'range'

const Ctx = createContext<{
  selectedPeriodId: number | undefined
  setSelectedPeriodId: (id: number) => void
  viewMode: PeriodViewMode
  setViewMode: (mode: PeriodViewMode) => void
  dateFrom: string
  dateTo: string
  setDateRange: (from: string, to: string) => void
}>({
  selectedPeriodId: undefined,
  setSelectedPeriodId: () => {},
  viewMode: 'month',
  setViewMode: () => {},
  dateFrom: '',
  dateTo: '',
  setDateRange: () => {},
})

export function PeriodProvider({ children }: { children: React.ReactNode }) {
  const [selectedPeriodId, setSelectedPeriodIdRaw] = useState<number | undefined>(() => {
    if (typeof window === 'undefined') return undefined
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? Number(stored) : undefined
  })

  const [viewMode, setViewModeRaw] = useState<PeriodViewMode>(() => {
    if (typeof window === 'undefined') return 'month'
    return localStorage.getItem(VIEWMODE_KEY) === 'range' ? 'range' : 'month'
  })

  const [dateFrom, setDateFromRaw] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(RANGE_FROM_KEY) ?? ''
  })

  const [dateTo, setDateToRaw] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem(RANGE_TO_KEY) ?? ''
  })

  const setSelectedPeriodId = useCallback((id: number) => {
    setSelectedPeriodIdRaw(id)
    try { localStorage.setItem(STORAGE_KEY, String(id)) } catch {}
  }, [])

  const setViewMode = useCallback((mode: PeriodViewMode) => {
    setViewModeRaw(mode)
    try { localStorage.setItem(VIEWMODE_KEY, mode) } catch {}
  }, [])

  const setDateRange = useCallback((from: string, to: string) => {
    setDateFromRaw(from)
    setDateToRaw(to)
    try {
      localStorage.setItem(RANGE_FROM_KEY, from)
      localStorage.setItem(RANGE_TO_KEY, to)
    } catch {}
  }, [])

  return (
    <Ctx.Provider value={{ selectedPeriodId, setSelectedPeriodId, viewMode, setViewMode, dateFrom, dateTo, setDateRange }}>
      {children}
    </Ctx.Provider>
  )
}

export function useSharedPeriod() {
  return useContext(Ctx)
}
