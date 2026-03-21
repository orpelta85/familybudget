'use client'

import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="p-10 text-center">
      <div className="text-[32px] mb-4">⚠️</div>
      <h2 className="text-lg font-bold mb-2">משהו השתבש</h2>
      <p className="text-[var(--text-secondary)] text-sm mb-6">
        אירעה שגיאה בטעינת העמוד. נסה שוב.
      </p>
      <button
        onClick={reset}
        className="bg-[var(--accent-blue)] text-[var(--c-0-10)] border-none rounded-lg px-6 py-2.5 font-semibold text-sm cursor-pointer"
      >
        נסה שוב
      </button>
    </div>
  )
}
