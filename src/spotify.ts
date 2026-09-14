// Spotify's "Authorization Code with PKCE" flow. This runs entirely in the
// browser with no client secret and no server — safe for a static GitHub
// Pages site. See README for how to register the Spotify app and get a
// Client ID.

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string
const SCOPES = 'user-read-currently-playing user-read-playback-state'

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

  console.log('Spotify login starting with redirect_uri:', REDIRECT_URI)

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

// Call once on app load. If the URL has ?code=..., exchanges it for tokens
// and cleans the URL.
export async function handleSpotifyRedirect() {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const errorParam = url.searchParams.get('error')

  if (errorParam) {
    console.error('Spotify redirected back with an error:', errorParam)
    url.searchParams.delete('error')
    window.history.replaceState({}, '', url.toString())
    return
  }

  if (!code) return

  const verifier = localStorage.getItem(LS_VERIFIER)
  if (!verifier) {
    console.error('No stored code_verifier found — cannot complete Spotify login. Try connecting again.')
    return
  }

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
    console.log('Spotify connected successfully.')
  } else {
    const errText = await res.text()
    console.error('Spotify token exchange failed:', res.status, errText)
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
  if (!res.ok) {
    const errText = await res.text()
    console.error('Spotify token refresh failed:', res.status, errText)
    return null
  }
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
}

export async function fetchCurrentlyPlaying(): Promise<NowPlaying | null> {
  const token = await getValidAccessToken()
  if (!token) return null

  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (res.status === 204 || !res.ok) return { isPlaying: false, title: '', artist: '' }

  const data = await res.json()
  const item = data.item
  if (!item) return { isPlaying: false, title: '', artist: '' }

  return {
    isPlaying: data.is_playing,
    title: item.name,
    artist: (item.artists || []).map((a: { name: string }) => a.name).join(', '),
    albumArt: item.album?.images?.[0]?.url,
  }
}