import { Toaster } from '@/components/ui/sonner'

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--bg-base)]">
      <div className="flex justify-center pt-8 pb-4">
        <img src="/logo-familyplan.png?v=3" alt="Family Plan" className="logo-dark" style={{ width: 160, height: 'auto' }} />
        <img src="/logo-familyplan-light.png?v=3" alt="Family Plan" className="logo-light" style={{ width: 160, height: 'auto' }} />
      </div>
      {children}
      <Toaster position="top-center" richColors />
    </div>
  )
}
