'use client'

import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useUser } from '@/lib/queries/useUser'
import { createClient } from '@/lib/supabase/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'
import {
  Users, Copy, Mail, Send, X, Link2, Pencil, Check, Shield, Eye, EyeOff,
} from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { PageInfo } from '@/components/ui/PageInfo'
import { PAGE_TIPS } from '@/lib/page-tips'

function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('he-IL', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function FamilyPage() {
  const { family, members, myMembership, isAdmin, loading, familyId } = useFamilyContext()
  const { user } = useUser()
  const qc = useQueryClient()

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  const updateName = useMutation({
    mutationFn: async (name: string) => {
      const sb = createClient()
      const { error } = await sb.from('families').update({ name }).eq('id', familyId!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] })
      setEditingName(false)
      toast.success('שם המשפחה עודכן')
    },
    onError: () => toast.error('שגיאה בעדכון שם המשפחה'),
  })

  const removeMember = useMutation({
    mutationFn: async (membershipId: number) => {
      const sb = createClient()
      const { error } = await sb.from('family_members').delete().eq('id', membershipId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] })
      setConfirmDeleteId(null)
      toast.success('החבר הוסר מהמשפחה')
    },
    onError: () => toast.error('שגיאה בהסרת חבר'),
  })

  const togglePrivacy = useMutation({
    mutationFn: async (value: boolean) => {
      const sb = createClient()
      const { error } = await sb
        .from('family_members')
        .update({ show_personal_to_family: value })
        .eq('user_id', user!.id)
        .eq('family_id', familyId!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['family'] })
      toast.success('הגדרת הפרטיות עודכנה')
    },
    onError: () => toast.error('שגיאה בעדכון הגדרה'),
  })

  async function sendInviteEmail() {
    if (!family || !inviteEmail) return
    setSendingEmail(true)
    try {
      const res = await fetch('/api/family/invite-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, familyName: family.name, inviteCode: family.invite_code }),
      })
      if (!res.ok) throw new Error('failed')
      toast.success(`הזמנה נשלחה ל-${inviteEmail}`)
      setInviteEmail('')
    } catch {
      toast.error('שגיאה בשליחת ההזמנה')
    }
    setSendingEmail(false)
  }

  function copyInviteLink() {
    if (!family) return
    const url = `${window.location.origin}/login?invite=${family.invite_code}`
    navigator.clipboard.writeText(url)
    toast.success('לינק הזמנה הועתק!')
  }

  if (loading) {
    return <TableSkeleton rows={4} />
  }

  if (!family) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <div className="text-[oklch(0.65_0.01_250)] text-sm">לא נמצאה משפחה</div>
      </div>
    )
  }

  return (
    <div className="max-w-[680px] mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2.5 mb-1">
          <Users size={20} className="text-[oklch(0.65_0.18_250)]" />
          <h1 className="text-[22px] font-bold tracking-tight m-0">
            הגדרות משפחה
          </h1>
          <PageInfo {...PAGE_TIPS.family} />
        </div>
        <p className="text-[13px] text-[oklch(0.65_0.01_250)] m-0">
          {family.name}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {/* Family Info Card */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            פרטי המשפחה
          </h2>

          <div className="flex flex-col gap-3.5">
            {/* Family Name */}
            <div>
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">שם משפחה</div>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nameValue.trim()) updateName.mutate(nameValue.trim())
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                  />
                  <button
                    onClick={() => nameValue.trim() && updateName.mutate(nameValue.trim())}
                    disabled={updateName.isPending}
                    className="bg-[oklch(0.65_0.18_250)] border-none rounded-lg px-3 py-2 cursor-pointer text-[oklch(0.12_0.01_250)] font-semibold text-[13px] flex items-center gap-1.5"
                    aria-label="שמור"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-2 py-2 cursor-pointer text-[oklch(0.70_0.01_250)] text-xs flex items-center gap-1"
                    aria-label="ביטול"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{family.name}</span>
                  {isAdmin && (
                    <button
                      onClick={() => { setNameValue(family.name); setEditingName(true) }}
                      className="bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)] p-1"
                      aria-label="ערוך שם"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Invite Code */}
            <div>
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">קוד הזמנה</div>
              <span className="text-[13px] font-mono tracking-[0.05em] text-[oklch(0.65_0.18_250)] ltr inline-block">
                {family.invite_code}
              </span>
            </div>

            {/* Created Date */}
            <div>
              <div className="text-[11px] text-[oklch(0.65_0.01_250)] block mb-1 font-medium">תאריך יצירה</div>
              <span className="text-[13px] text-[oklch(0.65_0.01_250)]">
                {formatDate(family.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Members List Card */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            חברי משפחה
          </h2>

          <div className="flex flex-col gap-2.5">
            {members.map(member => {
              const isMe = member.user_id === user?.id
              const isMemberAdmin = member.role === 'admin'
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg ${
                    isMe
                      ? 'bg-[oklch(0.20_0.02_250)] border border-[oklch(0.30_0.04_250)]'
                      : 'bg-[oklch(0.13_0.01_250)] border border-[oklch(0.22_0.01_250)]'
                  }`}
                >
                  {/* Avatar placeholder */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isMemberAdmin ? 'bg-[oklch(0.25_0.06_145)]' : 'bg-[oklch(0.25_0.04_250)]'
                  }`}>
                    <Users size={14} className={isMemberAdmin ? 'text-[oklch(0.70_0.15_145)]' : 'text-[oklch(0.65_0.12_250)]'} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">
                        {member.user_id.slice(0, 8)}...
                        {isMe && (
                          <span className="text-[oklch(0.65_0.01_250)] font-normal"> (את/ה)</span>
                        )}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        isMemberAdmin
                          ? 'bg-[oklch(0.20_0.03_145)] text-[oklch(0.75_0.15_145)] border-[oklch(0.30_0.05_145)]'
                          : 'bg-[oklch(0.20_0.03_250)] text-[oklch(0.75_0.15_250)] border-[oklch(0.30_0.05_250)]'
                      }`}>
                        {isMemberAdmin ? (
                          <><Shield size={10} /> מנהל</>
                        ) : 'חבר'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[oklch(0.65_0.01_250)] mt-0.5">
                      הצטרף/ה {formatDate(member.joined_at)}
                    </div>
                  </div>

                  {/* Delete button (admin only, not for admins) */}
                  {isAdmin && !isMemberAdmin && (
                    <>
                      {confirmDeleteId === member.id ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => removeMember.mutate(member.id)}
                            disabled={removeMember.isPending}
                            className="bg-[oklch(0.25_0.08_25)] border border-[oklch(0.35_0.10_25)] rounded-md px-2.5 py-1 text-[oklch(0.75_0.15_25)] text-[11px] font-semibold cursor-pointer"
                          >
                            אישור
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-transparent border border-[oklch(0.25_0.01_250)] rounded-md px-2 py-1 text-[oklch(0.65_0.01_250)] text-[11px] cursor-pointer"
                          >
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(member.id)}
                          className="bg-transparent border-none cursor-pointer text-[oklch(0.65_0.01_250)] p-1.5"
                          aria-label="הסר חבר"
                        >
                          <X size={15} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Invite Section Card */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            הזמנת חברי משפחה
          </h2>

          {/* Copy Link */}
          <div className="mb-5">
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Link2 size={14} className="text-[oklch(0.65_0.18_250)]" />
              שתף לינק הזמנה
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family.invite_code}`}
                className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-xs outline-none ltr text-[oklch(0.70_0.01_250)]"
              />
              <button onClick={copyInviteLink} className="bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 cursor-pointer text-[oklch(0.70_0.01_250)] text-xs flex items-center gap-1">
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[oklch(0.25_0.01_250)]" />
            <span className="text-[11px] text-[oklch(0.65_0.01_250)]">או</span>
            <div className="flex-1 h-px bg-[oklch(0.25_0.01_250)]" />
          </div>

          {/* Email Invite */}
          <div>
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Mail size={14} className="text-[oklch(0.70_0.18_145)]" />
              שלח הזמנה במייל
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-[oklch(0.22_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none ltr"
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                className={`bg-[oklch(0.65_0.18_250)] border-none rounded-lg px-4 py-2 font-semibold text-[13px] text-[oklch(0.12_0.01_250)] flex items-center gap-1.5 ${!inviteEmail || sendingEmail ? 'opacity-50' : 'opacity-100'} ${sendingEmail ? 'cursor-wait' : 'cursor-pointer'}`}
              >
                <Send size={13} /> שלח
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Setting Card */}
        <div className="bg-[oklch(0.16_0.01_250)] border border-[oklch(0.25_0.01_250)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            פרטיות
          </h2>

          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="text-[13px] font-medium mb-1 flex items-center gap-1.5">
                {myMembership?.show_personal_to_family ? (
                  <Eye size={14} className="text-[oklch(0.70_0.15_145)]" />
                ) : (
                  <EyeOff size={14} className="text-[oklch(0.65_0.01_250)]" />
                )}
                הצג הוצאות אישיות למשפחה
              </div>
              <p className="text-[11px] text-[oklch(0.65_0.01_250)] m-0 leading-relaxed">
                כאשר מופעל, חברי המשפחה האחרים יוכלו לראות את ההוצאות האישיות שלך בדשבורד המשפחתי.
              </p>
            </div>

            {/* Toggle */}
            <button
              onClick={() => togglePrivacy.mutate(!myMembership?.show_personal_to_family)}
              disabled={togglePrivacy.isPending}
              className={`w-11 h-6 rounded-xl border-none cursor-pointer relative shrink-0 transition-colors duration-200 ${
                myMembership?.show_personal_to_family
                  ? 'bg-[oklch(0.55_0.18_145)]'
                  : 'bg-[oklch(0.25_0.01_250)]'
              }`}
              aria-label="הצג הוצאות אישיות למשפחה"
              role="switch"
              aria-checked={myMembership?.show_personal_to_family ?? false}
            >
              <div className={`w-[18px] h-[18px] rounded-full bg-[oklch(0.92_0.01_250)] absolute top-[3px] transition-all duration-200 ${
                myMembership?.show_personal_to_family ? 'end-[3px] start-auto' : 'start-[3px] end-auto'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
