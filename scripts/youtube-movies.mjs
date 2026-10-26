// Full-length movies that studios publish for free on their own official YouTube channels.
// Used by build-catalog.mjs. Needs a YouTube Data API v3 key in YOUTUBE_API_KEY; without one the
// section is skipped. Costs roughly 8 quota units per channel per run (free quota: 10,000/day).

const API = 'https://www.googleapis.com/youtube/v3';

// Official channels that upload their own full films. Add more here: { id, name } with the UC… channel id.
export const YOUTUBE_ROWS = [
  {
    id: 'yt-nollywood', title: 'New Nollywood & Ghana', emoji: '🇳🇬', colors: ['#11998E', '#F7B733'],
    channels: [
      { id: 'UCi8vPG6uMxIjoZMhLLX2BkQ', name: 'Nollywood Pictures TV' },
      { id: 'UCeaw5Pjz9B8IHKjeilf807A', name: 'Mercy Johnson Okojie TV' },
      { id: 'UCj5sfwkIpMOlRWd4xJlmwXg', name: 'Destiny Etiko TV' },
      { id: 'UCjcFNZE51DmSrGYBqixs0Ug', name: 'Ruth Kadiri 247' },
      { id: 'UC2aVC5l8TNpJaVVkMtJhACQ', name: 'KumawoodTV' },
    ],
  },
  {
    id: 'yt-bollywood', title: 'Bollywood Full Movies', emoji: '💃', colors: ['#FF8A00', '#E52E71'],
    channels: [
      { id: 'UCBOmfqgTZi7yDp4-3Lr_3lA', name: 'Shemaroo Movies' },
      { id: 'UCYauDsl-rswjQGpA0_-Z9Pw', name: 'Ultra Movie Parlour' },
    ],
  },
  {
    id: 'yt-south', title: 'South Movies in Hindi', emoji: '🔥', colors: ['#F7971E', '#C2185B'],
    channels: [
      { id: 'UCyoXW-Dse7fURq30EWl_CUA', name: 'Goldmines' },
      { id: 'UCt7_pnSRPKU3bu2GqmgH8gQ', name: 'Wamindia Movies' },
    ],
  },
  {
    id: 'yt-hollywood', title: 'Free Hollywood Movies', emoji: '🎬', colors: ['#7F00FF', '#E100FF'],
    channels: [
      { id: 'UC8IHAQMuiJdY6ALuhG7iU8Q', name: 'FilmRise Movies' },
      { id: 'UCVFYikepF-avelvuIaQ_lHA', name: 'Popcornflix' },
      { id: 'UC2u3R3pjOiPZu4LtTlKkxdw', name: 'Maverick Movies' },
      { id: 'UCGBzBkV-MinlBvHBzZawfLQ', name: 'Movie Central' },
    ],
  },
];

const PER_CHANNEL = 25; // newest qualifying films kept per channel
const PAGES = 4; // up to 200 recent uploads scanned per channel
const MIN_SECONDS = 55 * 60;
const MAX_SECONDS = 200 * 60; // longer uploads are compilations or marathons, not one film

// Not films: trailers, clips, songs, series episodes, news, shorts…
const NOT_A_MOVIE = /\b(trailer|teaser|promo|episode|ep\.? ?\d|season \d|jukebox|songs?|video song|interview|behind the scenes|bts|reaction|review|scene|clip|#shorts|news|live stream|compilation|part \d+ ?& ?\d+ teaser)\b/i;
const ADULT = /\b(sex|sexy|erotic\w*|nude|nudity|xxx|18\+|adult only)\b/i;

async function get(path, params, key) {
  const url = `${API}/${path}?${new URLSearchParams({ ...params, key })}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 401) {
      throw new Error(
        'HTTP 401: Google rejected the key. Create a plain API key (Credentials → Create credentials → API key, ' +
          'without "Authenticate API calls through a service account") and save it as YOUTUBE_API_KEY.',
      );
    }
    if (attempt >= 3 || res.status === 403 || res.status === 400) {
      throw new Error(`${path} HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

function isoSeconds(d) {
  const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d ?? '');
  if (!m) return 0;
  return (Number(m[1] ?? 0) * 24 + Number(m[2] ?? 0)) * 3600 + Number(m[3] ?? 0) * 60 + Number(m[4] ?? 0);
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** "CASABLANCA - DESTINY ETIKO, … Latest 2026 Nigerian Movie" → "Casablanca". */
export function cleanTitle(raw) {
  let t = decode(raw)
    .replace(/[|｜].*$/, '')
    .replace(/\s[-–—]\s.*$/, '')
    // Hindi-script titles usually carry the Latin name in brackets: "थलायवा (Thalaivaa)" → "Thalaivaa"
    .replace(/^.*?[ऀ-ॿ].*?\(([A-Za-z][A-Za-z0-9 '&:.-]{1,40})\).*$/, '$1')
    .replace(/\((?:4k|hd|full ?hd|uhd|hindi dubbed|new|the movie|movie|\d{4})\)/gi, '')
    // "Tere Naam Hindi …" / "Trishakti Hindi Arshad Warsi & …": the cast list follows the language
    .replace(/(\S)\s+hindi\b.*$/i, '$1')
    .replace(/\b(full|free|new|latest|hd|4k|uhd|hindi dubbed|dubbed|movie|movies|film|nigerian|nollywood|ghanaian|ghana|bollywood|south indian|20\d\d|19\d\d)\b/gi, ' ')
    .replace(/[#⭐🔥🏆]+/gu, ' ')
    .replace(/\(\s*\)/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,:\-–]+|[\s,:\-–]+$/g, '')
    .trim();
  if (!t) t = decode(raw).trim();
  // "I DID IT FOR LOVE Cynthia Clarke & Anthony Woode": an all-caps title followed by the cast's names
  const capsTitle = /^([A-Z0-9][A-Z0-9'’!?:,. ]{2,}?)\s+[A-Z][a-z]/.exec(t);
  if (capsTitle && capsTitle[1].trim().split(/\s+/).length >= 2) t = capsTitle[1].trim();
  // ALL CAPS titles read like shouting; switch to Title Case
  if (t === t.toUpperCase() && /[A-Z]/.test(t)) {
    t = t.toLowerCase().replace(/\b\p{L}/gu, (c) => c.toUpperCase());
  }
  return t.length > 60 ? `${t.slice(0, 57).trim()}…` : t;
}

function cleanDescription(raw) {
  const text = decode(raw ?? '')
    .split('\n')
    .filter((l) => !/https?:\/\/|subscribe|follow us|instagram|facebook|twitter|tiktok|copyright|©|#/i.test(l))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > 280 ? `${text.slice(0, 277).replace(/\s+\S*$/, '')}…` : text;
}

async function channelFilms(channel, key, log) {
  const uploads = `UU${channel.id.slice(2)}`;
  const films = [];
  let pageToken;
  for (let page = 0; page < PAGES && films.length < PER_CHANNEL; page++) {
    const list = await get('playlistItems', { part: 'contentDetails', playlistId: uploads, maxResults: '50', ...(pageToken ? { pageToken } : {}) }, key);
    const ids = (list.items ?? []).map((i) => i.contentDetails?.videoId).filter(Boolean);
    if (!ids.length) break;
    const videos = await get('videos', { part: 'snippet,contentDetails,status', id: ids.join(',') }, key);
    for (const v of videos.items ?? []) {
      const s = v.snippet ?? {};
      const secs = isoSeconds(v.contentDetails?.duration);
      if (secs < MIN_SECONDS || secs > MAX_SECONDS) continue;
      if (v.status?.embeddable === false || v.status?.privacyStatus !== 'public') continue;
      if (s.liveBroadcastContent && s.liveBroadcastContent !== 'none') continue;
      if (v.contentDetails?.regionRestriction?.allowed) continue; // only plays in a few countries
      if (NOT_A_MOVIE.test(s.title) || ADULT.test(s.title)) continue;
      const thumbs = s.thumbnails ?? {};
      const image = (thumbs.maxres ?? thumbs.standard ?? thumbs.high ?? thumbs.medium)?.url;
      const yearInTitle = /\b(19[5-9]\d|20[0-3]\d)\b/.exec(s.title)?.[1];
      films.push({
        id: `yt-${v.id}`,
        t: cleanTitle(s.title),
        yt: v.id,
        p: image,
        b: image,
        // Only a year written in the title is the film's year; the upload date often isn't (old films get re-uploaded)
        y: yearInTitle ? Number(yearInTitle) : undefined,
        len: secs,
        d: cleanDescription(s.description),
        g: [channel.name],
        at: s.publishedAt,
      });
      if (films.length >= PER_CHANNEL) break;
    }
    pageToken = list.nextPageToken;
    if (!pageToken) break;
  }
  log(`    ${channel.name}: ${films.length}`);
  return films;
}

/** Returns { movies, movieRows }; empty when there is no API key or YouTube is unreachable. */
export async function buildYouTubeMovies(log = console.log) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    log('YouTube: no YOUTUBE_API_KEY set, skipping studio movies');
    return { movies: [], movieRows: [] };
  }
  // Never print the key itself, only whether it has the shape of a standard Google API key
  if (!/^AIza[\w-]{35}$/.test(key.trim())) {
    log(`YouTube: YOUTUBE_API_KEY doesn't look like a standard API key (expected "AIza…", 39 characters; got ${key.trim().length} characters)`);
  }
  const movies = [];
  const movieRows = [];
  for (const row of YOUTUBE_ROWS) {
    log(`  YouTube ${row.title}`);
    const films = [];
    for (const channel of row.channels) {
      try {
        films.push(...(await channelFilms(channel, key, log)));
      } catch (err) {
        log(`    ! ${channel.name}: ${err.message}`);
      }
    }
    // Newest first so the row always opens on fresh releases
    films.sort((a, b) => String(b.at).localeCompare(String(a.at)));
    const unique = [...new Map(films.map((f) => [f.id, f])).values()];
    if (unique.length < 6) continue;
    const { channels, ...meta } = row;
    movieRows.push({ ...meta, ids: unique.map((f) => f.id) });
    for (const { at, ...film } of unique) movies.push(film);
  }
  log(`YouTube: ${movies.length} films in ${movieRows.length} rows`);
  return { movies, movieRows };
}
