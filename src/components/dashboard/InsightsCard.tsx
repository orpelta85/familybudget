'use client'

import { Sparkles, CheckCircle2, AlertTriangle, Info, Zap, Trophy, RefreshCw, X } from 'lucide-react'
import { useInsights, useMarkInsightRead, useGenerateInsights, type AiInsight } from '@/lib/queries/useInsights'

interface InsightsCardProps {
  userId: string | undefined
}

function iconFor(insight: AiInsight) {
  if (insight.severity === 'positive') return insight.category === 'achievement' ? Trophy : CheckCircle2
  if (insight.severity === 'warning') return AlertTriangle
  if (insight.category === 'action') return Zap
  return Info
}

function colorsFor(severity: AiInsight['severity'], category: AiInsight['category']) {
  if (category === 'action') {
    return {
      bg: 'color-mix(in oklab, var(--accent-purple, oklch(0.55 0.2 295)) 10%, transparent)',
      border: 'color-mix(in oklab, var(--accent-purple, oklch(0.55 0.2 295)) 35%, transparent)',
      icon: 'var(--accent-purple, oklch(0.7 0.18 295))',
    }
  }
  if (severity === 'positive') {
    return {
      bg: 'color-mix(in oklab, var(--accent-green) 10%, transparent)',
      border: 'color-mix(in oklab, var(--accent-green) 35%, transparent)',
      icon: 'var(--accent-green)',
    }
  }
  if (severity === 'warning') {
    return {
      bg: 'color-mix(in oklab, var(--accent-orange) 10%, transparent)',
      border: 'color-mix(in oklab, var(--accent-orange) 35%, transparent)',
      icon: 'var(--accent-orange)',
    }
  }
  return {
    bg: 'color-mix(in oklab, var(--accent-blue, oklch(0.6 0.15 250)) 10%, transparent)',
    border: 'color-mix(in oklab, var(--accent-blue, oklch(0.6 0.15 250)) 35%, transparent)',
    icon: 'var(--accent-blue, oklch(0.72 0.13 250))',
  }
}

export function InsightsCard({ userId }: InsightsCardProps) {
  const { data: insights, isLoading } = useInsights(userId)
  const markRead = useMarkInsightRead()
  const generate = useGenerateInsights()

  if (!userId) return null

  const visibleInsights = (insights ?? []).filter(i => !i.is_read)
  const hasInsights = visibleInsights.length > 0

  return (
    <div
      className="rounded-xl p-5"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg"
            style={{
              background: 'color-mix(in oklab, var(--accent-purple, oklch(0.55 0.2 295)) 15%, transparent)',
            }}
          >
            <Sparkles size={16} style={{ color: 'var(--accent-purple, oklch(0.72 0.18 295))' }} />
          </div>
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-1)' }}>
              תובנות אורן השבועיות
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-3)' }}>
              ניתוח חכם של ההוצאות שלך
            </p>
          </div>
        </div>
        <button
          onClick={() => generate.mutate({ user_id: userId })}
          disabled={generate.isPending}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
          style={{
            background: 'var(--surface-2)',
            color: 'var(--text-2)',
            border: '1px solid var(--border)',
          }}
          aria-label="רענן תובנות"
        >
          <RefreshCw size={12} className={generate.isPending ? 'animate-spin' : ''} />
          {generate.isPending ? 'מייצר...' : 'רענן'}
        </button>
      </div>

      {generate.error && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{
            background: 'color-mix(in oklab, var(--accent-red, oklch(0.6 0.2 25)) 10%, transparent)',
            color: 'var(--accent-red, oklch(0.7 0.2 25))',
          }}
        >
          {(generate.error as Error).message}
        </div>
      )}

      {isLoading ? (
        <div className="text-xs" style={{ color: 'var(--text-3)' }}>
          טוען תובנות...
        </div>
      ) : !hasInsights ? (
        <div
          className="text-center py-6 rounded-lg"
          style={{
            background: 'var(--surface-2)',
            border: '1px dashed var(--border)',
          }}
        >
          <Sparkles size={20} className="mx-auto mb-2" style={{ color: 'var(--text-3)' }} />
          <p className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>
            אין עדיין תובנות
          </p>
          <p className="text-xs" style={{ color: 'var(--text-3)' }}>
            לחץ על "רענן" כדי שאורן ינתח את ההוצאות שלך
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {visibleInsights.map(insight => {
            const Icon = iconFor(insight)
            const c = colorsFor(insight.severity, insight.category)
            return (
              <div
                key={insight.id}
                className="flex items-start gap-3 p-3 rounded-lg"
                style={{
                  background: c.bg,
                  border: `1px solid ${c.border}`,
                }}
              >
                <div
                  className="flex items-center justify-center w-7 h-7 rounded-md shrink-0 mt-0.5"
                  style={{
                    background: 'color-mix(in oklab, currentColor 12%, transparent)',
                    color: c.icon,
                  }}
                >
                  <Icon size={14} />
                </div>
                <p
                  className="flex-1 text-sm leading-relaxed"
                  style={{ color: 'var(--text-1)' }}
                >
                  {insight.insight_text}
                </p>
                <button
                  onClick={() => markRead.mutate({ id: insight.id, user_id: userId })}
                  className="shrink-0 flex items-center justify-center w-6 h-6 rounded-md transition-colors"
                  style={{
                    color: 'var(--text-3)',
                  }}
                  aria-label="סמן כנקרא"
                  title="סמן כנקרא"
                >
                  <X size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
