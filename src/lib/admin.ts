const ADMIN_EMAIL = 'orpelta85@gmail.com'

export function isAdminEmail(email: string | undefined): boolean {
  return email === ADMIN_EMAIL
}
