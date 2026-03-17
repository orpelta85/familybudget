'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Dashboard error:', error)
  }, [error])

  return (
    <div style={{ padding: 40, fontFamily: 'monospace', direction: 'ltr' }}>
      <h2 style={{ color: 'oklch(0.62 0.22 27)', marginBottom: 16 }}>Runtime Error</h2>
      <pre style={{ background: 'oklch(0.14 0.01 250)', border: '1px solid oklch(0.28 0.01 250)', borderRadius: 8, padding: 16, fontSize: 13, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'oklch(0.85 0.01 250)' }}>
        {error.message}
        {'\n\n'}
        {error.stack}
      </pre>
      <button onClick={reset} style={{ marginTop: 16, padding: '8px 20px', background: 'oklch(0.65 0.18 250)', border: 'none', borderRadius: 8, cursor: 'pointer', color: 'white', fontWeight: 600 }}>
        נסה שוב
      </button>
    </div>
  )
}
