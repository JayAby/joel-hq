type Sky = 'morning' | 'afternoon' | 'evening' | 'night'

const SKIES: Record<Sky, [string, string]> = {
  morning: ['#f2a65a', '#fde2b4'],
  afternoon: ['#4a7fe0', '#a8c8ff'],
  evening: ['#2c2466', '#e8875f'],
  night: ['#080d24', '#27346a'],
}

// Each scene is a few dark layers, back to front, drawn over the sky.
const SCENES: string[][] = [
  // mountains
  ['M0 140 L60 90 L110 125 L170 70 L240 130 L300 85 L360 120 L400 100 V200 H0Z', 'M0 165 L70 125 L140 160 L210 115 L290 160 L350 135 L400 155 V200 H0Z', 'M0 185 L90 160 L180 182 L270 158 L400 184 V200 H0Z'],
  // dunes
  ['M0 130 Q100 80 200 125 T400 105 V200 H0Z', 'M0 160 Q120 120 230 158 T400 140 V200 H0Z', 'M0 188 Q150 160 280 186 T400 176 V200 H0Z'],
  // city
  ['M0 200 V120 H30 V95 H60 V130 H90 V80 H120 V140 H160 V100 H200 V125 H240 V70 H275 V135 H310 V105 H350 V150 H400 V200Z', 'M0 200 V160 H40 V140 H80 V165 H130 V150 H180 V170 H230 V145 H290 V168 H340 V148 H400 V200Z'],
  // sea
  ['M0 140 Q50 132 100 140 T200 140 T300 140 T400 140 V200 H0Z', 'M0 165 Q60 155 120 165 T240 165 T360 165 T400 163 V200 H0Z', 'M0 188 Q70 180 140 188 T280 188 T400 186 V200 H0Z'],
  // forest
  ['M0 200 V150 L20 110 L40 150 L65 100 L90 150 L120 105 L145 150 L175 95 L205 150 L235 110 L262 150 L295 100 L325 150 L355 112 L380 150 L400 130 V200Z', 'M0 200 V180 L25 145 L50 180 L85 140 L120 180 L160 148 L200 182 L240 142 L280 180 L320 146 L360 182 L400 160 V200Z'],
]

/** A quiet landscape behind the header: the scene changes each day, the sky follows the clock. */
export default function HeaderScene({ sky, seed }: { sky: Sky; seed: number }) {
  const layers = SCENES[seed % SCENES.length]
  const [top, bottom] = SKIES[sky]
  const id = `sky-${sky}`
  const sun = sky === 'night' ? '#e8ecff' : sky === 'evening' ? '#ffd29a' : '#fff6d6'
  return (
    <svg className="hm-scene" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="400" height="200" fill={`url(#${id})`} />
      {sky === 'night' && [30, 90, 150, 260, 330, 370].map((x, i) => <circle key={x} cx={x} cy={20 + ((i * 23) % 60)} r="1.3" fill="#fff" opacity=".8" />)}
      <circle cx={80 + (seed % 5) * 55} cy={sky === 'afternoon' ? 40 : 75} r={sky === 'night' ? 12 : 18} fill={sun} opacity={sky === 'night' ? 0.9 : 0.85} />
      {layers.map((d, i) => (
        <path key={i} d={d} fill="#0a0d12" opacity={0.28 + (i / layers.length) * 0.6} />
      ))}
    </svg>
  )
}
