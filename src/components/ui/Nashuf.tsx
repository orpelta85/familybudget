'use client'

type NashufMood = 'normal' | 'happy' | 'worried' | 'sleeping' | 'celebrating'

interface NashufProps {
  mood?: NashufMood
  size?: number
  message?: string
  className?: string
}

function NormalOwl() {
  return (
    <>
      <ellipse cx="60" cy="68" rx="32" ry="36" fill="#3d3470"/>
      <ellipse cx="60" cy="76" rx="20" ry="22" fill="#d4ccb8"/>
      <path d="M38 36 L32 22 L40 30Z" fill="#3d3470"/>
      <path d="M42 33 L38 20 L44 28Z" fill="#3d3470"/>
      <path d="M82 36 L88 22 L80 30Z" fill="#3d3470"/>
      <path d="M78 33 L82 20 L76 28Z" fill="#3d3470"/>
      <ellipse cx="60" cy="56" rx="26" ry="22" fill="#d4ccb8"/>
      <ellipse cx="48" cy="54" rx="10" ry="10" fill="#f0ede6"/>
      <ellipse cx="72" cy="54" rx="10" ry="10" fill="#f0ede6"/>
      <circle cx="48" cy="54" r="6" fill="#2bb5a0"/>
      <circle cx="72" cy="54" r="6" fill="#2bb5a0"/>
      <circle cx="49" cy="53" r="3" fill="#1a1530"/>
      <circle cx="73" cy="53" r="3" fill="#1a1530"/>
      <circle cx="46" cy="51" r="1.5" fill="#fff"/>
      <circle cx="70" cy="51" r="1.5" fill="#fff"/>
      <circle cx="48" cy="54" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <circle cx="72" cy="54" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <path d="M60.5 52 Q60 49 59.5 52" stroke="#b5a050" strokeWidth="1.5" fill="none"/>
      <line x1="36" y1="54" x2="28" y2="54" stroke="#b5a050" strokeWidth="1.5"/>
      <line x1="84" y1="54" x2="92" y2="54" stroke="#b5a050" strokeWidth="1.5"/>
      <path d="M40 42 Q48 39 56 42" stroke="#3d3470" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M64 42 Q72 39 80 42" stroke="#3d3470" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M57 62 L60 67 L63 62Z" fill="#c4943a"/>
      <path d="M55 68 Q60 71 65 68" stroke="#b5944a" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <path d="M28 62 Q22 72 28 84 Q30 78 32 72Z" fill="#3d3470"/>
      <path d="M92 62 Q98 72 92 84 Q90 78 88 72Z" fill="#3d3470"/>
      <path d="M48 102 L44 108 M48 102 L48 108 M48 102 L52 108" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M72 102 L68 108 M72 102 L72 108 M72 102 L76 108" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="108" x2="100" y2="108" stroke="#4a4270" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
}

function HappyOwl() {
  return (
    <>
      <ellipse cx="60" cy="65" rx="32" ry="36" fill="#3d3470"/>
      <ellipse cx="60" cy="73" rx="20" ry="22" fill="#d4ccb8"/>
      <path d="M38 33 L32 19 L40 27Z" fill="#3d3470"/>
      <path d="M42 30 L38 17 L44 25Z" fill="#3d3470"/>
      <path d="M82 33 L88 19 L80 27Z" fill="#3d3470"/>
      <path d="M78 30 L82 17 L76 25Z" fill="#3d3470"/>
      <ellipse cx="60" cy="53" rx="26" ry="22" fill="#d4ccb8"/>
      <ellipse cx="48" cy="51" rx="10" ry="10" fill="#f0ede6"/>
      <ellipse cx="72" cy="51" rx="10" ry="10" fill="#f0ede6"/>
      <circle cx="48" cy="51" r="6" fill="#34d4bc"/>
      <circle cx="72" cy="51" r="6" fill="#34d4bc"/>
      <circle cx="48" cy="51" r="8" fill="#2bb5a0" opacity="0.15"/>
      <circle cx="72" cy="51" r="8" fill="#2bb5a0" opacity="0.15"/>
      <circle cx="49" cy="50" r="3" fill="#1a1530"/>
      <circle cx="73" cy="50" r="3" fill="#1a1530"/>
      <circle cx="46" cy="48" r="2" fill="#fff"/>
      <circle cx="50" cy="53" r="1" fill="#fff"/>
      <circle cx="70" cy="48" r="2" fill="#fff"/>
      <circle cx="74" cy="53" r="1" fill="#fff"/>
      <circle cx="48" cy="51" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <circle cx="72" cy="51" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <path d="M60.5 49 Q60 46 59.5 49" stroke="#b5a050" strokeWidth="1.5" fill="none"/>
      <line x1="36" y1="51" x2="28" y2="49" stroke="#b5a050" strokeWidth="1.5"/>
      <line x1="84" y1="51" x2="92" y2="49" stroke="#b5a050" strokeWidth="1.5"/>
      <path d="M40 38 Q48 34 56 38" stroke="#3d3470" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M64 38 Q72 34 80 38" stroke="#3d3470" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
      <path d="M57 59 L60 64 L63 59Z" fill="#c4943a"/>
      <path d="M53 65 Q60 70 67 65" stroke="#b5944a" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
      <path d="M26 52 Q16 42 22 32 Q26 42 30 48Z" fill="#3d3470"/>
      <path d="M94 52 Q104 42 98 32 Q94 42 90 48Z" fill="#3d3470"/>
      <path d="M48 99 L44 105 M48 99 L48 105 M48 99 L52 105" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M72 99 L68 105 M72 99 L72 105 M72 99 L76 105" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="108" x2="100" y2="108" stroke="#4a4270" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
}

function WorriedOwl() {
  return (
    <>
      <g transform="rotate(-5 60 68)">
        <ellipse cx="60" cy="68" rx="32" ry="36" fill="#3d3470"/>
        <ellipse cx="60" cy="76" rx="20" ry="22" fill="#d4ccb8"/>
      </g>
      <path d="M36 38 L28 24 L38 32Z" fill="#3d3470"/>
      <path d="M40 35 L34 22 L42 30Z" fill="#3d3470"/>
      <path d="M80 34 L88 22 L80 30Z" fill="#3d3470"/>
      <path d="M76 32 L82 20 L76 28Z" fill="#3d3470"/>
      <g transform="rotate(-5 60 56)">
        <ellipse cx="60" cy="56" rx="26" ry="22" fill="#d4ccb8"/>
      </g>
      <ellipse cx="47" cy="55" rx="10" ry="8" fill="#f0ede6"/>
      <ellipse cx="73" cy="53" rx="10" ry="10" fill="#f0ede6"/>
      <circle cx="47" cy="55" r="5" fill="#2bb5a0"/>
      <circle cx="73" cy="53" r="6" fill="#2bb5a0"/>
      <circle cx="48" cy="54" r="2.5" fill="#1a1530"/>
      <circle cx="74" cy="52" r="3" fill="#1a1530"/>
      <circle cx="45" cy="52" r="1.2" fill="#fff"/>
      <circle cx="71" cy="50" r="1.5" fill="#fff"/>
      <ellipse cx="47" cy="55" rx="12" ry="10" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <circle cx="73" cy="53" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <path d="M59 53 Q60 50 61 52" stroke="#b5a050" strokeWidth="1.5" fill="none"/>
      <line x1="35" y1="55" x2="26" y2="57" stroke="#b5a050" strokeWidth="1.5"/>
      <line x1="85" y1="53" x2="94" y2="52" stroke="#b5a050" strokeWidth="1.5"/>
      <path d="M38 44 Q47 48 56 44" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M64 42 Q72 37 82 40" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M56 63 L59 68 L62 63Z" fill="#c4943a"/>
      <path d="M54 70 Q59 67 64 70" stroke="#b5944a" strokeWidth="1" fill="none" strokeLinecap="round"/>
      <path d="M26 64 Q20 74 26 86 Q28 80 30 74Z" fill="#3d3470"/>
      <path d="M94 62 Q100 72 94 84 Q92 78 90 72Z" fill="#3d3470"/>
      <path d="M46 103 L42 109 M46 103 L46 109 M46 103 L50 109" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M74 102 L70 108 M74 102 L74 108 M74 102 L78 108" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="108" x2="100" y2="108" stroke="#4a4270" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
}

function SleepingOwl() {
  return (
    <>
      <g transform="rotate(5 60 68)">
        <ellipse cx="60" cy="68" rx="32" ry="36" fill="#3d3470"/>
        <ellipse cx="60" cy="76" rx="20" ry="22" fill="#d4ccb8"/>
      </g>
      <path d="M40 38 L34 24 L42 32Z" fill="#3d3470"/>
      <path d="M44 35 L40 22 L46 30Z" fill="#3d3470"/>
      <path d="M84 36 L90 24 L84 30Z" fill="#3d3470"/>
      <path d="M80 34 L86 22 L80 28Z" fill="#3d3470"/>
      <g transform="rotate(5 60 56)">
        <ellipse cx="60" cy="56" rx="26" ry="22" fill="#d4ccb8"/>
      </g>
      <path d="M40 55 Q48 50 56 55" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M66 54 Q74 49 82 54" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <ellipse cx="48" cy="54" rx="12" ry="10" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <ellipse cx="74" cy="53" rx="12" ry="10" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <path d="M60.5 52 Q61 49 61.5 52" stroke="#b5a050" strokeWidth="1.5" fill="none"/>
      <line x1="36" y1="54" x2="28" y2="56" stroke="#b5a050" strokeWidth="1.5"/>
      <line x1="86" y1="53" x2="94" y2="54" stroke="#b5a050" strokeWidth="1.5"/>
      <path d="M40 48 Q48 46 56 48" stroke="#3d3470" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M66 47 Q74 45 82 47" stroke="#3d3470" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M58 63 L61 68 L64 63Z" fill="#c4943a"/>
      <ellipse cx="61" cy="71" rx="2.5" ry="2" fill="#b5944a" opacity="0.5"/>
      <path d="M28 64 Q22 76 28 88 Q30 82 32 76Z" fill="#3d3470"/>
      <path d="M94 63 Q100 75 94 87 Q92 81 90 75Z" fill="#3d3470"/>
      <text x="88" y="30" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="14" fill="#2bb5a0" opacity="0.8">Z</text>
      <text x="96" y="20" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="11" fill="#2bb5a0" opacity="0.6">z</text>
      <text x="102" y="12" fontFamily="Inter, system-ui, sans-serif" fontWeight="700" fontSize="8" fill="#2bb5a0" opacity="0.4">z</text>
      <path d="M50 103 L46 109 M50 103 L50 109 M50 103 L54 109" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M74 103 L70 109 M74 103 L74 109 M74 103 L78 109" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="108" x2="100" y2="108" stroke="#4a4270" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
}

function CelebratingOwl() {
  return (
    <>
      <circle cx="15" cy="20" r="2" fill="#2bb5a0" opacity="0.7"/>
      <circle cx="105" cy="15" r="2.5" fill="#b5a050" opacity="0.7"/>
      <circle cx="25" cy="10" r="1.5" fill="#c4943a" opacity="0.6"/>
      <circle cx="95" cy="28" r="1.8" fill="#2bb5a0" opacity="0.5"/>
      <circle cx="12" cy="40" r="2" fill="#b5a050" opacity="0.6"/>
      <circle cx="108" cy="38" r="1.5" fill="#3d3470" opacity="0.8"/>
      <circle cx="50" cy="8" r="1.8" fill="#c4943a" opacity="0.5"/>
      <circle cx="70" cy="5" r="2" fill="#2bb5a0" opacity="0.6"/>
      <rect x="30" y="14" width="3" height="3" rx="0.5" fill="#b5a050" opacity="0.5" transform="rotate(30 31 15)"/>
      <rect x="85" y="10" width="3" height="3" rx="0.5" fill="#2bb5a0" opacity="0.5" transform="rotate(-20 86 11)"/>
      <ellipse cx="60" cy="63" rx="32" ry="36" fill="#3d3470"/>
      <ellipse cx="60" cy="71" rx="20" ry="22" fill="#d4ccb8"/>
      <path d="M38 31 L30 15 L40 25Z" fill="#3d3470"/>
      <path d="M42 28 L36 13 L44 23Z" fill="#3d3470"/>
      <path d="M34 34 L26 20 L36 28Z" fill="#3d3470"/>
      <path d="M82 31 L90 15 L80 25Z" fill="#3d3470"/>
      <path d="M78 28 L84 13 L76 23Z" fill="#3d3470"/>
      <path d="M86 34 L94 20 L84 28Z" fill="#3d3470"/>
      <ellipse cx="60" cy="51" rx="26" ry="22" fill="#d4ccb8"/>
      <ellipse cx="48" cy="49" rx="10" ry="10" fill="#f0ede6"/>
      <ellipse cx="72" cy="49" rx="10" ry="10" fill="#f0ede6"/>
      <polygon points="48,43 49.5,47 53.5,47 50.5,49.5 51.5,53.5 48,51 44.5,53.5 45.5,49.5 42.5,47 46.5,47" fill="#b5a050"/>
      <polygon points="72,43 73.5,47 77.5,47 74.5,49.5 75.5,53.5 72,51 68.5,53.5 69.5,49.5 66.5,47 70.5,47" fill="#b5a050"/>
      <circle cx="46" cy="46" r="1.5" fill="#fff" opacity="0.8"/>
      <circle cx="70" cy="46" r="1.5" fill="#fff" opacity="0.8"/>
      <circle cx="48" cy="49" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <circle cx="72" cy="49" r="12" stroke="#b5a050" strokeWidth="1.8" fill="none"/>
      <path d="M60.5 47 Q60 44 59.5 47" stroke="#b5a050" strokeWidth="1.5" fill="none"/>
      <line x1="36" y1="49" x2="26" y2="46" stroke="#b5a050" strokeWidth="1.5"/>
      <line x1="84" y1="49" x2="94" y2="46" stroke="#b5a050" strokeWidth="1.5"/>
      <path d="M38 34 Q48 29 56 34" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M64 34 Q72 29 82 34" stroke="#3d3470" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <path d="M57 57 L60 62 L63 57Z" fill="#c4943a"/>
      <path d="M52 63 Q60 69 68 63" stroke="#b5944a" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
      <path d="M24 48 Q12 32 20 20 Q24 34 28 44Z" fill="#3d3470"/>
      <path d="M96 48 Q108 32 100 20 Q96 34 92 44Z" fill="#3d3470"/>
      <path d="M48 97 L44 103 M48 97 L48 103 M48 97 L52 103" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M72 97 L68 103 M72 97 L72 103 M72 97 L76 103" stroke="#c4943a" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="20" y1="108" x2="100" y2="108" stroke="#4a4270" strokeWidth="2" strokeLinecap="round"/>
    </>
  )
}

const moodComponents: Record<NashufMood, React.FC> = {
  normal: NormalOwl,
  happy: HappyOwl,
  worried: WorriedOwl,
  sleeping: SleepingOwl,
  celebrating: CelebratingOwl,
}

export function Nashuf({ mood = 'normal', size = 64, message, className }: NashufProps) {
  const MoodSvg = moodComponents[mood]

  return (
    <div className={className} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      {message && (
        <div
          style={{
            background: 'oklch(0.2 0.01 250)',
            border: '1px solid oklch(0.28 0.01 250)',
            borderRadius: 12,
            padding: '6px 12px',
            fontSize: Math.max(11, size * 0.18),
            color: 'oklch(0.75 0.01 250)',
            direction: 'rtl',
            maxWidth: size * 3,
            textAlign: 'center',
            lineHeight: 1.4,
            position: 'relative',
          }}
        >
          {message}
          <div
            style={{
              position: 'absolute',
              bottom: -5,
              left: '50%',
              transform: 'translateX(-50%) rotate(45deg)',
              width: 10,
              height: 10,
              background: 'oklch(0.2 0.01 250)',
              borderRight: '1px solid oklch(0.28 0.01 250)',
              borderBottom: '1px solid oklch(0.28 0.01 250)',
            }}
          />
        </div>
      )}
      <svg
        viewBox="0 0 120 120"
        width={size}
        height={size}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label={`נשוף - ${mood}`}
      >
        <MoodSvg />
      </svg>
    </div>
  )
}
