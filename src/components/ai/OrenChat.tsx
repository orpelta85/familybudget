'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { X, Send, Sparkles, Key, AlertTriangle, CheckCircle2, Info, Lightbulb } from 'lucide-react'
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
    bg: 'bg-[oklch(0.18_0.04_60)]',
    border: 'border-[oklch(0.30_0.08_60)]',
    text: 'text-[oklch(0.80_0.12_60)]',
    icon: 'text-[oklch(0.75_0.15_60)]',
  },
  success: {
    bg: 'bg-[oklch(0.18_0.04_145)]',
    border: 'border-[oklch(0.30_0.08_145)]',
    text: 'text-[oklch(0.80_0.12_145)]',
    icon: 'text-[oklch(0.75_0.15_145)]',
  },
  info: {
    bg: 'bg-[oklch(0.18_0.04_250)]',
    border: 'border-[oklch(0.30_0.08_250)]',
    text: 'text-[oklch(0.80_0.12_250)]',
    icon: 'text-[oklch(0.75_0.15_250)]',
  },
  suggestion: {
    bg: 'bg-[oklch(0.18_0.04_290)]',
    border: 'border-[oklch(0.30_0.08_290)]',
    text: 'text-[oklch(0.80_0.12_290)]',
    icon: 'text-[oklch(0.75_0.15_290)]',
  },
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
    if (!trimmed || sending || !apiKey) return

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
        className="relative w-full md:w-[400px] md:max-w-[90vw] h-[85vh] md:h-[600px] md:max-h-[80vh] md:mr-4 md:mb-0 bg-[oklch(0.13_0.01_250)] md:rounded-xl rounded-t-xl overflow-hidden flex flex-col shadow-[0_-4px_40px_oklch(0_0_0/0.5)] animate-slideUp md:ml-4"
        style={{ animationDuration: '200ms' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[oklch(0.22_0.01_250)] bg-[oklch(0.15_0.01_250)] shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[oklch(0.25_0.08_145)] flex items-center justify-center">
              <Sparkles size={16} className="text-[oklch(0.75_0.15_145)]" />
            </div>
            <div>
              <div className="text-sm font-semibold">אורן</div>
              <div className="text-[10px] text-[oklch(0.55_0.01_250)]">היועץ הפיננסי שלך</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="bg-transparent border-none cursor-pointer text-[oklch(0.55_0.01_250)] p-1.5 rounded-lg hover:bg-[oklch(0.20_0.01_250)] transition-colors"
            aria-label="סגור צ'אט"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Welcome message */}
          <div className="flex gap-2.5 items-start">
            <div className="w-7 h-7 rounded-full bg-[oklch(0.25_0.08_145)] flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={12} className="text-[oklch(0.75_0.15_145)]" />
            </div>
            <div className="bg-[oklch(0.18_0.03_145)] border border-[oklch(0.25_0.05_145)] rounded-xl rounded-tr-sm px-3.5 py-2.5 max-w-[85%]">
              <p className="text-[13px] leading-relaxed m-0 text-[oklch(0.85_0.03_145)]">
                שלום! אני אורן, היועץ הפיננסי שלך. 👋
                <br />
                אני כאן כדי לעזור לך לנהל את הכסף בצורה חכמה!
              </p>
            </div>
          </div>

          {/* Tips */}
          {tips.map(tip => {
            const colors = tipColors[tip.type]
            const TipIcon = tipIcons[tip.type]
            return (
              <div key={tip.id} className="flex gap-2.5 items-start">
                <div className="w-7 h-7 rounded-full bg-[oklch(0.25_0.08_145)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={12} className="text-[oklch(0.75_0.15_145)]" />
                </div>
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
                <div className="w-7 h-7 rounded-full bg-[oklch(0.25_0.08_145)] flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles size={12} className="text-[oklch(0.75_0.15_145)]" />
                </div>
              )}
              <div
                className={`rounded-xl px-3.5 py-2.5 max-w-[85%] ${
                  msg.role === 'user'
                    ? 'bg-[oklch(0.25_0.06_250)] border border-[oklch(0.32_0.08_250)] rounded-tl-sm'
                    : 'bg-[oklch(0.18_0.03_145)] border border-[oklch(0.25_0.05_145)] rounded-tr-sm'
                }`}
              >
                <p className={`text-[13px] leading-relaxed m-0 whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'text-[oklch(0.88_0.04_250)]'
                    : 'text-[oklch(0.85_0.03_145)]'
                }`}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {sending && (
            <div className="flex gap-2.5 items-start">
              <div className="w-7 h-7 rounded-full bg-[oklch(0.25_0.08_145)] flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={12} className="text-[oklch(0.75_0.15_145)]" />
              </div>
              <div className="bg-[oklch(0.18_0.03_145)] border border-[oklch(0.25_0.05_145)] rounded-xl rounded-tr-sm px-4 py-3">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-[oklch(0.55_0.08_145)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[oklch(0.55_0.08_145)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-[oklch(0.55_0.08_145)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* API Key prompt or input area */}
        <div className="shrink-0 border-t border-[oklch(0.22_0.01_250)] bg-[oklch(0.14_0.01_250)]">
          {!apiKey ? (
            <div className="p-4">
              {showKeyInput ? (
                <div className="flex flex-col gap-2">
                  <div className="text-[12px] text-[oklch(0.65_0.01_250)]">
                    הזן Google Gemini API Key:
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="password"
                      value={keyDraft}
                      onChange={e => setKeyDraft(e.target.value)}
                      placeholder="AIza..."
                      className="flex-1 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3 py-2 text-[13px] text-inherit outline-none ltr"
                      dir="ltr"
                      onKeyDown={e => { if (e.key === 'Enter') saveApiKey() }}
                    />
                    <button
                      onClick={saveApiKey}
                      disabled={!keyDraft.trim()}
                      className="bg-[oklch(0.55_0.18_145)] border-none rounded-lg px-3 py-2 text-[oklch(0.12_0.01_250)] font-semibold text-[12px] cursor-pointer disabled:opacity-50"
                    >
                      שמור
                    </button>
                  </div>
                  <a
                    href="https://aistudio.google.com/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[oklch(0.60_0.12_250)] underline"
                  >
                    קבל API key בחינם מ-Google AI Studio
                  </a>
                </div>
              ) : (
                <button
                  onClick={() => setShowKeyInput(true)}
                  className="w-full flex items-center justify-center gap-2 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-4 py-3 cursor-pointer text-[oklch(0.70_0.01_250)] text-[13px] font-medium hover:bg-[oklch(0.22_0.01_250)] transition-colors"
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
                  className="flex-1 bg-[oklch(0.20_0.01_250)] border border-[oklch(0.28_0.01_250)] rounded-lg px-3.5 py-2.5 text-[13px] text-inherit outline-none placeholder:text-[oklch(0.45_0.01_250)] disabled:opacity-60"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || sending}
                  className="bg-[oklch(0.55_0.18_145)] border-none rounded-lg px-3 py-2 cursor-pointer text-[oklch(0.12_0.01_250)] disabled:opacity-40 transition-opacity"
                  aria-label="שלח"
                >
                  <Send size={16} />
                </button>
              </div>
              <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-[oklch(0.45_0.01_250)]">
                <span className="flex items-center gap-1">
                  <Sparkles size={10} />
                  מופעל על ידי Gemini Flash
                </span>
                <button
                  onClick={removeApiKey}
                  className="bg-transparent border-none cursor-pointer text-[oklch(0.45_0.01_250)] text-[10px] underline hover:text-[oklch(0.60_0.01_250)]"
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
