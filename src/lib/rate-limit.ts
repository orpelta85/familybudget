import { NextRequest, NextResponse } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

// Clean old entries periodically
function cleanOldEntries() {
  const now = Date.now()
  if (rateLimitMap.size > 1000) {
    for (const [key, val] of rateLimitMap) {
      if (now > val.resetAt) rateLimitMap.delete(key)
    }
  }
}

/**
 * Simple in-memory rate limiter for API routes.
 * Returns a 429 response if rate limit is exceeded, or null if the request is allowed.
 */
export function checkRateLimit(
  req: NextRequest,
  opts: { maxRequests?: number; windowMs?: number; prefix?: string } = {}
): NextResponse | null {
  const { maxRequests = 10, windowMs = 60_000, prefix = '' } = opts
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
  const key = `${prefix}:${ip}`
  const now = Date.now()

  cleanOldEntries()

  const entry = rateLimitMap.get(key)
  if (entry && now < entry.resetAt) {
    if (entry.count >= maxRequests) {
      return NextResponse.json({ error: 'too many requests' }, { status: 429 })
    }
    entry.count++
  } else {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
  }

  return null
}
