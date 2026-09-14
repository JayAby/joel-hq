import { useEffect, useState } from 'react'
import {
  fetchCurrentlyPlaying,
  isSpotifyConnected,
  startSpotifyLogin,
  disconnectSpotify,
  NowPlaying as NP,
} from '../spotify'

const spotifyConfigured = Boolean(
  import.meta.env.VITE_SPOTIFY_CLIENT_ID && import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
)

export default function NowPlaying() {
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [np, setNp] = useState<NP | null>(null)

  useEffect(() => {
    const onConnected = () => setConnected(true)
    const onDisconnected = () => setConnected(false)
    window.addEventListener('spotify-connected', onConnected)
    window.addEventListener('spotify-disconnected', onDisconnected)
    return () => {
      window.removeEventListener('spotify-connected', onConnected)
      window.removeEventListener('spotify-disconnected', onDisconnected)
    }
  }, [])

  useEffect(() => {
    if (!connected) return
    let cancelled = false

    async function poll() {
      const result = await fetchCurrentlyPlaying()
      if (!cancelled) setNp(result)
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [connected])

  if (!connected) {
    return (
      <div className="card accent-rose span-4">
        <div className="card-head">
          <div className="card-title">
            <span>🎵</span> Now Playing
          </div>
        </div>
        <div className="np-status">Not connected to Spotify yet.</div>
        <button
          className="connect-btn"
          onClick={() => {
            if (!spotifyConfigured) {
              alert('Add your Spotify Client ID + Redirect URI to .env.local first — see the README.')
              return
            }
            startSpotifyLogin()
          }}
        >
          Connect Spotify
        </button>
      </div>
    )
  }

  return (
    <div className="card accent-rose span-4">
      <div className="card-head">
        <div className="card-title">
          <span>🎵</span> Now Playing
        </div>
        <button className="card-link" onClick={() => disconnectSpotify()}>
          disconnect
        </button>
      </div>
      {np?.title ? (
        <div className="np-row">
          <div className="np-art">{np.albumArt ? <img src={np.albumArt} alt="" /> : '🎵'}</div>
          <div>
            <div className="np-title">{np.title}</div>
            <div className="np-artist">{np.artist}</div>
          </div>
        </div>
      ) : (
        <div className="np-status">Nothing playing right now.</div>
      )}
    </div>
  )
}