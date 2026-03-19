---
name: ui-polish
description: >
  Quick cosmetic polish pass for any web project. Adds hover effects, transitions, loading animations,
  scrollbar styling, empty states, and consistent spacing. Use when user says "polish", "ליטוש",
  "make it feel premium", "small improvements", "cosmetic fixes", "תשפר את החוויה", or after
  finishing a feature to add the finishing touches.
---

# UI Polish Checklist

A systematic pass to take any web app from "works" to "feels premium". Run through this checklist and apply what's missing.

## 1. Hover & Interaction Feedback

Users need to FEEL that elements are interactive.

```css
/* Add to global CSS */
.btn-hover { transition: filter 0.15s ease; }
.btn-hover:hover { filter: brightness(1.15); }
.btn-hover:active { filter: brightness(0.95); }

.card-hover { transition: border-color 0.2s ease, transform 0.2s ease; }
.card-hover:hover { border-color: rgba(255,255,255,0.1); }

.link-hover { transition: color 0.15s ease; }
.link-hover:hover { opacity: 0.8; }
```

Apply to: primary buttons, clickable cards, nav links.
Don't overdo — only on elements that DO something on click.

## 2. Loading States

Never show a blank screen or static "Loading..." text.

```css
@keyframes pulse-subtle {
  0%, 100% { opacity: 0.5; }
  50% { opacity: 1; }
}
.loading-pulse { animation: pulse-subtle 1.5s ease-in-out infinite; }
```

Better options (in order of effort):
1. Pulsing text (lowest effort) ← use this as minimum
2. Skeleton screens (medium)
3. Spinner + text (medium)
4. Progressive loading with stagger (highest effort, best UX)

## 3. Empty States

Never show just text like "No items". Always:
- Muted icon above (32-48px) — use Inbox, FileText, or context-relevant icon
- Clear message
- Action button if applicable ("+ הוסף ראשון")

```tsx
<div style={{ textAlign: 'center', padding: '32px 0' }}>
  <Inbox size={36} style={{ color: 'rgba(255,255,255,0.15)', margin: '0 auto 12px' }} />
  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>אין פריטים</div>
</div>
```

## 4. Scrollbar (Dark Theme)

Default scrollbars look terrible on dark UIs.

```css
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }
/* Firefox */
* { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.15) transparent; }
```

## 5. Transitions on Everything Visible

Add to global CSS:
```css
*, *::before, *::after {
  /* Don't do this globally — too aggressive. Instead: */
}

/* Add selectively to interactive elements */
button, a, input, select {
  transition: all 0.15s ease;
}
```

Or be selective: add `transition` to card borders, button backgrounds, link colors.

## 6. Number Formatting (Financial Apps)

- Always `direction: ltr` on numbers in RTL layouts
- Bold weight (600-700) for important amounts
- Consistent font size within each context
- Color-code: green positive, red negative, muted for zero
- Use Intl.NumberFormat for locale-appropriate formatting

## 7. Consistent Spacing

Pick a scale and stick to it:
```
4px  — micro gaps
8px  — tight spacing
12px — default gaps
16px — comfortable padding
20px — card padding
32px — section breaks
```

Check: are all cards using the same padding? Same border-radius? Same gap between sections?

## 8. Toast/Notification Styling

Default toast libraries (sonner, react-hot-toast) come with light themes. Override for dark:
```css
[data-sonner-toast] {
  --normal-bg: oklch(0.20 0.01 250) !important;
  --normal-text: oklch(0.90 0.01 250) !important;
  --normal-border: oklch(0.30 0.01 250) !important;
}
```

## 9. Focus Visible

For keyboard accessibility — but only show on keyboard navigation, not mouse clicks:
```css
:focus-visible {
  outline: 2px solid oklch(0.65 0.18 250);
  outline-offset: 2px;
}
:focus:not(:focus-visible) {
  outline: none;
}
```

## 10. Page Header Consistency

Every page should follow the same pattern:
```
[Icon] [Title h1]                    [Action buttons]
[Subtitle / period info]
```

Check all pages — are icons the same size? Titles the same fontSize? Buttons in the same position?

---

## How to Apply

1. Start with globals.css — add utility classes
2. Go page by page, add classNames to elements
3. Check empty states
4. Check loading states
5. Verify number formatting
6. Screenshot before/after

Total effort: ~30 minutes for a full pass. Maximum impact for minimum code.
