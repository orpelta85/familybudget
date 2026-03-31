'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { User, Users, ChevronDown } from 'lucide-react'
import { useFamilyView } from '@/contexts/FamilyViewContext'
import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useFamilyMemberProfiles } from '@/lib/queries/useFamily'
import { useKids } from '@/lib/queries/useKids'
import { useUser } from '@/lib/queries/useUser'

export function FamilyViewSelector() {
  const { viewMode, selectedMemberId, selectedMemberName, setViewMode, selectMember } = useFamilyView()
  const { familyId, members, myMembership } = useFamilyContext()
  const { user } = useUser()
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const memberIds = useMemo(() => members.map(m => m.user_id), [members])
  const { data: memberProfiles } = useFamilyMemberProfiles(memberIds, !!familyId)
  const { data: kids } = useKids(user?.id, familyId)

  // Other members (not current user)
  const otherMembers = useMemo(() =>
    (memberProfiles ?? []).filter(m => m.user_id !== user?.id),
    [memberProfiles, user?.id]
  )

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const { isSolo } = useFamilyContext()

  if (!familyId || isSolo) return null

  const hasMembers = otherMembers.length > 0 || (kids ?? []).length > 0

  return (
    <div className="px-3 pb-3">
      <div className="flex items-center gap-1">
        {/* Personal pill */}
        <button
          onClick={() => setViewMode('personal')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border-none transition-all duration-150 ${
            viewMode === 'personal'
              ? 'bg-[var(--c-blue-0-22)] text-[var(--accent-blue)] shadow-[inset_0_0_0_1px_var(--c-blue-0-35)]'
              : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--c-0-18)]'
          }`}
        >
          <User size={12} />
          <span>אישי</span>
        </button>

        {/* Family pill */}
        <button
          onClick={() => setViewMode('family')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border-none transition-all duration-150 ${
            viewMode === 'family'
              ? 'bg-[var(--c-blue-0-22)] text-[var(--accent-blue)] shadow-[inset_0_0_0_1px_var(--c-blue-0-35)]'
              : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--c-0-18)]'
          }`}
        >
          <Users size={12} />
          <span>משפחתי</span>
        </button>

        {/* Member dropdown */}
        {hasMembers && (
          <div ref={dropdownRef} className="relative">
            <button
              onClick={() => setShowDropdown(v => !v)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer border-none transition-all duration-150 ${
                viewMode === 'member'
                  ? 'bg-[var(--c-blue-0-22)] text-[var(--accent-blue)] shadow-[inset_0_0_0_1px_var(--c-blue-0-35)]'
                  : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--c-0-18)]'
              }`}
            >
              <span>{viewMode === 'member' && selectedMemberName ? selectedMemberName : 'חבר'}</span>
              <ChevronDown size={11} />
            </button>

            {showDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-[var(--bg-card)] border border-[var(--c-0-26)] rounded-xl p-1 min-w-[140px] shadow-[0_4px_16px_oklch(0_0_0/0.5)] z-50">
                {/* Family members (other than current user) */}
                {otherMembers.length > 0 && (
                  <div className="px-2 py-1 text-[10px] font-semibold text-[var(--c-0-50)] tracking-wide">
                    בני משפחה
                  </div>
                )}
                {otherMembers.map(m => (
                  <button
                    key={m.user_id}
                    onClick={() => { selectMember(m.user_id, m.name); setShowDropdown(false) }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer border-none text-right transition-colors duration-100 ${
                      viewMode === 'member' && m.user_id === selectedMemberId
                        ? 'bg-[var(--c-blue-0-22)] text-[var(--c-0-90)]'
                        : 'bg-transparent text-[var(--text-body)] hover:bg-[var(--c-0-20)]'
                    }`}
                  >
                    <User size={12} className="shrink-0 text-[var(--text-muted)]" />
                    {m.name}
                  </button>
                ))}

                {/* Kids */}
                {(kids ?? []).length > 0 && (
                  <>
                    <div className="px-2 py-1 mt-1 text-[10px] font-semibold text-[var(--c-0-50)] tracking-wide">
                      ילדים
                    </div>
                    {(kids ?? []).map(kid => (
                      <button
                        key={`kid-${kid.id}`}
                        onClick={() => { selectMember(`kid-${kid.id}`, kid.name); setShowDropdown(false) }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] cursor-pointer border-none text-right transition-colors duration-100 ${
                          viewMode === 'member' && selectedMemberId === `kid-${kid.id}`
                            ? 'bg-[var(--c-blue-0-22)] text-[var(--c-0-90)]'
                            : 'bg-transparent text-[var(--text-body)] hover:bg-[var(--c-0-20)]'
                        }`}
                      >
                        <Users size={12} className="shrink-0 text-[var(--text-muted)]" />
                        {kid.name}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
