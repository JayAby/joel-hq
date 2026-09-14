# Joel HQ

A personal command-center dashboard: tasks, projects, career, finance,
fitness, study tracker, goals, notes, real Spotify "now playing," and a
Pomodoro timer. Edit anything directly on the page — it saves automatically
and syncs live between every device that has it open.

**Stack:** React + TypeScript (Vite) · Firebase Firestore (sync) · Spotify
Web API (PKCE, no backend). Hosted free and permanently on GitHub Pages —
nothing here is a trial, a sleeping server, or something that expires.

---

## 1. Create the GitHub repo

1. On GitHub, create a new repository named `joel-hq` (any name works, but
   if you use a different name, update the `base` in `vite.config.ts` and
   the redirect URI below to match).
2. Push this project to it:
   ```bash
   cd joel-hq
   git init
   git add .
   git commit -m "Joel HQ v1"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/joel-hq.git
   git push -u origin main
   ```
3. In the repo: **Settings → Pages → Build and deployment → Source →
   GitHub Actions**. That's it — the included workflow
   (`.github/workflows/deploy.yml`) builds and publishes the site on every
   push to `main`.

Your live URL will be: `https://YOUR_USERNAME.github.io/joel-hq/`

## 2. Set up Firebase (free, no expiry, powers the sync)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (name it anything, e.g. `joel-hq`). Skip Google Analytics, it's not needed.
2. In the project: **Build → Firestore Database → Create database** → start in **production mode** → pick any region close to you.
3. Go to **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**. This just lets the app authenticate quietly without you needing a password.
4. Go to **Project settings** (gear icon) → scroll to "Your apps" → click the **</> (Web)** icon → register an app (nickname anything) → copy the `firebaseConfig` values shown.
5. In Firestore, go to the **Rules** tab and paste:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /joelhq/{doc} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
   This means: anyone signed in (even anonymously) can read/write your
   dashboard doc. Since anyone can trigger anonymous sign-in on your site,
   this is "security by obscurity" — fine for a personal tool nobody else
   will find the URL to, but don't put sensitive data (passwords, full
   account numbers) in it. If you want it locked down further later, that's
   a good next step (e.g. requiring a specific email/password login instead
   of anonymous).
6. Click **Publish** on the rules.

## 3. Set up Spotify (free, for real "Now Playing")

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → log in with your Spotify account → **Create app**.
   - App name: anything (e.g. Joel HQ)
   - Redirect URI: `https://YOUR_USERNAME.github.io/joel-hq/` (must match exactly, including the trailing slash)
   - Check "Web API" under "Which API/SDKs are you planning to use?"
2. Save, then open the app → **Settings** → copy the **Client ID** (you do NOT need the Client Secret — this app never uses it, which is what makes it safe to run with no backend).

## 4. Add all the values as GitHub secrets

In your repo: **Settings → Secrets and variables → Actions → New repository secret**, add each of these (names must match exactly):

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_SPOTIFY_CLIENT_ID
VITE_SPOTIFY_REDIRECT_URI   →  https://YOUR_USERNAME.github.io/joel-hq/
```

Push any small change (or re-run the workflow from the **Actions** tab) and
the site will rebuild with these values baked in.

## 5. Local development (optional)

```bash
npm install
cp .env.example .env.local   # fill in the same values as above
npm run dev
```

## Using it day to day

- Open the GitHub Pages URL on either laptop, bookmark it. Edits sync
  within about a second on both.
- Click **Connect Spotify** once per browser/laptop to link Now Playing —
  it polls what's actually playing on your account every 15 seconds.
- Click any text to edit it in place. Drag a percentage number up/down to
  move its progress bar. Tasks auto-reset at midnight (local time on
  whichever laptop is open).

## What could still go wrong / good next steps

- Firestore's free (Spark) tier has generous daily limits that a single
  personal dashboard won't come close to hitting.
- If you ever want a login screen instead of "anyone with the link," swap
  anonymous auth for Firebase email/password auth — a small change in
  `firebase.ts` and the Firestore rule above.
- If you want this on your phone too, it already works there — same URL,
  same sync — you'd just want to tighten the Firestore rule first since a
  phone browser makes the link easier to stumble on.
