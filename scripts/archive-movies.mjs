// Public-domain movies from the Internet Archive (https://archive.org) for the on-demand "Movies" section.
// Used by build-catalog.mjs. For each film we resolve the playable MP4s and the best poster image at build
// time so the app can play instantly without extra lookups.

const SEARCH = 'https://archive.org/advancedsearch.php';
const META = 'https://archive.org/metadata';
const DOWNLOAD = 'https://archive.org/download';

// Adult/exploitation uploads exist in the big collections; keep them out.
const BLOCK = /\b(sex|sexy|sexual|sexploit\w*|nudi\w*|nude|nudity|erotic\w*|porn\w*|xxx|stag film|striptease|stripp\w*|burlesque|exploitation|peep ?show|nympho\w*|playboy|adult film|hot rod girls|drug|marihuana|marijuana|reefer|naked|molest\w*|nazi\w*|concentration camps?|birth of a nation|triumph of the will|propaganda)\b/i;

// Rows shown in the app, in order. `q` is an archive.org search query.
export const MOVIE_ROWS = [
  { id: 'm-popular', title: 'Most-Watched Classics', emoji: '🍿', colors: ['#F7971E', '#E52E71'], q: 'collection:feature_films', take: 40 },
  { id: 'm-noir', title: 'Film Noir', emoji: '🕶️', colors: ['#232526', '#414345'], q: 'collection:Film_Noir', take: 40 },
  { id: 'm-scifi-horror', title: 'Sci-Fi & Horror Classics', emoji: '🧟', colors: ['#00C9FF', '#3A1C71'], q: 'collection:SciFi_Horror', take: 40 },
  { id: 'm-comedy', title: 'Comedy Gold', emoji: '🤣', colors: ['#F9D423', '#FF4E50'], q: 'collection:Comedy_Films', take: 40 },
  { id: 'm-western', title: 'Western Showdowns', emoji: '🐎', colors: ['#C79081', '#8E5B3E'], q: 'collection:feature_films AND subject:western', take: 30 },
  { id: 'm-action', title: 'Action & Adventure', emoji: '⚔️', colors: ['#FF416C', '#7F00FF'], q: 'collection:feature_films AND (subject:action OR subject:adventure)', take: 30 },
  { id: 'm-silent', title: 'Silent Era', emoji: '🎩', colors: ['#614385', '#516395'], q: 'collection:silent_films', take: 30 },
  { id: 'm-cartoons', title: 'Classic Cartoons', emoji: '🐰', colors: ['#FDC830', '#F37335'], q: 'collection:classic_cartoons OR (collection:animationandcartoons AND year:[1920 TO 1960])', take: 40, kids: true },
];

async function getJson(url, attempts = 3) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'KinoWave catalog builder (github.com/kwamepeace/kinowave)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (i >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 1500 * i));
    }
  }
}

function text(value) {
  const s = Array.isArray(value) ? value.join(' ') : String(value ?? '');
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function blocked(doc) {
  return BLOCK.test(`${text(doc.title)} ${text(doc.subject)} ${text(doc.description).slice(0, 400)}`);
}

function titleKey(doc) {
  return text(doc.title).toLowerCase().replace(/^the\s+/, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '');
}

function yearOf(doc) {
  const y = Number(String(doc.year ?? doc.date ?? '').slice(0, 4));
  return Number.isFinite(y) && y > 1880 ? y : undefined;
}

async function search(q, rows) {
  const params = new URLSearchParams({ q: `(${q}) AND mediatype:movies`, rows: String(rows), output: 'json' });
  for (const f of ['identifier', 'title', 'year', 'date', 'subject', 'description', 'downloads']) params.append('fl[]', f);
  params.append('sort[]', 'downloads desc');
  const data = await getJson(`${SEARCH}?${params}`);
  return data.response?.docs ?? [];
}

function parseLength(len) {
  if (!len) return 0;
  if (/^\d+(\.\d+)?$/.test(len)) return Math.round(Number(len));
  return String(len).split(':').reduce((acc, n) => acc * 60 + Number(n), 0) || 0;
}

/** Picks playable files and artwork from an item's metadata, or null when it has no usable MP4. */
async function resolve(doc) {
  const meta = await getJson(`${META}/${encodeURIComponent(doc.identifier)}`).catch(() => null);
  if (!meta?.files) return null;
  const files = meta.files;
  const isOriginalMp4 = (f) => /\.mp4$/i.test(f.name) && /h\.264|mpeg4/i.test(f.format) && !/512kb/i.test(f.format);
  const mp4 = files
    .filter(isOriginalMp4)
    .sort((a, b) => Math.abs(Number(a.height || 480) - 540) - Math.abs(Number(b.height || 480) - 540))[0];
  const low = files.find((f) => /512kb/i.test(f.format) && /\.mp4$/i.test(f.name));
  const main = mp4 ?? low;
  if (!main) return null;

  // A real poster upload beats the auto-generated thumbnail
  const poster = files
    .filter((f) => /^(JPEG|PNG)$/i.test(f.format) && !/\.thumbs\//.test(f.name) && Number(f.size) < 3_000_000)
    .sort((a, b) => Number(b.size) - Number(a.size))[0];
  const stills = files.filter((f) => f.format === 'Thumbnail').map((f) => f.name);
  const still = stills.length ? stills[Math.floor(stills.length * 0.3)] : undefined;

  const base = `${DOWNLOAD}/${doc.identifier}/`;
  const enc = (name) => base + name.split('/').map(encodeURIComponent).join('/');
  const movie = {
    id: doc.identifier,
    t: text(doc.title).replace(/\s*\(\d{4}\)\s*$/, ''),
    u: enc(main.name),
  };
  if (low && low !== main) movie.lu = enc(low.name);
  movie.p = poster ? enc(poster.name) : `https://archive.org/services/img/${doc.identifier}`;
  if (still) movie.b = enc(still);
  const year = yearOf(doc);
  if (year) movie.y = year;
  const secs = parseLength(main.length ?? low?.length);
  if (secs) movie.len = secs;
  const desc = text(doc.description);
  if (desc) movie.d = desc.length > 280 ? `${desc.slice(0, 277).replace(/\s+\S*$/, '')}…` : desc;
  const subjects = (Array.isArray(doc.subject) ? doc.subject : String(doc.subject ?? '').split(/[;,]/))
    .map((s) => text(s).toLowerCase())
    .filter((s) => s && s.length < 24 && !/movie|film|feature|public domain/.test(s));
  if (subjects.length) movie.g = [...new Set(subjects)].slice(0, 3);
  return movie;
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]).catch(() => null);
      }
    }),
  );
  return out;
}

/** Returns { movies, rows } ready to merge into the catalog. Failures degrade to an empty section. */
export async function buildMovies(log = console.log) {
  const picked = new Map(); // identifier -> doc
  const seenTitles = new Map(); // normalised title -> identifier
  const rows = [];
  for (const row of MOVIE_ROWS) {
    let docs = [];
    try {
      docs = await search(row.q, row.take * 3);
    } catch (err) {
      log(`  ! archive.org search failed for ${row.id}: ${err.message}`);
    }
    const ids = [];
    for (const doc of docs) {
      if (ids.length >= row.take) break;
      if (blocked(doc)) continue;
      // Public domain is mostly pre-1970; skip newer films, and undated uploads from the open collection
      const year = yearOf(doc);
      if (year > 1970 || (row.q.startsWith('collection:feature_films') && !year)) continue;
      // The same film is often uploaded several times; keep the most-watched copy
      const key = titleKey(doc);
      const seen = seenTitles.get(key);
      if (seen && seen !== doc.identifier) {
        if (!ids.includes(seen)) ids.push(seen);
        continue;
      }
      seenTitles.set(key, doc.identifier);
      picked.set(doc.identifier, doc);
      ids.push(doc.identifier);
    }
    rows.push({ ...row, ids });
  }

  const docs = [...picked.values()];
  const resolved = await mapLimit(docs, 12, resolve);
  const movies = resolved.filter(Boolean);
  const ok = new Set(movies.map((m) => m.id));

  const outRows = rows
    .map(({ q, take, ...row }) => ({ ...row, ids: row.ids.filter((id) => ok.has(id)) }))
    .filter((row) => row.ids.length >= 6);
  log(`Movies: ${movies.length} films in ${outRows.length} rows`);
  for (const r of outRows) log(`  ${r.emoji} ${r.title}: ${r.ids.length}`);
  return { movies, movieRows: outRows };
}
