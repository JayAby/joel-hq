export function parseTaskInput(input: string): { text: string; time?: string } {
  const trimmed = input.trim()

  let m = trimmed.match(/^(.*?)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i)
  if (m) {
    let hour = parseInt(m[2], 10)
    const minute = m[3] ? parseInt(m[3], 10) : 0
    const meridiem = m[4].toLowerCase()
    if (meridiem === 'pm' && hour < 12) hour += 12
    if (meridiem === 'am' && hour === 12) hour = 0
    hour = Math.min(23, Math.max(0, hour))
    const time = `${String(hour).padStart(2, '0')}:${String(Math.min(59, minute)).padStart(2, '0')}`
    return { text: m[1].trim(), time }
  }

  m = trimmed.match(/^(.*?)\s+(?:at\s+)?(\d{1,2}):(\d{2})$/)
  if (m) {
    const hour = Math.min(23, parseInt(m[2], 10))
    const minute = Math.min(59, parseInt(m[3], 10))
    const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    return { text: m[1].trim(), time }
  }

  return { text: trimmed }
}