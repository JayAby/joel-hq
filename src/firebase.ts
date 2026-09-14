import { initializeApp, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getAuth, signInAnonymously, onAuthStateChanged, Auth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Until you've added real values to .env.local, these stay undefined.
// Rather than crashing with an "invalid API key" error, we skip Firebase
// entirely and the dashboard runs in local-only mode — usable, just not
// synced across devices yet.
export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

if (isFirebaseConfigured) {
  app = initializeApp(firebaseConfig)
  db = getFirestore(app)
  auth = getAuth(app)
}

export { db, auth }

export function ensureSignedIn(cb: () => void) {
  if (!auth) return
  onAuthStateChanged(auth, (user) => {
    if (user) {
      cb()
    } else {
      signInAnonymously(auth!).catch((err) => console.error('Auth error', err))
    }
  })
}