---
name: gemini-bridge
description: "Bridge to Google Gemini — delegates image generation, research, brainstorming, and copywriting to Gemini AI. Use when needing images, logos, market research, current data, brainstorming, or draft copy. Triggers: 'generate image', 'create logo', 'research', 'brainstorm', 'write copy', 'search for', 'current price', 'market data', 'תמונה', 'לוגו', 'מחקר', 'סיעור מוחות'."
---

# Gemini Bridge

Bridge to Google Gemini AI. Run the bridge script directly — Gemini does the heavy lifting, Claude agents review and improve the output.

## Quick Start

```bash
SCRIPT="C:/Users/User/.claude/skills/gemini-bridge/scripts/bridge.py"

# Generate images (Imagen 4)
python "$SCRIPT" image "cute owl mascot" --count 4 --output ./images/

# Ask a question (Gemini 3.1 Pro)
python "$SCRIPT" ask "What is the average salary in Israel 2026?"

# Research with web search
python "$SCRIPT" research "competitor analysis family budget apps Israel"

# Brainstorm ideas
python "$SCRIPT" brainstorm "10 slogan ideas for Family Plan app"

# Write copy
python "$SCRIPT" write "landing page hero text for Family Plan, Hebrew, family budget app"

# Generate image + text description
python "$SCRIPT" imagine "logo for Family Plan app, modern, clean, dark theme" --count 4

# Character sheet (multiple expressions)
python "$SCRIPT" character "friendly man with glasses, blue jacket, Disney style" --expressions "happy,worried,sleeping,celebrating"

# Logo variations
python "$SCRIPT" logo "Family Plan" --description "family budget app" --count 4
```

## Commands

| Command | Model | What it does |
|---------|-------|-------------|
| `image` | Imagen 4 | Generate high-quality images (PNG) |
| `ask` | Gemini 3.1 Pro | Answer any question |
| `research` | Gemini 3.1 Pro + Web Search | Research with current data |
| `brainstorm` | Gemini 3.1 Pro | Creative ideation |
| `write` | Gemini 3.1 Pro | Professional copywriting |
| `imagine` | Gemini 3.1 Flash Image | Mixed text + image output |
| `character` | Imagen 4 | Character sheet with expressions |
| `logo` | Imagen 4 | Logo variations (4 styles) |

## When to Use Gemini vs Claude

| Task | Use | Why |
|------|-----|-----|
| Image generation | Gemini (bridge) | Claude cannot generate images |
| Logos, mascots, banners | Gemini (bridge) | Image generation |
| Current data, prices | Gemini (bridge) | Has web search access |
| Market research | Gemini (bridge) | Web search + summarization |
| Draft copy / brainstorm | Gemini first, Claude reviews | Gemini drafts fast, Claude refines |
| Code | Claude | Claude is superior at code |
| Complex analysis | Claude | Claude handles nuance better |
| Project management | Claude | Needs context awareness |
| UI/UX decisions | Claude | Needs codebase context |

## Workflow for Agents

1. **Run the script** — use the appropriate command
2. **Review the output** — Gemini's output is a first draft
3. **Iterate if needed** — adjust prompts and regenerate
4. **Refine with Claude** — improve text, select best images
5. **Integrate** — use the output in the project

## Cost Awareness

- Text queries: ~$0.001 each
- Image generation (Imagen 4): ~$0.04 per image
- Image generation (Flash): ~$0.02 per image
- Research (with web search): ~$0.002 per query
- **Monthly budget cap: 50 NIS (~$14 USD)**
- The script prints estimated cost after each operation

## Image Options

- `--count N` — Generate 1-4 images (default: 1)
- `--size RATIO` — Aspect ratio: 1:1, 16:9, 9:16, 4:3, 3:4 (default: 1:1)
- `--output DIR` — Save directory (default: current directory)

## Error Handling

- If Imagen 4 fails, automatically falls back to Gemini Flash Image model
- If quota is exceeded, shows a friendly message with cost estimate
- Always prints which model was used

## Requirements

- Python 3.10+
- `google-genai` package (`pip install google-genai`)
- API key is embedded in the script (can override with GEMINI_API_KEY env var)
