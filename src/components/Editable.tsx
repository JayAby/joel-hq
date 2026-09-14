import { useEffect, useRef } from 'react'

interface Props {
  value: string
  onChange: (val: string) => void
  className?: string
  as?: 'div' | 'span'
}

// A contentEditable element that only re-syncs its DOM text when `value`
// changes from OUTSIDE (e.g. the other laptop editing it), not on every
// local keystroke — otherwise the cursor jumps around while typing.
export default function Editable({ value, onChange, className, as = 'div' }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const lastCommitted = useRef(value)

  useEffect(() => {
    if (ref.current && value !== lastCommitted.current && document.activeElement !== ref.current) {
      ref.current.textContent = value
      lastCommitted.current = value
    }
  }, [value])

  const Tag = as as any

  return (
    <Tag
      ref={ref}
      className={className}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e: React.FocusEvent<HTMLDivElement>) => {
        const text = e.target.textContent ?? ''
        lastCommitted.current = text
        onChange(text)
      }}
    >
      {value}
    </Tag>
  )
}
