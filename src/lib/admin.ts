import { ADMIN_EMAIL } from '@/lib/constants'

export function isAdminEmail(email: string | undefined): boolean {
  return email === ADMIN_EMAIL
}
