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

const S = {
  card: {
    background: 'oklch(0.16 0.01 250)',
    border: '1px solid oklch(0.25 0.01 250)',
    borderRadius: 12,
    padding: 20,
  } as React.CSSProperties,
  input: {
    background: 'oklch(0.22 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)',
    borderRadius: 8,
    padding: '8px 12px',
    color: 'inherit',
    fontSize: 13,
    outline: 'none',
    width: '100%',
  } as React.CSSProperties,
  label: {
    fontSize: 11,
    color: 'oklch(0.65 0.01 250)',
    display: 'block',
    marginBottom: 4,
    fontWeight: 500,
  } as React.CSSProperties,
  badge: (color: string): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 600,
    background: `oklch(0.20 0.03 ${color})`,
    color: `oklch(0.75 0.15 ${color})`,
    border: `1px solid oklch(0.30 0.05 ${color})`,
  }),
  btn: {
    background: 'oklch(0.65 0.18 250)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    cursor: 'pointer',
    color: 'oklch(0.12 0.01 250)',
    fontWeight: 600,
    fontSize: 13,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  } as React.CSSProperties,
  btnSecondary: {
    background: 'oklch(0.22 0.01 250)',
    border: '1px solid oklch(0.28 0.01 250)',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    color: 'oklch(0.70 0.01 250)',
    fontSize: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,
}

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
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ color: 'oklch(0.65 0.01 250)', fontSize: 14 }}>לא נמצאה משפחה</div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <Users size={20} style={{ color: 'oklch(0.65 0.18 250)' }} />
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>
            הגדרות משפחה
          </h1>
        </div>
        <p style={{ fontSize: 13, color: 'oklch(0.65 0.01 250)', margin: 0 }}>
          {family.name}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Family Info Card */}
        <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, margin: '0 0 16px' }}>
            פרטי המשפחה
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Family Name */}
            <div>
              <div style={S.label}>שם משפחה</div>
              {editingName ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    style={{ ...S.input, width: 'auto', flex: 1 }}
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nameValue.trim()) updateName.mutate(nameValue.trim())
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                  />
                  <button
                    onClick={() => nameValue.trim() && updateName.mutate(nameValue.trim())}
                    disabled={updateName.isPending}
                    style={{ ...S.btn, padding: '8px 12px' }}
                    aria-label="שמור"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    style={{ ...S.btnSecondary, padding: '8px' }}
                    aria-label="ביטול"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 500 }}>{family.name}</span>
                  {isAdmin && (
                    <button
                      onClick={() => { setNameValue(family.name); setEditingName(true) }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'oklch(0.65 0.01 250)', padding: 4 }}
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
              <div style={S.label}>קוד הזמנה</div>
              <span style={{
                fontSize: 13, fontFamily: 'monospace', letterSpacing: '0.05em',
                color: 'oklch(0.65 0.18 250)', direction: 'ltr', display: 'inline-block',
              }}>
                {family.invite_code}
              </span>
            </div>

            {/* Created Date */}
            <div>
              <div style={S.label}>תאריך יצירה</div>
              <span style={{ fontSize: 13, color: 'oklch(0.65 0.01 250)' }}>
                {formatDate(family.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Members List Card */}
        <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            חברי משפחה
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {members.map(member => {
              const isMe = member.user_id === user?.id
              const isMemberAdmin = member.role === 'admin'
              return (
                <div
                  key={member.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isMe ? 'oklch(0.20 0.02 250)' : 'oklch(0.13 0.01 250)',
                    border: isMe ? '1px solid oklch(0.30 0.04 250)' : '1px solid oklch(0.22 0.01 250)',
                  }}
                >
                  {/* Avatar placeholder */}
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: isMemberAdmin ? 'oklch(0.25 0.06 145)' : 'oklch(0.25 0.04 250)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Users size={14} style={{
                      color: isMemberAdmin ? 'oklch(0.70 0.15 145)' : 'oklch(0.65 0.12 250)',
                    }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {member.user_id.slice(0, 8)}...
                        {isMe && (
                          <span style={{ color: 'oklch(0.65 0.01 250)', fontWeight: 400 }}> (את/ה)</span>
                        )}
                      </span>
                      <span style={isMemberAdmin ? S.badge('145') : S.badge('250')}>
                        {isMemberAdmin ? (
                          <><Shield size={10} /> מנהל</>
                        ) : 'חבר'}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', marginTop: 2 }}>
                      הצטרף/ה {formatDate(member.joined_at)}
                    </div>
                  </div>

                  {/* Delete button (admin only, not for admins) */}
                  {isAdmin && !isMemberAdmin && (
                    <>
                      {confirmDeleteId === member.id ? (
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => removeMember.mutate(member.id)}
                            disabled={removeMember.isPending}
                            style={{
                              background: 'oklch(0.25 0.08 25)',
                              border: '1px solid oklch(0.35 0.10 25)',
                              borderRadius: 6, padding: '4px 10px',
                              color: 'oklch(0.75 0.15 25)', fontSize: 11, fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            אישור
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            style={{
                              background: 'none',
                              border: '1px solid oklch(0.25 0.01 250)',
                              borderRadius: 6, padding: '4px 8px',
                              color: 'oklch(0.65 0.01 250)', fontSize: 11,
                              cursor: 'pointer',
                            }}
                          >
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(member.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'oklch(0.65 0.01 250)', padding: 6,
                          }}
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
        <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            הזמנת חברי משפחה
          </h2>

          {/* Copy Link */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Link2 size={14} style={{ color: 'oklch(0.65 0.18 250)' }} />
              שתף לינק הזמנה
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family.invite_code}`}
                style={{ ...S.input, direction: 'ltr' as const, color: 'oklch(0.70 0.01 250)', fontSize: 12 }}
              />
              <button onClick={copyInviteLink} style={S.btnSecondary}>
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <div style={{ flex: 1, height: 1, background: 'oklch(0.25 0.01 250)' }} />
            <span style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)' }}>או</span>
            <div style={{ flex: 1, height: 1, background: 'oklch(0.25 0.01 250)' }} />
          </div>

          {/* Email Invite */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Mail size={14} style={{ color: 'oklch(0.70 0.18 145)' }} />
              שלח הזמנה במייל
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                style={{ ...S.input, direction: 'ltr' as const }}
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                style={{
                  ...S.btn,
                  opacity: !inviteEmail || sendingEmail ? 0.5 : 1,
                  cursor: sendingEmail ? 'wait' : 'pointer',
                }}
              >
                <Send size={13} /> שלח
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Setting Card */}
        <div style={S.card}>
          <h2 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 16px' }}>
            פרטיות
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                {myMembership?.show_personal_to_family ? (
                  <Eye size={14} style={{ color: 'oklch(0.70 0.15 145)' }} />
                ) : (
                  <EyeOff size={14} style={{ color: 'oklch(0.65 0.01 250)' }} />
                )}
                הצג הוצאות אישיות למשפחה
              </div>
              <p style={{ fontSize: 11, color: 'oklch(0.65 0.01 250)', margin: 0, lineHeight: 1.5 }}>
                כאשר מופעל, חברי המשפחה האחרים יוכלו לראות את ההוצאות האישיות שלך בדשבורד המשפחתי.
              </p>
            </div>

            {/* Toggle */}
            <button
              onClick={() => togglePrivacy.mutate(!myMembership?.show_personal_to_family)}
              disabled={togglePrivacy.isPending}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none',
                background: myMembership?.show_personal_to_family
                  ? 'oklch(0.55 0.18 145)'
                  : 'oklch(0.25 0.01 250)',
                cursor: 'pointer', position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
              }}
              aria-label="הצג הוצאות אישיות למשפחה"
              role="switch"
              aria-checked={myMembership?.show_personal_to_family ?? false}
            >
              <div style={{
                width: 18, height: 18, borderRadius: '50%',
                background: 'oklch(0.92 0.01 250)',
                position: 'absolute', top: 3,
                right: myMembership?.show_personal_to_family ? 3 : 'auto',
                left: myMembership?.show_personal_to_family ? 'auto' : 3,
                transition: 'all 0.2s',
              }} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
