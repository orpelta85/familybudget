'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export type ViewMode = 'personal' | 'family' | 'member'

export interface FamilyViewState {
  viewMode: ViewMode
  selectedMemberId: string | null
  selectedMemberName: string | null
  setViewMode: (mode: ViewMode) => void
  selectMember: (id: string, name: string) => void
}

const FamilyViewCtx = createContext<FamilyViewState>({
  viewMode: 'personal',
  selectedMemberId: null,
  selectedMemberName: null,
  setViewMode: () => {},
  selectMember: () => {},
})

export function FamilyViewProvider({ children }: { children: React.ReactNode }) {
  const [viewMode, setViewModeRaw] = useState<ViewMode>('personal')
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null)
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(null)
  const router = useRouter()

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode)
    if (mode !== 'member') {
      setSelectedMemberId(null)
      setSelectedMemberName(null)
    }
  }, [])

  const selectMember = useCallback((id: string, name: string) => {
    setViewModeRaw('member')
    setSelectedMemberId(id)
    setSelectedMemberName(name)
    // If selecting a kid (id starts with "kid-"), navigate to /kids
    if (id.startsWith('kid-')) {
      router.push('/kids')
    }
  }, [router])

  return (
    <FamilyViewCtx.Provider value={{ viewMode, selectedMemberId, selectedMemberName, setViewMode, selectMember }}>
      {children}
    </FamilyViewCtx.Provider>
  )
}

export function useFamilyView() {
  return useContext(FamilyViewCtx)
}
