import { useRef } from 'react'

interface Props {
  value: number
  onChange: (val: number) => void
  className?: string
}

// Click-and-drag vertically on the percentage number to change it.
export default function DragPct({ value, onChange, className }: Props) {
  const startY = useRef(0)
  const startVal = useRef(0)

  function onMouseDown(e: React.MouseEvent) {
    e.preventDefault()
    startY.current = e.clientY
    startVal.current = value

    function move(ev: MouseEvent) {
      const delta = Math.round((startY.current - ev.clientY) / 2)
      onChange(Math.max(0, Math.min(100, startVal.current + delta)))
    }
    function up() {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', up)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }

  return (
    <span className={className ?? 'pct'} onMouseDown={onMouseDown}>
      {value}%
    </span>
  )
}
