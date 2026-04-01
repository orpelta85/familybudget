import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4" dir="rtl">
      <h1 className="text-6xl font-bold text-[var(--c-0-40)]">404</h1>
      <p className="text-lg text-[var(--text-secondary)]">הדף שחיפשת לא נמצא</p>
      <Link
        href="/"
        className="mt-4 px-6 py-3 bg-[var(--accent-blue)] text-white rounded-xl text-sm font-medium hover:opacity-90 transition-opacity"
      >
        חזרה לדשבורד
      </Link>
    </div>
  )
}
