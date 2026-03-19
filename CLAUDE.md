# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Claude Code Instructions

## Project Context

- **Solo project** — family budget management app, premium visual quality (Linear/Vercel-level design)
- Stack: Next.js 16 + React 19 + TypeScript + Tailwind CSS 4 + Supabase
- Hebrew RTL interface, dark theme
- Deployed on Vercel, DB on Supabase
- Dev server: `npm run dev` → localhost:3001

- **Primary user ID**: `8da7a736-4a2c-4bc6-bb72-ab9f80b86de8` (orpelta85@gmail.com)

---

## Mandatory Process — NEVER SKIP

1. **Before any change**: Consult elite-project-manager agent for planning
2. **After any DB change**: Verify data with a SELECT query on the CORRECT user ID
3. **After any UI change**: Run visual QA with Playwright (navigate + screenshot)
4. **Before saying "done"**: Checklist — TypeScript compiles, data verified, visual verified
5. **Always push to GitHub** after committing (user deploys via Vercel)
6. **RTL check**: Run rtl-fix skill on any new UI component

---

@rules/approach.md
@rules/code-style.md
@rules/frontend.md
