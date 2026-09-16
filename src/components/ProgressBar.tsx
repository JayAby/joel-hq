interface Props {
  value: number
  onChange?: (v: number) => void
  barClass?: string
  readOnly?: boolean
}

export default function ProgressBar({ value, onChange, barClass = '', readOnly = false }: Props) {
  function set(v: number) {
    if (!onChange) return
    if (Number.isNaN(v)) return
    onChange(Math.max(0, Math.min(100, Math.round(v))))
  }

  return (
    <div>
      <div className="pbar-track">
        <div className={`pbar-fill ${barClass}`} style={{ width: `${value}%` }} />
      </div>
      {readOnly ? (
        <div className="pbar-readout">{value}%</div>
      ) : (
        <div className="pbar-controls">
          <input
            type="range"
            min={0}
            max={100}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            className="range-slider"
          />
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            className="pct-input"
          />
          <span className="pct-sign">%</span>
        </div>
      )}
    </div>
  )
}