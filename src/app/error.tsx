'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
      <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>משהו השתבש</h2>
      <p style={{ color: 'oklch(0.55 0.01 250)', fontSize: 14, marginBottom: 24 }}>
        אירעה שגיאה בטעינת העמוד. נסה שוב.
      </p>
      <button
        onClick={reset}
        style={{ background: 'oklch(0.65 0.18 250)', color: 'oklch(0.10 0.01 250)', border: 'none', borderRadius: 8, padding: '10px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
      >
        נסה שוב
      </button>
    </div>
  )
}
