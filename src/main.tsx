import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import AuthGate from './components/AuthGate'
import './index.css'
import { quoteFor } from './quotes'
import { resetDayKey } from './config'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthGate>
      <App />
    </AuthGate>
  </React.StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
// The loading screen shows today's line, then fades once the app has had a moment to draw.
const boot = document.getElementById('boot')
const quote = document.getElementById('boot-quote')
if (quote) quote.textContent = `\u201C${quoteFor(resetDayKey(new Date()))}\u201D`
const shownAt = performance.now()
setTimeout(
  () => {
    if (!boot) return
    boot.style.opacity = '0'
    boot.style.pointerEvents = 'none'
    setTimeout(() => boot.remove(), 500)
  },
  Math.max(300, 1100 - shownAt),
)
