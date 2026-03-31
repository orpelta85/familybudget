'use client'

import { useFamilyContext } from '@/lib/context/FamilyContext'
import { useUser } from '@/lib/queries/useUser'
import { createClient } from '@/lib/supabase/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Users, Copy, Mail, Send, X, Link2, Pencil, Check, Shield, Eye, EyeOff, BarChart3, Sparkles, Key, Trash2,
  Sun, Moon,
} from 'lucide-react'
import type { PrivacyMode } from '@/lib/types'
import { useTheme } from '@/contexts/ThemeContext'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { useConfirmDialog } from '@/components/ui/ConfirmDialog'
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
  const { theme, setTheme } = useTheme()
  const confirm = useConfirmDialog()

  const [editingName, setEditingName] = useState(false)
  const [nameValue, setNameValue] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [aiApiKey, setAiApiKey] = useState('')
  const [aiKeyDraft, setAiKeyDraft] = useState('')
  const [showAiKeyInput, setShowAiKeyInput] = useState(false)

  // Load stored AI API key
  useEffect(() => {
    setAiApiKey(localStorage.getItem('oren_gemini_api_key') ?? '')
  }, [])

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

  const updatePrivacy = useMutation({
    mutationFn: async (mode: PrivacyMode) => {
      const sb = createClient()
      const { error } = await sb
        .from('family_members')
        .update({
          privacy_mode: mode,
          show_personal_to_family: mode === 'full_access',
        })
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
    } catch (e) {
      console.error('Send family invite:', e)
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
        <div className="text-[var(--text-secondary)] text-sm">לא נמצאה משפחה</div>
      </div>
    )
  }

  return (
    <div className="max-w-[680px] mx-auto">
      {/* Header */}
      <div className="mb-7">
        <div className="flex items-center gap-2.5 mb-1">
          <Users size={20} className="text-[var(--accent-blue)]" />
          <h1 className="text-[22px] font-bold tracking-tight m-0">
            הגדרות משפחה
          </h1>
          <PageInfo {...PAGE_TIPS.family} />
        </div>
        <p className="text-[13px] text-[var(--text-secondary)] m-0">
          {family.name}
        </p>
        <a href="#privacy" className="md:hidden inline-flex items-center gap-1 mt-2 text-[11px] text-[var(--accent-blue)] no-underline">
          <Shield size={11} /> הגדרות פרטיות ↓
        </a>
      </div>

      <div className="flex flex-col gap-4">
        {/* Family Info Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            פרטי המשפחה
          </h2>

          <div className="flex flex-col gap-3.5">
            {/* Family Name */}
            <div>
              <div className="text-[11px] text-[var(--text-secondary)] block mb-1 font-medium">שם משפחה</div>
              {editingName ? (
                <div className="flex gap-2">
                  <input
                    value={nameValue}
                    onChange={e => setNameValue(e.target.value)}
                    className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none"
                    autoFocus
                    onKeyDown={e => {
                      if (e.key === 'Enter' && nameValue.trim()) updateName.mutate(nameValue.trim())
                      if (e.key === 'Escape') setEditingName(false)
                    }}
                  />
                  <button
                    onClick={() => nameValue.trim() && updateName.mutate(nameValue.trim())}
                    disabled={updateName.isPending}
                    className="bg-[var(--accent-blue)] border-none rounded-lg px-3 py-2 cursor-pointer text-[var(--c-0-10)] font-semibold text-[13px] flex items-center gap-1.5"
                    aria-label="שמור"
                  >
                    <Check size={14} />
                  </button>
                  <button
                    onClick={() => setEditingName(false)}
                    className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-2 py-2 cursor-pointer text-[var(--c-0-70)] text-xs flex items-center gap-1"
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
                      className="bg-transparent border-none cursor-pointer text-[var(--text-secondary)] p-1"
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
              <div className="text-[11px] text-[var(--text-secondary)] block mb-1 font-medium">קוד הזמנה</div>
              <span className="text-[13px] font-mono tracking-[0.05em] text-[var(--accent-blue)] ltr inline-block">
                {family.invite_code}
              </span>
            </div>

            {/* Created Date */}
            <div>
              <div className="text-[11px] text-[var(--text-secondary)] block mb-1 font-medium">תאריך יצירה</div>
              <span className="text-[13px] text-[var(--text-secondary)]">
                {formatDate(family.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Members List Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
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
                      ? 'bg-[var(--c-blue-0-20)] border border-[var(--c-blue-0-30)]'
                      : 'bg-[var(--bg-base)] border border-[var(--bg-hover)]'
                  }`}
                >
                  {/* Avatar placeholder */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isMemberAdmin ? 'bg-[var(--c-green-0-25)]' : 'bg-[var(--c-blue-0-25)]'
                  }`}>
                    <Users size={14} className={isMemberAdmin ? 'text-[var(--c-green-0-70)]' : 'text-[var(--accent-blue)]'} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-medium">
                        {member.user_id.slice(0, 8)}...
                        {isMe && (
                          <span className="text-[var(--text-secondary)] font-normal"> (את/ה)</span>
                        )}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                        isMemberAdmin
                          ? 'bg-[var(--c-green-0-20)] text-[var(--c-green-0-75)] border-[var(--c-green-0-30)]'
                          : 'bg-[var(--c-blue-0-20)] text-[var(--c-blue-0-75)] border-[var(--c-blue-0-30)]'
                      }`}>
                        {isMemberAdmin ? (
                          <><Shield size={10} /> מנהל</>
                        ) : 'חבר'}
                      </span>
                    </div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">
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
                            className="bg-[var(--c-red-0-25)] border border-[var(--c-red-0-35)] rounded-md px-2.5 py-1 text-[var(--c-red-0-75)] text-[11px] font-semibold cursor-pointer"
                          >
                            אישור
                          </button>
                          <button
                            onClick={() => setConfirmDeleteId(null)}
                            className="bg-transparent border border-[var(--border-default)] rounded-md px-2 py-1 text-[var(--text-secondary)] text-[11px] cursor-pointer"
                          >
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteId(member.id)}
                          className="bg-transparent border-none cursor-pointer text-[var(--text-secondary)] p-1.5"
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
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            הזמנת חברי משפחה
          </h2>

          {/* Copy Link */}
          <div className="mb-5">
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Link2 size={14} className="text-[var(--accent-blue)]" />
              שתף לינק הזמנה
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/login?invite=${family.invite_code}`}
                className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-xs outline-none ltr text-[var(--c-0-70)]"
              />
              <button onClick={copyInviteLink} className="bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 cursor-pointer text-[var(--c-0-70)] text-xs flex items-center gap-1">
                <Copy size={13} /> העתק
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-[var(--border-default)]" />
            <span className="text-[11px] text-[var(--text-secondary)]">או</span>
            <div className="flex-1 h-px bg-[var(--border-default)]" />
          </div>

          {/* Email Invite */}
          <div>
            <div className="text-[13px] font-semibold mb-2 flex items-center gap-1.5">
              <Mail size={14} className="text-[var(--accent-green)]" />
              שלח הזמנה במייל
            </div>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@example.com"
                className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none ltr"
                onKeyDown={e => { if (e.key === 'Enter') sendInviteEmail() }}
              />
              <button
                onClick={sendInviteEmail}
                disabled={!inviteEmail || sendingEmail}
                className={`bg-[var(--accent-blue)] border-none rounded-lg px-4 py-2 font-semibold text-[13px] text-[var(--c-0-10)] flex items-center gap-1.5 ${!inviteEmail || sendingEmail ? 'opacity-50' : 'opacity-100'} ${sendingEmail ? 'cursor-wait' : 'cursor-pointer'}`}
              >
                <Send size={13} /> שלח
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Setting Card */}
        <div id="privacy" className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5 scroll-mt-4">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            פרטיות
          </h2>
          <p className="text-[11px] text-[var(--text-secondary)] m-0 mb-4 leading-relaxed">
            בחר/י מה חברי המשפחה האחרים יראו מהנתונים האישיים שלך.
          </p>

          <div className="flex flex-col gap-2">
            {([
              {
                mode: 'full_access' as PrivacyMode,
                icon: Eye,
                iconColor: 'text-[var(--c-green-0-70)]',
                label: 'גישה מלאה',
                desc: 'בן/בת הזוג רואה הכל - כולל פירוט עסקאות והכנסות',
              },
              {
                mode: 'summary_only' as PrivacyMode,
                icon: BarChart3,
                iconColor: 'text-[var(--accent-blue)]',
                label: 'סיכום בלבד',
                desc: 'סכומים לפי קטגוריה, בלי פירוט עסקאות בודדות',
              },
              {
                mode: 'hidden' as PrivacyMode,
                icon: EyeOff,
                iconColor: 'text-[var(--text-secondary)]',
                label: 'מוסתר',
                desc: 'רק הסכום הכולל נראה בתמונה המשפחתית',
              },
            ]).map(opt => {
              const Icon = opt.icon
              const isActive = (myMembership?.privacy_mode ?? 'summary_only') === opt.mode
              return (
                <button
                  key={opt.mode}
                  onClick={async () => {
                    if (isActive) return
                    const ok = await confirm({ message: `לשנות מצב פרטיות ל"${opt.label}"?`, confirmText: 'שנה', cancelText: 'ביטול' })
                    if (ok) updatePrivacy.mutate(opt.mode)
                  }}
                  disabled={updatePrivacy.isPending}
                  aria-pressed={isActive}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-right cursor-pointer transition-colors border ${
                    isActive
                      ? 'bg-[var(--c-blue-0-20)] border-[var(--c-blue-0-40)]'
                      : 'bg-[var(--bg-base)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isActive ? 'bg-[var(--c-blue-0-30)]' : 'bg-[var(--bg-hover)]'
                  }`}>
                    <Icon size={16} className={isActive ? 'text-[var(--accent-blue)]' : opt.iconColor} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-medium">{opt.label}</div>
                    <div className="text-[11px] text-[var(--text-secondary)] mt-0.5">{opt.desc}</div>
                  </div>
                  {isActive && (
                    <div className="w-2 h-2 rounded-full bg-[var(--accent-blue)] shrink-0" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Theme Toggle Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0">
            מצב תצוגה
          </h2>

          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer border ${
                theme === 'light'
                  ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                  : 'bg-[var(--c-0-20)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Sun size={15} />
              בהיר
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-medium transition-colors cursor-pointer border ${
                theme === 'dark'
                  ? 'bg-[var(--accent-blue)] text-white border-[var(--accent-blue)]'
                  : 'bg-[var(--c-0-20)] text-[var(--text-secondary)] border-[var(--border-default)] hover:bg-[var(--bg-hover)]'
              }`}
            >
              <Moon size={15} />
              כהה
            </button>
          </div>
        </div>

        {/* AI Advisor Settings Card */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-5">
          <h2 className="text-sm font-semibold mb-4 mt-0 flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--c-green-0-75)]" />
            יועץ AI מתקדם
          </h2>

          <div className="flex flex-col gap-4">
            {/* Free tips status */}
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-[var(--c-green-0-65)]" />
              <span className="text-[13px] text-[var(--text-body)]">
                טיפים בסיסיים: <span className="font-semibold text-[var(--c-green-0-75)]">פעיל (חינם)</span>
              </span>
            </div>

            {/* API key status & management */}
            <div className="flex items-center gap-3">
              <div className={`w-2 h-2 rounded-full ${aiApiKey ? 'bg-[var(--c-green-0-65)]' : 'bg-[var(--c-0-40)]'}`} />
              <span className="text-[13px] text-[var(--text-body)]">
                צ'אט מתקדם: {aiApiKey ? (
                  <span className="font-semibold text-[var(--c-green-0-75)]">מחובר</span>
                ) : (
                  <span className="text-[var(--text-muted)]">לא מחובר</span>
                )}
              </span>
            </div>

            {/* Key input or status */}
            {aiApiKey ? (
              <div className="flex items-center justify-between bg-[var(--bg-base)] border border-[var(--bg-hover)] rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <Key size={13} className="text-[var(--text-muted)]" />
                  <span className="text-[12px] text-[var(--text-muted)] ltr" dir="ltr">
                    {aiApiKey.slice(0, 8)}...{aiApiKey.slice(-4)}
                  </span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('oren_gemini_api_key')
                    setAiApiKey('')
                    toast.success('API Key הוסר')
                  }}
                  className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1 hover:text-[var(--c-red-0-70)]"
                  aria-label="הסר API Key"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ) : showAiKeyInput ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={aiKeyDraft}
                    onChange={e => setAiKeyDraft(e.target.value)}
                    placeholder="AIza..."
                    className="flex-1 bg-[var(--bg-hover)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-inherit text-[13px] outline-none ltr"
                    dir="ltr"
                    onKeyDown={e => {
                      if (e.key === 'Enter' && aiKeyDraft.trim()) {
                        localStorage.setItem('oren_gemini_api_key', aiKeyDraft.trim())
                        setAiApiKey(aiKeyDraft.trim())
                        setAiKeyDraft('')
                        setShowAiKeyInput(false)
                        toast.success('API Key נשמר בהצלחה')
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (aiKeyDraft.trim()) {
                        localStorage.setItem('oren_gemini_api_key', aiKeyDraft.trim())
                        setAiApiKey(aiKeyDraft.trim())
                        setAiKeyDraft('')
                        setShowAiKeyInput(false)
                        toast.success('API Key נשמר בהצלחה')
                      }
                    }}
                    disabled={!aiKeyDraft.trim()}
                    className="bg-[var(--c-green-0-55)] border-none rounded-lg px-3 py-2 cursor-pointer text-[var(--c-0-10)] font-semibold text-[12px] disabled:opacity-50"
                  >
                    שמור
                  </button>
                </div>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[var(--c-blue-0-60)] underline"
                >
                  קבל API key בחינם מ-Google AI Studio
                </a>
              </div>
            ) : (
              <button
                onClick={() => setShowAiKeyInput(true)}
                className="flex items-center justify-center gap-2 bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-4 py-2.5 cursor-pointer text-[var(--c-0-70)] text-[13px] font-medium hover:bg-[var(--bg-hover)] transition-colors"
              >
                <Key size={14} />
                חבר Google Gemini API Key
              </button>
            )}

            <p className="text-[11px] text-[var(--c-0-50)] m-0 leading-relaxed">
              ה-API Key נשמר מקומית בדפדפן שלך בלבד ולא נשלח לשרתים שלנו.
              הוא משמש לתקשורת ישירה עם Google Gemini.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
