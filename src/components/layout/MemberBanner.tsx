'use client'

import { Eye } from 'lucide-react'
import { useFamilyView } from '@/contexts/FamilyViewContext'

export function MemberBanner() {
  const { viewMode, selectedMemberName } = useFamilyView()

  if (viewMode !== 'member' || !selectedMemberName) return null

  return (
    <div className="flex items-center gap-2 px-4 py-2 mb-4 rounded-xl bg-[oklch(0.18_0.02_250)] border border-[oklch(0.28_0.08_250)]">
      <Eye size={14} className="shrink-0 text-[oklch(0.65_0.18_250)]" />
      <span className="text-[12px] font-medium text-[oklch(0.75_0.01_250)]">
        צופה ב: <span className="text-[oklch(0.65_0.18_250)] font-semibold">{selectedMemberName}</span>
      </span>
    </div>
  )
}
