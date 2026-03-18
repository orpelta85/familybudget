# Code Style

## General
- Write the minimum code that solves the problem
- No abstractions for things used once
- No comments unless logic is genuinely non-obvious
- TypeScript with proper types — avoid `any`

## React / Next.js
- App Router (src/app/) with 'use client' where needed
- React Query (TanStack) for data fetching — follow existing query patterns in src/lib/queries/
- Supabase client via @supabase/ssr — follow existing patterns in src/lib/supabase/
- Components in src/components/, organized by feature
- Lucide React for icons — no emoji icons

## CSS / Styling
- Tailwind CSS 4 for styling
- Color space: `oklch()` for custom colors
- Dark theme by default
- RTL layout (Hebrew) — use logical properties where needed
