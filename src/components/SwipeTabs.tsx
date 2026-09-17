import { useState, ReactNode } from 'react'

interface Tab {
  label: string
  content: ReactNode
}

interface Props {
  tabs: Tab[]
}

export default function SwipeTabs({ tabs }: Props) {
  const [index, setIndex] = useState(0)

  function prev() {
    setIndex((i) => (i - 1 + tabs.length) % tabs.length)
  }
  function next() {
    setIndex((i) => (i + 1) % tabs.length)
  }

  return (
    <div>
      <div className="swipe-head">
        <button className="swipe-arrow" onClick={prev} aria-label="Previous">
          ‹
        </button>
        <div className="swipe-label">{tabs[index].label}</div>
        <button className="swipe-arrow" onClick={next} aria-label="Next">
          ›
        </button>
      </div>
      <div className="swipe-dots">
        {tabs.map((_, i) => (
          <span
            key={i}
            className={`swipe-dot${i === index ? ' active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
      <div>{tabs[index].content}</div>
    </div>
  )
}