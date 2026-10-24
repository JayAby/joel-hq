// Keeps the chat tidy.
//   - Auto: once a day, deletes chat messages and old proposals older than 7 days.
// The app only shows today's messages, so nothing needs clearing by hand.
// Never touches tasks, habits, shopping or the activity log (undo history).

import type { Db } from './firestore'
import { londonResetDayKey } from './london'

export const KEEP_DAYS = 7
const MAX_ROUNDS = 10 // 10 x 300 documents is far more than a chat will ever hold

async function deleteWhere(
  db: Db,
  collection: string,
  field: 'at' | 'createdAt',
  shouldDelete: (value: number) => boolean,
): Promise<number> {
  let removed = 0
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const docs = await db.list(collection)
    const doomed = docs.filter((d) => {
      const v = d.data[field]
      return typeof v !== 'number' || shouldDelete(v)
    })
    if (doomed.length === 0) break
    for (const d of doomed) {
      await db.remove(`${collection}/${d.id}`)
      removed++
    }
    if (docs.length === doomed.length && docs.length < 300) break
  }
  return removed
}

/** Runs from the 5-minute cron but only does work once per logical day. */
export async function autoTidy(db: Db, now: Date): Promise<{ messages: number; proposals: number } | null> {
  const today = londonResetDayKey(now)
  const sched = await db.getDoc('assistant/schedule')
  if (sched?.data.cleanedDay === today) return null
  await db.update('assistant/schedule', [{ path: ['cleanedDay'], value: today }])
  const cutoff = now.getTime() - KEEP_DAYS * 24 * 3600_000
  const messages = await deleteWhere(db, 'messages', 'at', (v) => v < cutoff)
  const proposals = await deleteWhere(db, 'proposals', 'createdAt', (v) => v < cutoff)
  return { messages, proposals }
}
