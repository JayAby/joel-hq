const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string
const SCOPES =
  'user-read-currently-playing user-read-playback-state user-modify-playback-state user-read-recently-played'

const LS_ACCESS = 'spotify_access_token'
const LS_REFRESH = 'spotify_refresh_token'
const LS_EXPIRES = 'spotify_expires_at'
const LS_VERIFIER = 'spotify_code_verifier'

function base64UrlEncode(buffer: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
async function sha256(input: string) {
  const data = new TextEncoder().encode(input)
  return crypto.subtle.digest('SHA-256', data)
}
function randomString(length: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let out = ''
  const values = crypto.getRandomValues(new Uint8Array(length))
  for (let i = 0; i < length; i++) out += chars[values[i] % chars.length]
  return out
}
export function isSpotifyConnected() {
  return !!localStorage.getItem(LS_REFRESH)
}
export async function startSpotifyLogin() {
  const verifier = randomString(64)
  localStorage.setItem(LS_VERIFIER, verifier)
  const challenge = base64UrlEncode(await sha256(verifier))
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })
  window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`
}
export function disconnectSpotify() {
  localStorage.removeItem(LS_ACCESS)
  localStorage.removeItem(LS_REFRESH)
  localStorage.removeItem(LS_EXPIRES)
  window.dispatchEvent(new Event('spotify-disconnected'))
}
export async function handleSpotifyRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')
  if (errorParam) {
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.toString())
    return
  }
  if (!code) return
  const verifier = localStorage.getItem(LS_VERIFIER)
  if (!verifier) return
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (res.ok) {
    const data = await res.json()
    storeTokens(data)
  }
  url.searchParams.delete('code')
  url.searchParams.delete('state')
  window.history.replaceState({}, '', url.toString())
}
function storeTokens(data: { access_token: string; refresh_token?: string; expires_in: number }) {
  localStorage.setItem(LS_ACCESS, data.access_token)
  if (data.refresh_token) localStorage.setItem(LS_REFRESH, data.refresh_token)
  localStorage.setItem(LS_EXPIRES, String(Date.now() + data.expires_in * 1000))
  window.dispatchEvent(new Event('spotify-connected'))
}
async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem(LS_REFRESH)
  if (!refreshToken) return null
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return null
  const data = await res.json()
  storeTokens({ ...data, refresh_token: data.refresh_token ?? refreshToken })
  return data.access_token
}
async function getValidAccessToken(): Promise<string | null> {
  const expires = Number(localStorage.getItem(LS_EXPIRES) || 0)
  const access = localStorage.getItem(LS_ACCESS)
  if (access && Date.now() < expires - 5000) return access
  return refreshAccessToken()
}
export interface NowPlaying {
  isPlaying: boolean
  title: string
  artist: string
  albumArt?: string
  shuffle: boolean
  repeat: 'off' | 'context' | 'track'
  volumePercent: number | null
}
export async function fetchCurrentlyPlaying(): Promise<NowPlaying | null> {
  const token = await getValidAccessToken()
  if (!token) return null
  const res = await fetch('https://api.spotify.com/v1/me/player', {
    headers: { Authorization: `Bearer ${token}` },
  })
  const empty: NowPlaying = { isPlaying: false, title: '', artist: '', shuffle: false, repeat: 'off', volumePercent: null }
  if (res.status === 204 || !res.ok) return empty
  const data = await res.json()
  const item = data.item
  if (!item) return empty
  return {
    isPlaying: data.is_playing,
    title: item.name,
    artist: (item.artists || []).map((a: { name: string }) => a.name).join(', '),
    albumArt: item.album?.images?.[0]?.url,
    shuffle: !!data.shuffle_state,
    repeat: data.repeat_state ?? 'off',
    volumePercent: data.device?.volume_percent ?? null,
  }
}

async function playerRequest(method: 'PUT' | 'POST', path: string, body?: object): Promise<boolean> {
  const token = await getValidAccessToken()
  if (!token) return false
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
    return res.ok || res.status === 204
  } catch {
    return false
  }
}

export async function togglePlayPause(isCurrentlyPlaying: boolean): Promise<boolean> {
  return playerRequest('PUT', isCurrentlyPlaying ? '/pause' : '/play')
}
export async function skipNext(): Promise<boolean> {
  return playerRequest('POST', '/next')
}
export async function skipPrevious(): Promise<boolean> {
  return playerRequest('POST', '/previous')
}
export async function setShuffle(on: boolean): Promise<boolean> {
  return playerRequest('PUT', `/shuffle?state=${on}`)
}
export type RepeatMode = 'off' | 'context' | 'track'
export async function setRepeat(mode: RepeatMode): Promise<boolean> {
  return playerRequest('PUT', `/repeat?state=${mode}`)
}
export async function setVolumePercent(percent: number): Promise<boolean> {
  return playerRequest('PUT', `/volume?volume_percent=${Math.round(Math.max(0, Math.min(100, percent)))}`)
}

export interface RecentTrack {
  id: string
  title: string
  artist: string
  albumArt?: string
}

export async function fetchRecentlyPlayed(limit = 5): Promise<RecentTrack[]> {
  const token = await getValidAccessToken()
  if (!token) return []
  try {
    const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${limit}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return []
    const data = await res.json()
    const seen = new Set<string>()
    const out: RecentTrack[] = []
    for (const item of data.items ?? []) {
      const track = item.track
      if (!track || seen.has(track.id)) continue
      seen.add(track.id)
      out.push({
        id: track.id,
        title: track.name,
        artist: (track.artists || []).map((a: { name: string }) => a.name).join(', '),
        albumArt: track.album?.images?.[0]?.url,
      })
    }
    return out
  } catch {
    return []
  }
}