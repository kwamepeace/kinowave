# KinoWave 📺✨

A Netflix-style Android and web app for **free live TV and 24/7 movie channels** from around the world, built natively with
**Kotlin + Jetpack Compose** and **Media3 ExoPlayer**. Channels come from the open-source
[iptv-org/iptv](https://github.com/iptv-org/iptv) project and are sorted into vibes: Bollywood, South Indian cinema,
Nollywood, K-Drama, anime, horror, telenovelas, sports and more.

## Get the app

Every push to `main` builds a signed APK on GitHub Actions. On your phone, open the repo's
**Releases → latest** page, download `KinoWave-1.0.x.apk` and install it (allow *Install unknown apps* when asked).
New versions install over the old one.

No Android Studio or SDK needed. GitHub builds everything.

## Watch on the web

The same app runs in the browser at **https://kwamepeace.github.io/kinowave/app/**, with profiles, For You, My List,
Discover, the Live guide and the player (server fallback, zapping with ↑/↓, sleep timer, picture-in-picture, resume
for movies). It lives in `web/` (Vite + React + TypeScript, hls.js for live streams) and is deployed by the
**Publish catalog + website** workflow next to `catalog.json`.

Browsers can't load `http://` streams on an `https://` page, so channels that only have plain-http sources
(about 1 in 6) are left out on the web and still play in the Android app. Some streams also refuse web players
(no CORS headers); the player then moves on to the next server.

Run it locally with Node 20+ (it reads the published catalog):

```bash
cd web
npm install
npm run dev
```

## What's inside

| | |
|---|---|
| **Home** | Swipeable spotlight carousel, Top 10 in your country, Continue watching, My List and ~25 curated rows. Filter by *For You / Movies / TV & Live* or jump to any category. |
| **Discover** | Instant search across 10k+ channels by name, country, language or genre ("bollywood", "ghana", "hindi", "anime"), plus browse-by-vibe tiles, countries and languages. |
| **Live** | A channel guide. Pick a country and category, tap to start watching. |
| **My Space** | Saved channels, watch history, "hide unreliable channels" and a manual catalog refresh. |
| **Player** | Full-screen ExoPlayer with automatic fallback across sources, swipe ↑↓ to change channel, a channel strip, fit/zoom (double-tap) and picture-in-picture. |

## How the data works

`scripts/build-catalog.mjs` downloads the [iptv-org API](https://github.com/iptv-org/api) (channels, streams, logos,
feeds), drops NSFW, closed and blocklisted channels, ranks streams, and builds the curated collections. The output is a
compact `catalog.json`:

- **bundled in the APK** at build time, so the app works the moment it opens, and
- **published daily to GitHub Pages** by `.github/workflows/catalog.yml`. The app pulls this copy every 6 hours, so
  channel lists stay fresh without reinstalling.

Run it locally with Node 18+:

```bash
node scripts/build-catalog.mjs --out app/src/main/assets/catalog.json
```

Tweak the rows (titles, emoji, colors, matching rules) in the `COLLECTIONS` list in that script.

## Workflows

- **Build Android APK** (`android.yml`): catalog → `gradle :app:assembleRelease` → artifact + GitHub Release.
- **Publish catalog + website** (`catalog.yml`): daily catalog refresh, the landing page and the web app (`/app/`) on GitHub Pages.

### Signing

Release APKs are signed with the key in these repo secrets: `KEYSTORE_BASE64` (base64 PKCS12), `KEYSTORE_PASSWORD`,
`KEY_ALIAS`, `KEY_PASSWORD`. Without them (for example, on forks) the build falls back to the debug key.

## Project layout

```
app/src/main/java/com/kwamepeace/kinowave/
  data/       catalog models, repository (bundled + cached + remote), search index, user prefs
  ui/         view model, navigation, theme, components (posters, hero, tab bar), screens
  player/     PlayerActivity (ExoPlayer, PiP) and its Compose overlay
scripts/      build-catalog.mjs
site/         GitHub Pages landing page
web/          the web app (React + hls.js), served at /app/
```

## Disclaimer

KinoWave doesn't host any video. Streams are public links collected by iptv-org. Some are geo-locked or not on air
24/7, and any of them can go offline at any time.
