'use client'
import { createContext, useContext } from 'react'
import { useFamily } from '@/lib/queries/useFamily'
import { useUser } from '@/lib/queries/useUser'
import type { Family, FamilyMember } from '@/lib/types'

interface FamilyContextValue {
  family: Family | null
  familyId: string | undefined
  members: FamilyMember[]
  myMembership: FamilyMember | null
  isAdmin: boolean
  loading: boolean
}

const Ctx = createContext<FamilyContextValue>({
  family: null,
  familyId: undefined,
  members: [],
  myMembership: null,
  isAdmin: false,
  loading: true,
})

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser()
  const { data, isLoading } = useFamily(user?.id)

  const family = data?.family ?? null
  const members = data?.members ?? []
  const myMembership = members.find(m => m.user_id === user?.id) ?? null
  const isAdmin = myMembership?.role === 'admin'

  return (
    <Ctx.Provider value={{
      family,
      familyId: family?.id,
      members,
      myMembership,
      isAdmin,
      loading: isLoading,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useFamilyContext() {
  return useContext(Ctx)
}
