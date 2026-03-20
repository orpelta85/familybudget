'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
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
  const [viewMode, setViewModeRaw] = useState<ViewMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('familyViewMode')
      if (saved === 'personal' || saved === 'family' || saved === 'member') return saved
    }
    return 'personal'
  })
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('familyViewMemberId')
    return null
  })
  const [selectedMemberName, setSelectedMemberName] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('familyViewMemberName')
    return null
  })
  const router = useRouter()

  useEffect(() => {
    localStorage.setItem('familyViewMode', viewMode)
    if (selectedMemberId) localStorage.setItem('familyViewMemberId', selectedMemberId)
    else localStorage.removeItem('familyViewMemberId')
    if (selectedMemberName) localStorage.setItem('familyViewMemberName', selectedMemberName)
    else localStorage.removeItem('familyViewMemberName')
  }, [viewMode, selectedMemberId, selectedMemberName])

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
