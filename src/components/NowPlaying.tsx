import { useEffect, useState } from 'react'
import {
  fetchCurrentlyPlaying,
  isSpotifyConnected,
  startSpotifyLogin,
  disconnectSpotify,
  togglePlayPause,
  skipNext,
  skipPrevious,
  setShuffle,
  setRepeat,
  fetchRecentlyPlayed,
  NowPlaying as NP,
  RecentTrack,
} from '../spotify'

const spotifyConfigured = Boolean(
  import.meta.env.VITE_SPOTIFY_CLIENT_ID && import.meta.env.VITE_SPOTIFY_REDIRECT_URI,
)

export default function NowPlaying() {
  const [connected, setConnected] = useState(isSpotifyConnected())
  const [np, setNp] = useState<NP | null>(null)
  const [recent, setRecent] = useState<RecentTrack[]>([])

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
      const [result, recentTracks] = await Promise.all([fetchCurrentlyPlaying(), fetchRecentlyPlayed(4)])
      if (!cancelled) {
        setNp(result)
        setRecent(recentTracks)
      }
    }
    poll()
    const id = setInterval(poll, 15000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [connected])

  async function handlePlayPause() {
    if (!np) return
    setNp({ ...np, isPlaying: !np.isPlaying })
    await togglePlayPause(np.isPlaying)
    setTimeout(() => fetchCurrentlyPlaying().then((r) => r && setNp(r)), 600)
  }
  async function handleSkip(dir: 'next' | 'prev') {
    await (dir === 'next' ? skipNext() : skipPrevious())
    setTimeout(() => fetchCurrentlyPlaying().then((r) => r && setNp(r)), 600)
  }
  async function handleShuffle() {
    if (!np) return
    setNp({ ...np, shuffle: !np.shuffle })
    await setShuffle(!np.shuffle)
  }
  async function handleRepeat() {
    if (!np) return
    const next = np.repeat === 'off' ? 'context' : np.repeat === 'context' ? 'track' : 'off'
    setNp({ ...np, repeat: next })
    await setRepeat(next)
  }

  if (!connected) {
    return (
      <div className="card accent-rose span-4">
        <div className="card-head">
          <div className="card-title">
            <span className="card-icon-badge badge-rose">🎵</span> Now Playing
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
    <div className="card accent-rose span-4" id="section-nowplaying">
      <div className="card-head">
        <div className="card-title">
          <span className="card-icon-badge badge-rose">🎵</span> Now Playing
        </div>
        <button className="card-link" onClick={() => disconnectSpotify()}>
          disconnect
        </button>
      </div>

      {np?.title ? (
        <>
          <div className="np-row-big">
            <div className="np-art-big">{np.albumArt ? <img src={np.albumArt} alt="" /> : '🎵'}</div>
            <div className="np-info">
              <div className="np-title">{np.title}</div>
              <div className="np-artist">{np.artist}</div>
            </div>
          </div>
          <div className="np-controls">
            <button
              className={`np-ctrl-btn${np.shuffle ? ' active' : ''}`}
              onClick={handleShuffle}
              title="Shuffle"
            >
              🔀
            </button>
            <button className="np-ctrl-btn" onClick={() => handleSkip('prev')} title="Previous">
              ⏮
            </button>
            <button className="np-ctrl-btn np-ctrl-play" onClick={handlePlayPause} title="Play/Pause">
              {np.isPlaying ? '⏸' : '▶'}
            </button>
            <button className="np-ctrl-btn" onClick={() => handleSkip('next')} title="Next">
              ⏭
            </button>
            <button
              className={`np-ctrl-btn${np.repeat !== 'off' ? ' active' : ''}`}
              onClick={handleRepeat}
              title={`Repeat: ${np.repeat}`}
            >
              {np.repeat === 'track' ? '🔂' : '🔁'}
            </button>
          </div>
        </>
      ) : (
        <div className="np-status">Nothing playing right now.</div>
      )}

      {recent.length > 0 && (
        <div className="np-recent">
          <div className="section-label">Recently played</div>
          {recent.map((t) => (
            <div className="np-recent-row" key={t.id}>
              <div className="np-recent-art">{t.albumArt ? <img src={t.albumArt} alt="" /> : '🎵'}</div>
              <div className="np-recent-info">
                <div className="np-recent-title">{t.title}</div>
                <div className="np-recent-artist">{t.artist}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}