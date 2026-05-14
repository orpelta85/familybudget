'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/queries/useUser'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Download, Trash2, Users, FileText, Shield, LogOut, AlertTriangle,
} from 'lucide-react'
import { TableSkeleton } from '@/components/ui/Skeleton'

export default function SettingsPage() {
  const { user, loading } = useUser()
  const router = useRouter()
  const [exporting, setExporting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  if (loading) return <TableSkeleton rows={6} />
  if (!user) {
    router.push('/login')
    return null
  }

  async function handleExport() {
    setExporting(true)
    try {
      const res = await fetch('/api/account/export')
      if (!res.ok) throw new Error('export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `familyplan-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('הנתונים יוצאו בהצלחה')
    } catch (e) {
      console.error('Export error:', e)
      toast.error('שגיאה בייצוא נתונים')
    }
    setExporting(false)
  }

  async function handleDelete() {
    if (deleteText !== 'מחק') {
      toast.error('הקלד "מחק" כדי לאשר')
      return
    }
    setDeleting(true)
    try {
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'delete failed')
      }
      const sb = createClient()
      await sb.auth.signOut()
      toast.success('החשבון נמחק')
      router.push('/login')
    } catch (e) {
      console.error('Delete account error:', e)
      const msg = e instanceof Error ? e.message : 'שגיאה במחיקת חשבון'
      toast.error(msg)
    }
    setDeleting(false)
  }

  async function handleSignOut() {
    const sb = createClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">הגדרות חשבון</h1>
        <p className="text-[var(--text-secondary)] text-[13px] mt-1">
          {user.email}
        </p>
      </div>

      <div className="space-y-3">
        {/* Family settings link */}
        <Link
          href="/family"
          className="block bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--c-blue-0-22)] flex items-center justify-center shrink-0">
              <Users size={18} className="text-[var(--accent-blue)]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">הגדרות משפחה</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                ניהול בני משפחה, קוד הזמנה, הרשאות
              </div>
            </div>
          </div>
        </Link>

        {/* Data export */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--c-green-0-22)] flex items-center justify-center shrink-0">
              <Download size={18} className="text-[var(--accent-green)]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">ייצוא נתונים</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                הורד את כל הנתונים שלך כקובץ JSON
              </div>
            </div>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="bg-[var(--accent-green)] text-[var(--c-0-10)] border-none rounded-lg py-2 px-4 cursor-pointer text-[13px] font-semibold disabled:opacity-50"
            >
              {exporting ? 'מייצא...' : 'הורד'}
            </button>
          </div>
        </div>

        {/* Legal links */}
        <div className="bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--c-0-22)] flex items-center justify-center shrink-0">
              <FileText size={18} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">משפטי</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                תנאי שימוש, מדיניות פרטיות
              </div>
            </div>
          </div>
          <div className="flex gap-3 text-[13px]">
            <Link href="/terms" className="text-[var(--primary)] underline">
              תנאי שימוש
            </Link>
            <span className="text-[var(--text-secondary)]">·</span>
            <Link href="/privacy" className="text-[var(--primary)] underline">
              מדיניות פרטיות
            </Link>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full bg-[var(--bg-card)] border border-[var(--border-default)] rounded-xl p-4 cursor-pointer text-right hover:bg-[var(--bg-hover)] transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--c-0-22)] flex items-center justify-center shrink-0">
              <LogOut size={18} className="text-[var(--text-secondary)]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px]">התנתקות</div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                יציאה מהחשבון
              </div>
            </div>
          </div>
        </button>

        {/* Danger zone */}
        <div className="bg-[var(--bg-card)] border border-[var(--c-red-0-30)] rounded-xl p-4 mt-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[var(--c-red-0-22)] flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-[var(--c-red-0-65)]" />
            </div>
            <div className="flex-1">
              <div className="font-semibold text-[14px] text-[var(--c-red-0-65)]">
                מחיקת חשבון
              </div>
              <div className="text-[12px] text-[var(--text-secondary)]">
                מחיקה תמחק את כל הנתונים שלך לצמיתות - לא ניתן לשחזר
              </div>
            </div>
          </div>
          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-transparent text-[var(--c-red-0-65)] border border-[var(--c-red-0-30)] rounded-lg py-2 px-4 cursor-pointer text-[13px] font-semibold flex items-center gap-1.5"
            >
              <Trash2 size={14} />
              מחק את החשבון שלי
            </button>
          ) : (
            <div className="mt-3 p-3 bg-[var(--c-red-0-22)] border border-[var(--c-red-0-30)] rounded-lg">
              <div className="text-[13px] mb-2 font-medium">
                לאישור, הקלד <span className="font-mono font-bold">מחק</span> בשדה למטה
              </div>
              <input
                type="text"
                value={deleteText}
                onChange={e => setDeleteText(e.target.value)}
                placeholder="מחק"
                className="w-full bg-[var(--bg-hover)] border border-[var(--c-red-0-30)] rounded-lg py-2 px-3 text-inherit text-[13px] outline-none mb-3"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting || deleteText !== 'מחק'}
                  className="bg-[var(--c-red-0-65)] text-[var(--c-0-10)] border-none rounded-lg py-2 px-4 cursor-pointer text-[13px] font-semibold disabled:opacity-50"
                >
                  {deleting ? 'מוחק...' : 'מחק לצמיתות'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                  disabled={deleting}
                  className="bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] rounded-lg py-2 px-4 cursor-pointer text-[13px]"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[11px] text-[var(--text-secondary)] mt-6 pb-4 flex items-center justify-center gap-1.5">
          <Shield size={11} />
          הנתונים שלך מאוחסנים מוצפנים ב-Supabase
        </div>
      </div>
    </div>
  )
}
