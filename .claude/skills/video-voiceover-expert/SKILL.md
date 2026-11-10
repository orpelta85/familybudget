---
name: video-voiceover-expert
description: "Build complete video tutorials end to end for the Family Plan app - script, voiceover, editing, and marketing, from script to rendered MP4. Use for video tutorials, screen recordings, narration, or app marketing videos for Family Plan specifically. Triggers: 'video tutorial', 'voiceover', 'קריינות', 'סרטון הדרכה', 'עריכת וידאו', 'Family Plan video'."
disable-model-invocation: true
---
# Video Tutorial Expert - Family Plan

מומחה וידאו, קריינות, עריכה ושיווק לאפליקציית Family Plan.
יודע לבנות סרטונים שלמים מאפס - מתסריט ועד MP4 מרונדר.

---

## The App: Family Plan

אפליקציית ניהול כספי משפחתי פרימיום (Next.js + Supabase).
- **שם מותג:** Family Plan (באנגלית!)
- **סלוגן:** הדרך הפשוטה לנהל את כלכלת המשפחה
- **URL:** familyplan.co.il
- **לוגו:** בית ירוק עם גרף עולה צהוב/זהב
- **נושא:** dark theme, פרימיום SaaS (Linear/Vercel level)
- **שפה:** עברית RTL

### Brand Colors (oklch)
```
Background:     oklch(0.13 0.01 250)  - כמעט שחור
Surface:        oklch(0.17 0.01 250)  - אפור כהה
Accent Green:   oklch(0.62 0.14 152)  - ירוק מותג ראשי
Gold:           oklch(0.78 0.14 85)   - זהב/חם משני
Text Primary:   oklch(0.93 0.01 250)  - כמעט לבן
Text Secondary: oklch(0.65 0.01 250)  - אפור בהיר
```

### 20+ App Pages
דשבורד, הכנסות, הוצאות (עם ייבוא אקסל), תקציב, קופה קטנה, ילדים, קרנות חיסכון, יעדים, תחזית, שווי נקי, פנסיה, משכנתא, חובות, ביטוחים, מנויים, ניתוח שנתי, יועץ AI "אורן", הגדרות משפחה, אונבורדינג wizard (6 שלבים)

### Key Selling Points (for script writing)
1. **ייבוא אוטומטי מהבנק** - מייבאים אקסל והמערכת מסווגת אוטומטית
2. **אישי + משפחתי** - כל דף עובד בשני מצבים, toggle אחד
3. **יועץ AI** - "אורן" מנתח את הנתונים ונותן המלצות אישיות
4. **20+ מודולים** - לא רק הוצאות, גם פנסיה, משכנתא, ביטוח, חיסכון
5. **וויזרד הרשמה ב-60 שניות** - פשוט להתחיל
6. **חינם** - התחלה בחינם

---

## Video Project Structure

```
c:\Users\User\familybudget\video\
├── src/
│   ├── compositions/MainVideo.tsx    - Root: sequences 23 scenes + 5 title cards
│   ├── scenes/Scene01Intro.tsx...    - 23 scene files
│   ├── components/
│   │   ├── IntroScene.tsx            - Opening: logo + name + tagline
│   │   ├── OutroScene.tsx            - CTA: logo + button + URL
│   │   ├── ScreenCapture.tsx         - Shows screenshot with Ken Burns
│   │   ├── ScreenScene.tsx           - Wrapper: screenshot + subtitle + audio
│   │   ├── SubtitleOverlay.tsx       - Hebrew subtitle bar (bottom center)
│   │   ├── SceneTitleCard.tsx        - Section divider with icon + glow
│   │   ├── FeatureHighlight.tsx      - Dim overlay with glowing cutout
│   │   ├── ProblemSolution.tsx       - Scene 2: problems + strikethrough
│   │   ├── TransitionWipe.tsx        - Crossfade between scenes
│   │   └── SafeAudio.tsx             - Audio with graceful missing file handling
│   ├── config/scenes.ts              - All 23 scenes timing + narration text
│   └── styles/theme.ts               - Colors, typography, animation presets
├── public/assets/
│   ├── screenshots/                  - 25+ app screenshots (1920x1080)
│   ├── audio/narration/              - 23 Edge TTS MP3 files
│   └── design/
│       ├── logo.png, logo-light.png  - Brand logos
│       └── gemini/                   - 8 AI-generated backgrounds
├── out/tutorial-video-v2.mp4         - Latest render (101 MB, 3:58)
├── package.json                      - Remotion 4.0.443 + React 19
└── tsconfig.json
```

### Video Specs
- **Resolution:** 1920x1080
- **FPS:** 30
- **Duration:** ~7125 frames = 3:58
- **Codec:** H.264
- **Scenes:** 23 content + 5 title cards

---

## Remotion Essentials

### Creating a New Scene
```tsx
// src/scenes/SceneXX.tsx
import React from 'react';
import { ScreenScene } from '../components/ScreenScene';
import { scenes } from '../config/scenes';

const config = scenes[INDEX]; // 0-based index

export const SceneXX: React.FC = () => (
  <ScreenScene
    screenshot={config.screenshot!}
    narration={config.narration}
    overlayText={config.overlayText}
    audioFile={config.audioFile}
    kenBurns={true}
  />
);
```

### Custom Scene with Animations
```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring, AbsoluteFill } from 'remotion';
import { colors, typography, animation } from '../styles/theme';

export const CustomScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: animation.springDefault });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.bg.primary, direction: 'rtl' }}>
      {/* content */}
    </AbsoluteFill>
  );
};
```

### Animation Presets (from theme.ts)
```
springDefault:  { damping: 12, mass: 1, stiffness: 100 }
springSnappy:   { damping: 15, mass: 0.8, stiffness: 200 }
springSlow:     { damping: 20, mass: 1.5, stiffness: 60 }
springGentle:   { damping: 25, mass: 2, stiffness: 40 }
```

### Adding to MainVideo.tsx
```tsx
sequences.push(seq('xx-name', scenes[INDEX].durationFrames, <SceneXX />));
```

### Rendering
```bash
cd c:\Users\User\familybudget\video

# Studio (preview)
npm run start                    # localhost:3000

# Single frame test
npx remotion still MainVideo --frame=850 --output=test.png

# Full video
npx remotion render MainVideo out/video.mp4 --codec=h264

# TypeScript check
npx tsc --noEmit
```

---

## Hebrew Voiceover (Edge TTS)

### Quick Generate
```bash
edge-tts --voice he-IL-AvriNeural --rate "+8%" --pitch "+4Hz" --text "טקסט בעברית" --write-media output.mp3
```

### Available Hebrew Voices
| Voice | Gender | Best For |
|-------|--------|----------|
| `he-IL-AvriNeural` | Male | Professional, warm, tutorial |
| `he-IL-HilaNeural` | Female | Friendly, energetic |

### Making It Sound Natural (NOT Robotic)

**Rate & Pitch:**
- Default is flat. Always use `--rate "+5%" to "+10%"` for energy
- Pitch `+3Hz` to `+5Hz` adds warmth
- Don't go above +15% rate - sounds rushed

**SSML for Advanced Control:**
```xml
<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="he-IL">
  <prosody rate="+8%" pitch="+4Hz">
    <emphasis level="strong">Family Plan</emphasis>
    <break time="300ms"/>
    הדרך הפשוטה לנהל את כלכלת המשפחה.
    <break time="200ms"/>
    תקשיבו, זה <emphasis level="moderate">מטורף</emphasis> כמה זה פשוט.
  </prosody>
</speak>
```

Save as `.ssml` file, then: `edge-tts --voice he-IL-AvriNeural -f input.ssml --write-media output.mp3`

**Writing Tips for Natural TTS:**
1. משפטים קצרים. לא יותר מ-15 מילים.
2. תוסיף שאלות רטוריות: "מכירים את זה?"
3. ביטויים ישראליים: "וואו", "איזה כיף", "סוף סוף"
4. הפסקות טבעיות - שים פסיק או נקודה במקום pause
5. מספרים - כתוב אותם כמילים אם מתחת ל-10
6. "Family Plan" באנגלית - TTS יבטא את זה נכון

### Batch Generate All 23 Narrations
```python
import json, subprocess, os

with open('video/script.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

for scene in data['scenes']:
    subprocess.run([
        'edge-tts', '--voice', 'he-IL-AvriNeural',
        '--rate', '+8%', '--pitch', '+4Hz',
        '--text', scene['narration'],
        '--write-media', f"video/public/assets/audio/narration/{scene['id']}.mp3"
    ])
```

---

## Screenshots (Playwright)

### Capturing App Screens
```
1. Resize to 1920x1080
2. Navigate to page
3. Wait 2 seconds for load
4. Take screenshot
5. Save to video/public/assets/screenshots/
```

App runs at `localhost:3001`. Chrome Playwright on port `9222`.

### Current Screenshots (37 total)
**App pages (25):** dashboard, income, expenses, budget, joint, kids, sinking, goals, forecast, net-worth, pension, mortgage, debts, insurance, subscriptions, analytics, advisor, family, shared, onboarding-step1 through step6

**Onboarding wizard detail (6):** onboarding-wizard-step1-welcome through step6-finish

**Live demos (6):** demo-add-expense, demo-budget-progress, demo-advisor-chat, demo-family-toggle, demo-dashboard-full, demo-sinking-funds-progress

---

## Marketing Script Writing

### Tone
- כמו חבר ישראלי שמתלהב לספר לך על משהו
- לא מכירתי, לא פורמלי
- שאלות רטוריות: "מכירים את הסיוט הזה?"
- רגשות: "איזו הקלה!", "וואו", "סוף סוף"
- ביטויים ישראליים: "תקשיבו", "אתם קולטים?", "בקיצור"

### Script Structure (per scene)
```json
{
  "id": "04-dashboard",
  "narration": "הטקסט שהקריין אומר",
  "overlayText": "טקסט קצר על המסך",
  "durationSeconds": 15,
  "screenshot": "assets/screenshots/dashboard.png",
  "audioFile": "assets/audio/narration/04-dashboard.mp3"
}
```

### Scene Duration Guidelines
| סוג סצנה | זמן מומלץ |
|-----------|-----------|
| Intro/CTA | 6-10 שניות |
| Title card | 1.5 שניות (45 frames) |
| פיצ'ר פשוט | 7-10 שניות |
| פיצ'ר מרכזי (הוצאות, דשבורד, AI) | 13-15 שניות |
| תצוגה כפולה (אישי/משפחתי) | 10 שניות |

### Copywriting Formula per Scene
1. **Hook** - שאלה או תגובה רגשית (1-2 שניות)
2. **Show** - מה רואים על המסך (3-5 שניות)
3. **Benefit** - למה זה טוב לך (2-3 שניות)
4. **Transition** - משפט קצר שמחבר לסצנה הבאה (1 שנייה)

### Hebrew Formatting Rules
- Hyphen: רק `-` (ליד 0 במקלדת). אף פעם `-` או `--`
- שקל: `1,234 ₪` (סימן אחרי המספר)
- אחוז: `50%` (אחרי המספר)
- דולר: `$100` (לפני המספר)
- שם המותג: **Family Plan** (באנגלית, לא "תוכנית משפחתית")

---

## Gemini Bridge Integration

### Generate Background Images
```bash
# המפתח נקרא ממשתנה סביבה. לעולם לא מקודד קשיח בקובץ
# הגדרה חד פעמית:  setx GEMINI_API_KEY "..."
[ -n "$GEMINI_API_KEY" ] || { echo "חסר GEMINI_API_KEY"; exit 1; }
SCRIPT="$HOME/.claude/skills/gemini-bridge/scripts/bridge.py"

# Intro/outro backgrounds
python "$SCRIPT" image "description" --count 4 --size 16:9 --output ./video/assets/design/gemini/

# Rewrite script
python "$SCRIPT" write "prompt with all narrations"
```

### Available Commands
- `image` - Imagen 4 for backgrounds/visuals
- `write` - Gemini Pro for Hebrew copywriting
- `brainstorm` - creative ideas
- `research` - competitor video analysis

---

## Quality Checklist

Before declaring video "done":

### Visual
- [ ] לוגו אמיתי של Family Plan (לא placeholder)
- [ ] צבעי מותג ירוק/זהב (לא כחול גנרי)
- [ ] כל צילומי מסך עם נתונים (לא ריקים)
- [ ] Title cards עם glow + gradient
- [ ] כתוביות קריאות בתחתית

### Audio
- [ ] 23 קבצי MP3 קיימים
- [ ] קריינות טבעית (לא רובוטית)
- [ ] "Family Plan" נשמע באנגלית תקינה
- [ ] שום שתיקה ארוכה בין סצנות

### Technical
- [ ] TypeScript מקמפל (0 errors)
- [ ] RTL על כל הטקסטים העבריים
- [ ] MP4 output בין 80-120 MB
- [ ] 1920x1080, 30fps
- [ ] אורך ~3:50-4:00

### Script
- [ ] "Family Plan" (לא "תוכנית משפחתית")
- [ ] סלוגן: "הדרך הפשוטה לנהל את כלכלת המשפחה"
- [ ] טון ישראלי טבעי, לא פורמלי
- [ ] שאלות רטוריות ורגש
- [ ] Hebrew formatting rules (hyphen, ₪, %)

---

## Common Workflows

### Full Video Rebuild
1. Update `script.json` narrations
2. Update `scenes.ts` to match
3. Generate TTS: `python batch_tts.py`
4. Check: `npx tsc --noEmit`
5. Preview: `npm run start`
6. Render: `npx remotion render MainVideo out/video.mp4 --codec=h264`
7. QA: render test frames with `npx remotion still MainVideo --frame=N --output=test.png`

### Add a New Scene
1. Add config to `scenes.ts`
2. Create `src/scenes/SceneXX.tsx`
3. Import + add sequence in `MainVideo.tsx`
4. Capture screenshot if needed (Playwright)
5. Generate narration (Edge TTS)
6. Update `TOTAL_DURATION_FRAMES`

### Improve Narration Quality
1. Rewrite text - shorter sentences, more emotion
2. Use SSML for emphasis and pauses
3. Try different voice (Avri vs Hila)
4. Adjust rate (+5% to +12%) and pitch (+2Hz to +6Hz)
5. A/B test by rendering single frames and listening

### Update Branding
- Logo: `video/public/assets/design/logo.png` + `logo-light.png`
- Colors: `video/src/styles/theme.ts` - change `colors.accent.*`
- Name: grep for "Family Plan" in scenes.ts, script.json, IntroScene, OutroScene
