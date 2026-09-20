import { FormEvent, ReactNode, useEffect, useState } from 'react'
import { onAuthStateChanged, User } from 'firebase/auth'
import { auth, isFirebaseConfigured, login, logout } from '../firebase'

interface Props {
  children: ReactNode
}

export default function AuthGate({ children }: Props) {
  const [user, setUser] = useState<User | null>(null)
  const [checked, setChecked] = useState(!isFirebaseConfigured)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isFirebaseConfigured || !auth) {
      setChecked(true)
      return
    }
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u)
      setChecked(true)
    })
    return () => unsub()
  }, [])

  if (!isFirebaseConfigured) return <>{children}</>

  if (!checked) {
    return (
      <div className="page">
        <div className="np-status">Loading…</div>
      </div>
    )
  }

  if (user) {
    return (
      <>
        {children}
        <button className="lock-btn" onClick={() => logout()} title="Sign out of this browser">
          🔒
        </button>
      </>
    )
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
    } catch {
      setError('Wrong email or password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="lock-screen">
      <form className="lock-panel" onSubmit={submit}>
        <div className="lock-title">🔒 Joel HQ</div>
        <div className="form-hint" style={{ marginBottom: 16 }}>
          This dashboard is private. Sign in to continue.
        </div>
        <label className="form-label">Email</label>
        <input
          className="form-input"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <label className="form-label" style={{ marginTop: 10 }}>
          Password
        </label>
        <input
          className="form-input"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <div className="form-hint" style={{ color: 'var(--rose)', marginTop: 8 }}>
            {error}
          </div>
        )}
        <button className="connect-btn" style={{ marginTop: 16, width: '100%' }} type="submit" disabled={loading}>
          {loading ? 'Checking…' : 'Unlock'}
        </button>
      </form>
    </div>
  )
}