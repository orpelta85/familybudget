'use client'

import { Eye } from 'lucide-react'
import { useFamilyView } from '@/contexts/FamilyViewContext'

export function MemberBanner() {
  const { viewMode, selectedMemberName } = useFamilyView()

  if (viewMode !== 'member' || !selectedMemberName) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-4 rounded-xl bg-[var(--c-blue-0-18)] border border-[var(--c-blue-0-28)]">
      <Eye size={14} className="shrink-0 text-[var(--accent-blue)]" />
      <span className="text-[12px] font-medium text-[var(--text-body)]">
        צופה ב: <span className="text-[var(--accent-blue)] font-semibold">{selectedMemberName}</span>
      </span>
    </div>
  )
}
