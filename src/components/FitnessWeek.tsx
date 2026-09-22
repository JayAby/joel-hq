import { FitnessState } from '../types'
import Editable from './Editable'

interface Props {
  fitness: FitnessState
  onChange: (fitness: FitnessState) => void
}

function parseWeight(s: string): number | null {
  const m = s.match(/[\d.]+/)
  return m ? parseFloat(m[0]) : null
}

export function FitnessWeightPanel({ fitness, onChange }: Props) {
  const { weight, lastWeekWeight } = fitness
  const cur = parseWeight(weight)
  const prev = parseWeight(lastWeekWeight)
  let deltaText: string | null = null
  if (cur !== null && prev !== null) {
    const diff = Math.round((cur - prev) * 10) / 10
    if (diff > 0) deltaText = `▲ +${diff}kg since last week`
    else if (diff < 0) deltaText = `▼ ${diff}kg since last week`
    else deltaText = 'no change since last week'
  }

  return (
    <div>
      <div className="fit-weight-row">
        <span className="fit-weight-label">current weight</span>
        <Editable
          className="fit-weight-val"
          value={weight}
          onChange={(v) => onChange({ ...fitness, weight: v })}
        />
      </div>
      {deltaText && <div className="fit-weight-delta">{deltaText}</div>}
      <div className="fit-weight-hint">Weight resets its "last week" comparison every Monday.</div>
    </div>
  )
}