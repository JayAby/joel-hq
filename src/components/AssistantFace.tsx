export type Mood = 'happy' | 'neutral' | 'concerned' | 'proud'

/** The assistant's face. Colour follows the time of day, the mouth follows how the day is going. */
export default function AssistantFace({ mood, size = 64, color }: { mood: Mood; size?: number; color: string }) {
  const mouth = {
    happy: 'M20 38 Q32 48 44 38',
    proud: 'M18 37 Q32 52 46 37',
    neutral: 'M23 41 L41 41',
    concerned: 'M22 45 Q32 38 42 45',
  }[mood]
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={`Assistant looks ${mood}`} className="face">
      <circle cx="32" cy="32" r="30" fill={color} />
      <circle cx="22" cy="26" r="3.4" fill="#10131c" />
      <circle cx="42" cy="26" r="3.4" fill="#10131c" />
      {mood === 'proud' && <path d="M15 20 Q22 14 29 20 M35 20 Q42 14 49 20" stroke="#10131c" strokeWidth="2.2" fill="none" strokeLinecap="round" />}
      <path d={mouth} stroke="#10131c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}
