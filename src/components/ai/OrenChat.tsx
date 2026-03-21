'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Key, AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react'
import Image from 'next/image'
import type { OrenTip } from '@/lib/ai/oren-tips'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface OrenChatProps {
  open: boolean
  onClose: () => void
  tips: OrenTip[]
  onTipSeen: (id: string) => void
  financialContext: string
}

const API_KEY_STORAGE = 'oren_gemini_api_key'

const tipIcons: Record<OrenTip['type'], typeof AlertTriangle> = {
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
  suggestion: Lightbulb,
}

const tipColors: Record<OrenTip['type'], { bg: string; border: string; text: string; icon: string }> = {
  warning: {
    bg: 'bg-[var(--c-orange-0-18)]',
    border: 'border-[var(--c-orange-0-30)]',
    text: 'text-[var(--c-orange-0-80)]',
    icon: 'text-[var(--c-orange-0-75)]',
  },
  success: {
    bg: 'bg-[var(--c-green-0-18)]',
    border: 'border-[var(--c-green-0-30)]',
    text: 'text-[var(--c-green-0-80)]',
    icon: 'text-[var(--c-green-0-75)]',
  },
  info: {
    bg: 'bg-[var(--c-blue-0-18)]',
    border: 'border-[var(--c-blue-0-30)]',
    text: 'text-[var(--c-blue-0-80)]',
    icon: 'text-[var(--c-blue-0-75)]',
  },
  suggestion: {
    bg: 'bg-[var(--c-purple-0-18)]',
    border: 'border-[var(--c-purple-0-30)]',
    text: 'text-[var(--c-purple-0-80)]',
    icon: 'text-[var(--c-purple-0-75)]',
  },
}

// Maps tip type to objectPosition for the oren-poses.png sprite
// Poses left to right: happy (0%), worried (28%), sleeping (55%), celebrating (80%)
const tipPosePosition: Record<OrenTip['type'], string> = {
  warning: '28% 20%',     // worried pose
  success: '0% 20%',      // happy/thumbs up pose
  info: '55% 20%',        // sleeping/thinking pose
  suggestion: '80% 20%',  // celebrating/waving pose
}

function OrenMiniAvatar({ className }: { className?: string }) {
  return (
    <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 border border-[var(--c-green-0-35)] ${className ?? ''}`}>
      <Image
        src="/mascot/oren-poses.png"
        alt="אורן"
        width={56}
        height={56}
        className="w-full h-full object-cover"
        style={{ objectPosition: '5% 15%' }}
      />
    </div>
  )
}

function OrenTipPose({ type }: { type: OrenTip['type'] }) {
  return (
    <div className="w-7 h-7 rounded-full overflow-hidden shrink-0 mt-0.5 border border-[var(--c-green-0-35)]">
      <Image
        src="/mascot/oren-poses.png"
        alt="אורן"
        width={56}
        height={56}
        className="w-full h-full object-cover"
        style={{ objectPosition: tipPosePosition[type] }}
      />
    </div>
  )
}

export function OrenChat({ open, onClose, tips, onTipSeen, financialContext }: OrenChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [apiKey, setApiKey] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [keyDraft, setKeyDraft] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(API_KEY_STORAGE) ?? ''
      setApiKey(stored)
    }
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, tips])

  // Mark tips as seen when chat opens
  useEffect(() => {
    if (open) {
      tips.filter(t => !t.seen).forEach(t => onTipSeen(t.id))
    }
  }, [open, tips, onTipSeen])

  // Focus input when opened
  useEffect(() => {
    if (open && apiKey) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open, apiKey])

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMsg: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setSending(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          context: financialContext,
          apiKey,
          history: messages.slice(-10),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.error || 'שגיאה בתקשורת עם AI' },
        ])
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: data.reply },
        ])
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'שגיאה בחיבור לשרת. נסה שוב.' },
      ])
    }

    setSending(false)
  }, [input, sending, apiKey, financialContext, messages])

  function saveApiKey() {
    const key = keyDraft.trim()
    if (key) {
      localStorage.setItem(API_KEY_STORAGE, key)
      setApiKey(key)
      setShowKeyInput(false)
      setKeyDraft('')
    }
  }

  function removeApiKey() {
    localStorage.removeItem(API_KEY_STORAGE)
    setApiKey('')
    setMessages([])
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-start">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-[oklch(0_0_0/0.5)]"
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="relative w-full md:w-[400px] md:max-w-[90vw] h-[85vh] md:h-[600px] md:max-h-[80vh] md:mr-4 md:mb-0 bg-[var(--bg-base)] md:rounded-xl rounded-t-xl overflow-hidden flex flex-col shadow-[0_-4px_40px_oklch(0_0_0/0.5)] animate-slideUp md:ml-4"
        style={{ animationDuration: '200ms' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-hover)] bg-[var(--c-0-15)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-[var(--c-green-0-35)]">
              <Image
                src="/mascot/oren-poses.png"
                alt="אורן"
                width={72}
                height={72}
                className="w-full h-full object-cover"
                style={{ objectPosition: '5% 15%' }}
              />
            </div>
            <div>
              <div className="text-sm font-semibold">אורן</div>
              <div className="text-[10px] text-[var(--text-muted)]">היועץ הפיננסי שלך</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-[var(--text-muted)] p-1.5 rounded-lg hover:bg-[var(--c-0-20)] transition-colors"
            aria-label="סגור צ'אט"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Welcome message with happy Oren */}
          <div className="flex gap-2.5 items-start">
            <OrenMiniAvatar />
            <div className="bg-[var(--c-green-0-18)] border border-[var(--c-green-0-25)] rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]">
              <p className="text-[13px] leading-relaxed m-0 text-[var(--c-green-0-80)]">
                שלום! אני אורן, היועץ הפיננסי שלך.
                <br />
                אני כאן כדי לעזור לך לנהל את הכסף בצורה חכמה!
              </p>
            </div>
          </div>

          {/* Tips with pose-specific avatars */}
          {tips.map(tip => {
            const colors = tipColors[tip.type]
            const TipIcon = tipIcons[tip.type]
            return (
              <div key={tip.id} className="flex gap-2.5 items-start">
                <OrenTipPose type={tip.type} />
                <div className={`${colors.bg} border ${colors.border} rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <TipIcon size={13} className={colors.icon} />
                    <span className={`text-[11px] font-semibold ${colors.text}`}>
                      {tip.type === 'warning' ? 'שימו לב' : tip.type === 'success' ? 'כל הכבוד!' : tip.type === 'info' ? 'לידיעתך' : 'הצעה'}
                    </span>
                  </div>
                  <p className={`text-[13px] leading-relaxed m-0 ${colors.text}`}>
                    {tip.message}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Chat messages */}
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2.5 items-start ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <OrenMiniAvatar />
              )}
              <div
                className={`rounded-xl px-3.5 py-2.5 max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-[var(--c-blue-0-25)] border border-[var(--c-blue-0-32)] rounded-tl-sm'
                    : 'bg-[var(--c-green-0-18)] border border-[var(--c-green-0-25)] rounded-tr-sm'
                }`}
              >
                <p className={`text-[13px] leading-relaxed m-0 whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-[var(--c-0-88)]'
                    : 'text-[var(--c-green-0-80)]'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-2.5 items-start">
              <OrenMiniAvatar />
              <div className="bg-[var(--c-green-0-18)] border border-[var(--c-green-0-25)] rounded-xl rounded-tr-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[var(--c-green-0-55)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--c-green-0-55)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[var(--c-green-0-55)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* API Key prompt or input area */}
        <div className="shrink-0 border-t border-[var(--bg-hover)] bg-[var(--c-0-14)]">
          {!apiKey ? (
            <div className="p-4">
              {showKeyInput ? (
                <div className="flex flex-col gap-2">
                  <div className="text-[12px] text-[var(--text-secondary)]">
                    הזן Google Gemini API Key:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={keyDraft}
                      onChange={e => setKeyDraft(e.target.value)}
                      placeholder="AIza..."
                      className="flex-1 bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-3 py-2 text-[13px] text-inherit outline-none ltr"
                      dir="ltr"
                      onKeyDown={e => { if (e.key === 'Enter') saveApiKey() }}
                    />
                    <button
                      onClick={saveApiKey}
                      disabled={!keyDraft.trim()}
                      className="bg-[var(--c-green-0-55)] border-none rounded-lg px-3 py-2 text-[var(--c-0-10)] font-semibold text-[12px] cursor-pointer disabled:opacity-50"
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
                  onClick={() => setShowKeyInput(true)}
                  className="w-full flex items-center justify-center gap-2 bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-4 py-3 cursor-pointer text-[var(--c-0-70)] text-[13px] font-medium hover:bg-[var(--bg-hover)] transition-colors"
                >
                  <Key size={14} />
                  חבר API Key כדי לשוחח עם אורן
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="flex gap-2 p-3">
                <input
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                  placeholder="שאל את אורן..."
                  disabled={sending}
                  className="flex-1 bg-[var(--c-0-20)] border border-[var(--border-light)] rounded-lg px-3.5 py-2.5 text-[13px] text-inherit outline-none placeholder:text-[var(--c-0-45)] disabled:opacity-60"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="bg-[var(--c-green-0-55)] border-none rounded-lg px-3 py-2 cursor-pointer text-[var(--c-0-10)] disabled:opacity-40 transition-opacity"
                  aria-label="שלח"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-[var(--c-0-45)]">
                <span className="flex items-center gap-1">
                  מופעל על ידי Gemini Flash
                </span>
                <button
                  onClick={removeApiKey}
                  className="bg-transparent border-none cursor-pointer text-[var(--c-0-45)] text-[10px] underline hover:text-[var(--c-0-60)]"
                >
                  הסר API Key
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
