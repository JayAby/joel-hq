import { useEffect, useState } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { DEFAULT_PROFILE, normaliseProfile, type Profile } from '../dayPlanner'

/** Wake time, bed time and work-shift length. Set from the chat: "set shift 6". Falls back to defaults. */
export function useAssistantProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)

  useEffect(() => {
    if (!db) return
    return onSnapshot(
      doc(db, 'assistant', 'profile'),
      (snap) => setProfile(normaliseProfile(snap.exists() ? (snap.data() as Record<string, unknown>) : undefined)),
      () => setProfile(DEFAULT_PROFILE),
    )
  }, [])

  return profile
}
