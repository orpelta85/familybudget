# Family Budget App

## Project
- Family budget management app - premium visual quality (Linear/Vercel-level)
- Stack: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Supabase
- Hebrew RTL, dark theme, oklch colors
- Deployed on Vercel, DB on Supabase
- Dev: `npm run dev` - localhost:3001
- Primary user ID: `8da7a736-4a2c-4bc6-bb72-ab9f80b86de8`

## Process
1. After DB changes: verify with SELECT on correct user ID
2. After UI changes: Playwright screenshot to verify
3. Always push to GitHub after committing
4. TypeScript check runs automatically (hook)
5. RTL check on .docx runs automatically (hook)

@rules/approach.md
@rules/code-style.md
@rules/frontend.md
