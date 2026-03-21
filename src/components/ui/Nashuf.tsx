'use client'

import Image from 'next/image'

type NashufMood = 'normal' | 'happy' | 'worried' | 'sleeping' | 'celebrating'

interface NashufProps {
  mood?: NashufMood
  size?: number
  message?: string
  className?: string
}

// Maps mood to objectPosition for the oren-poses.png sprite
// Poses left to right: happy (0%), worried (28%), sleeping (55%), celebrating (80%)
const moodPosition: Record<NashufMood, string> = {
  normal: '0% 10%',
  happy: '0% 10%',
  worried: '28% 10%',
  sleeping: '55% 10%',
  celebrating: '80% 10%',
}

export function Nashuf({ mood = 'normal', size = 64, message, className }: NashufProps) {
  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {message && (
        <div
          style={{
            background: 'var(--c-0-20)',
            border: '1px solid var(--border-light)',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: Math.max(11, size * 0.18),
            color: 'var(--text-body)',
            direction: 'rtl',
            maxWidth: size * 3,
            textAlign: 'center',
            lineHeight: 1.4,
            position: 'relative',
          }}
        >
          {message}
          <div
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 10,
              height: 10,
              background: 'var(--c-0-20)',
              borderRight: '1px solid var(--border-light)',
              borderBottom: '1px solid var(--border-light)',
            }}
          />
        </div>
      )}
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          position: 'relative',
        }}
        aria-label={`אורן - ${mood}`}
      >
        <Image
          src="/mascot/oren-poses.png"
          alt="אורן"
          width={size * 2}
          height={size * 2}
          className="w-full h-full object-cover"
          style={{ objectPosition: moodPosition[mood] }}
        />
      </div>
    </div>
  )
}
