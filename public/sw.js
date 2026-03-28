const CACHE_NAME = 'family-finance-v3'
const APP_SHELL = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.svg',
  '/icon-512.svg',
]

// Install — cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Some resources may not be available during install
      })
    })
  )
  self.skipWaiting()
})

// Activate — clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

// Fetch — network-first for API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Network-first for API calls and Supabase
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          return response
        })
        .catch(() => {
          return caches.match(event.request)
        })
    )
    return
  }

  // Network-first for JS/CSS (always get fresh code)
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
        .catch(() => caches.match(event.request))
    )
    return
  }

  // Cache-first for images/fonts only
  if (url.pathname.match(/\.(png|svg|jpg|jpeg|gif|woff2?)$/)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached
        return fetch(event.request).then((response) => {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          return response
        })
      })
    )
    return
  }

  // Network-first for pages (HTML)
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached
          // Offline fallback
          return new Response(
            '<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8"><title>אופליין</title><style>body{background:#0d0d1a;color:#e0e0e8;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}div{text-align:center}h1{font-size:24px}p{color:#8888a0}</style></head><body><div><h1>אין חיבור לאינטרנט</h1><p>נסה שוב כשתהיה מחובר</p></div></body></html>',
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          )
        })
      })
  )
})
