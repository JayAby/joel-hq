import type { CapacitorConfig } from '@capacitor/cli'

// Live-site mode: the app is a native shell that loads your real site,
// so every push to GitHub Pages updates the app automatically.
const config: CapacitorConfig = {
  appId: 'com.joel.hq',
  appName: 'Joel HQ',
  webDir: 'www',
  server: {
    url: 'https://jayaby.github.io/joel-hq/',
    cleartext: false,
    // Keep these inside the app. Without this, the Spotify login would open
    // in Chrome and never return to the app.
    allowNavigation: ['jayaby.github.io', 'accounts.spotify.com', '*.spotify.com', '*.firebaseapp.com', '*.googleapis.com'],
  },
  android: {
    backgroundColor: '#0b0d12',
  },
}

export default config
