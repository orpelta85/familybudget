'use client'

import { Nashuf } from './Nashuf'

interface NashufEmptyStateProps {
  message: string
  submessage?: string
}

export function NashufEmptyState({ message, submessage }: NashufEmptyStateProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
        gap: 16,
        direction: 'rtl',
      }}
    >
      <Nashuf mood="sleeping" size={96} />
      <div style={{ textAlign: 'center' }}>
        <p
          style={{
            fontSize: 16,
            fontWeight: 500,
            color: 'oklch(0.7 0.01 250)',
            margin: 0,
          }}
        >
          {message}
        </p>
        {submessage && (
          <p
            style={{
              fontSize: 13,
              color: 'oklch(0.5 0.01 250)',
              margin: '6px 0 0',
            }}
          >
            {submessage}
          </p>
        )}
      </div>
    </div>
  )
}
