# AI Artist — Autonomous Visual Asset Generator

AI visual asset generator that ACTUALLY CREATES images using Google Gemini (Imagen 3). Generates mascots, characters, logos, icons, illustrations, and any visual asset on demand. Use when user asks to create, generate, or design any visual asset, character, mascot, illustration, or image. Triggers: 'create character', 'design mascot', 'generate image', 'make logo', 'illustration', 'banner', 'icon design', 'social media image', 'תמונה', 'דמות', 'לוגו', 'אייקון', 'באנר', 'איור'.

---

## CORE RULE

**When the user asks to create any visual asset, RUN the generate.py script directly. Do NOT just write prompts or give instructions — actually generate the image.**

If `GEMINI_API_KEY` is not set, tell the user to set it before proceeding.

---

## Requirements

- Python 3.10+
- `GEMINI_API_KEY` (or `GOOGLE_API_KEY`) environment variable
- Dependencies: `google-genai` (install: `pip install google-genai`)

---

## Scripts

All scripts located in: `C:\Users\User\.claude\skills\ai-artist\scripts\`

### 1. generate.py — General Image Generation

Generate any image using Google Imagen 3 (or Gemini 2.0 Flash) with optional style presets.

```bash
# Basic
python "C:/Users/User/.claude/skills/ai-artist/scripts/generate.py" --prompt "cute owl mascot" --output "owl.png"

# With style preset
python "C:/Users/User/.claude/skills/ai-artist/scripts/generate.py" --prompt "mountain landscape" --style watercolor --size 16:9 --output "landscape.png"

# Multiple images
python "C:/Users/User/.claude/skills/ai-artist/scripts/generate.py" --prompt "app icon for finance tracker" --style icon --count 3 --output-dir "./icons"

# Using Gemini Flash engine (alternative)
python "C:/Users/User/.claude/skills/ai-artist/scripts/generate.py" --prompt "abstract art" --engine gemini-flash --output "art.png"
```

**Arguments:**

| Arg | Required | Default | Description |
|-----|----------|---------|-------------|
| `--prompt` | Yes | — | Image description |
| `--style` | No | none | Style preset (see table below) |
| `--size` | No | 1:1 | Aspect ratio: 1:1, 3:4, 4:3, 9:16, 16:9 |
| `--engine` | No | imagen | `imagen` (Imagen 3) or `gemini-flash` (Gemini 2.0 Flash) |
| `--count` | No | 1 | Number of images (1-4, Imagen only) |
| `--output` | No | auto | Output file path (single image) |
| `--output-dir` | No | . | Output directory (multiple images) |

### 2. character-sheet.py — Character Expression Sheet

Generate a character with multiple expressions/poses for consistent branding.

```bash
# Default expressions (normal, happy, worried, sleeping, celebrating)
python "C:/Users/User/.claude/skills/ai-artist/scripts/character-sheet.py" --character "owl with glasses and bowtie" --style disney --output-dir "./owl-character"

# Custom expressions
python "C:/Users/User/.claude/skills/ai-artist/scripts/character-sheet.py" --character "friendly robot" --style pixar --expressions "waving,thinking,excited,confused" --output-dir "./robot"

# Using Gemini Flash engine
python "C:/Users/User/.claude/skills/ai-artist/scripts/character-sheet.py" --character "cute cat" --style kawaii --engine gemini-flash --output-dir "./cat"
```

### 3. logo.py — Logo Variations Generator

Generate multiple logo concepts (icon, wordmark, combination, abstract) for a brand.

```bash
python "C:/Users/User/.claude/skills/ai-artist/scripts/logo.py" --brand "Kaspon" --description "family finance app" --style modern --output-dir "./kaspon-logos"

python "C:/Users/User/.claude/skills/ai-artist/scripts/logo.py" --brand "PawPal" --description "pet care startup" --style playful --count 6 --output-dir "./pawpal-logos"
```

**Logo styles:** modern, playful, elegant, bold, minimal, vintage

---

## Engines

| Engine | Model | Best For | Notes |
|--------|-------|----------|-------|
| `imagen` (default) | `imagen-3.0-generate-002` | High-quality images, multiple outputs, aspect ratio control | Supports --count and --size |
| `gemini-flash` | `gemini-2.0-flash-exp` | Quick generation, mixed text+image responses | Single image per call |

---

## Style Presets Reference

| Preset | Enhancement Added to Prompt |
|--------|-------------|
| `disney` | Disney 2D animation style, hand-drawn, warm colors, expressive, cel-shaded, clean lines |
| `pixar` | Pixar-style 3D render, soft lighting, subsurface scattering, cute, appealing |
| `flat` | Flat vector illustration, minimal, geometric, clean, SVG-ready, solid colors |
| `kawaii` | Kawaii style, chibi, cute, pastel colors, rounded shapes |
| `corporate` | Professional corporate illustration, clean, modern, business |
| `logo` | Minimal logo design, scalable, iconic, clean background |
| `icon` | App icon style, simple, recognizable, bold colors |
| `realistic` | Photorealistic, detailed, high quality, natural lighting |
| `watercolor` | Watercolor painting style, soft edges, paper texture, artistic |
| `mascot` | Friendly mascot character, approachable, memorable, brand-suitable |

---

## Workflow

1. **Ask** the user what they want to create (image, character, logo, etc.)
2. **Pick** the right script and style preset based on their request
3. **Run** the script using the Bash tool — this is mandatory, do not skip
4. **Show** the result by reading the generated image file to display it
5. **Iterate** — ask if they want changes, different styles, or variations

---

## Tips

- For logos, use the `logo.py` script for multiple variation types
- For characters, encourage using a style preset for visual consistency
- Save outputs to a sensible location (user's Desktop, project assets folder, or current directory)
- After generating, read the image file with the Read tool to show the user
- Imagen 3 cannot render Hebrew text — generate without text, overlay in code
- Use `--engine gemini-flash` as fallback if Imagen 3 has issues

---

## Hebrew / RTL Considerations

- **Never** ask AI image generators to render Hebrew text — it will fail
- Generate images without text, then overlay Hebrew via CSS/HTML
- For RTL-appropriate character poses, specify "facing left" in the prompt
- Shekel symbol (₪) should be added via text overlay, not AI generation

---

## Related Skills

- **ui-ux-design** — For overall UI/UX design decisions
- **ui-polish** — For polishing UI after adding visual assets
- **logo-creator** — For SVG logo creation (code-based, no API needed)
- **banner-design** — For banner/hero section design
