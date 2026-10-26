#!/usr/bin/env node
// Builds the compact KinoWave catalog from the iptv-org API (https://github.com/iptv-org/api).
//
//   node scripts/build-catalog.mjs [--api <dir with api json files>] [--out <file>]... [--no-movies]
//
// Without --api the JSON files are downloaded from https://iptv-org.github.io/api.
// Default output: app/src/main/assets/catalog.json

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { buildMovies } from './archive-movies.mjs';

const API_BASE = 'https://iptv-org.github.io/api';

const args = process.argv.slice(2);
const apiDir = argValue('--api');
const outputs = argValues('--out');
if (outputs.length === 0) outputs.push('app/src/main/assets/catalog.json');

function argValue(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}
function argValues(name) {
  return args.flatMap((a, i) => (a === name ? [args[i + 1]] : []));
}

async function load(name) {
  if (apiDir) return JSON.parse(await readFile(join(apiDir, `${name}.json`), 'utf8'));
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(`${API_BASE}/${name}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt >= 3) throw new Error(`Failed to download ${name}.json: ${err.message}`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

const [channels, streams, feeds, logos, countries, languages, blocklist] = await Promise.all(
  ['channels', 'streams', 'feeds', 'logos', 'countries', 'languages', 'blocklist'].map(load),
);

// ---------------------------------------------------------------- channels

const blocked = new Set(blocklist.map((b) => b.channel));
const channelById = new Map(
  channels
    .filter((c) => !c.is_nsfw && !c.closed && !blocked.has(c.id) && !c.categories.includes('xxx'))
    .map((c) => [c.id, c]),
);

const languagesByChannel = new Map();
for (const f of feeds) {
  if (!channelById.has(f.channel)) continue;
  const set = languagesByChannel.get(f.channel) ?? new Set();
  // Main feed languages first
  if (f.is_main) f.languages.forEach((l) => set.add(l));
  languagesByChannel.set(f.channel, set);
}
for (const f of feeds) {
  if (!channelById.has(f.channel) || f.is_main) continue;
  f.languages.forEach((l) => languagesByChannel.get(f.channel)?.add(l));
}

const logoByChannel = new Map();
const logoRank = (l) =>
  (l.feed ? 0 : 4) + (l.in_use ? 2 : 0) + (['PNG', 'WebP', 'JPEG'].includes(l.format) ? 1 : -10);
for (const l of logos) {
  if (!channelById.has(l.channel) || l.format === 'SVG') continue;
  const current = logoByChannel.get(l.channel);
  if (!current || logoRank(l) > logoRank(current)) logoByChannel.set(l.channel, l);
}

function qualityNumber(q) {
  const m = /^(\d+)/.exec(q ?? '');
  return m ? Number(m[1]) : 0;
}

const streamsByChannel = new Map();
for (const s of streams) {
  if (!s.channel || !channelById.has(s.channel) || !/^https?:\/\//.test(s.url)) continue;
  const list = streamsByChannel.get(s.channel) ?? [];
  if (list.some((x) => x.u === s.url)) continue;
  const out = { u: s.url };
  if (s.quality) out.q = s.quality;
  if (s.user_agent) out.ua = s.user_agent;
  if (s.referrer) out.r = s.referrer;
  if (s.labels.includes('Geo-blocked')) out.gb = true;
  if (s.labels.includes('Not 24/7')) out.p = true;
  list.push(out);
  streamsByChannel.set(s.channel, list);
}

const streamScore = (s) =>
  (s.gb ? -1000 : 0) + (s.p ? -500 : 0) + (s.u.startsWith('https') ? 50 : 0) + Math.min(qualityNumber(s.q), 1080) / 10;

const out = [];
for (const [id, list] of streamsByChannel) {
  const c = channelById.get(id);
  list.sort((a, b) => streamScore(b) - streamScore(a));
  const logo = logoByChannel.get(id);
  const ch = { id, n: c.name, c: c.country, g: c.categories, s: list };
  if (logo) ch.l = logo.url;
  const langs = [...(languagesByChannel.get(id) ?? [])];
  if (langs.length) ch.la = langs;
  if (c.network) ch.nw = c.network;
  out.push(ch);
}

// Higher score = more likely to be a good, watchable channel
function channelScore(ch) {
  const best = ch.s[0];
  let score = 0;
  if (ch.l) score += 40;
  score += Math.min(qualityNumber(best.q), 1080) / 18; // up to 60
  if (!best.gb) score += 35;
  if (!best.p) score += 20;
  if (best.u.startsWith('https')) score += 10;
  score += Math.min(ch.s.length - 1, 3) * 4;
  if (ch.nw) score += 6;
  if (ch.g.length === 0) score -= 10;
  return score;
}
for (const ch of out) ch.score = Math.round(channelScore(ch));
out.sort((a, b) => b.score - a.score || a.n.localeCompare(b.n));

// ---------------------------------------------------------------- collections

const AFRICA = 'DZ AO BJ BW BF BI CV CM CF TD KM CD CG CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW'.split(' ');
const LATAM = 'AR BO BR CL CO CR CU DO EC SV GT HN MX NI PA PY PE PR UY VE'.split(' ');
const ARAB = 'AE BH DZ EG IQ JO KW LB LY MA OM PS QA SA SD SY TN YE'.split(' ');
const FICTION = ['movies', 'series', 'entertainment', 'classic', 'comedy', 'family', 'general', 'animation', 'kids'];
const NOT_FUN = ['religious', 'shop', 'legislative', 'news', 'business', 'weather', 'education', 'public'];

const has = (ch, cats) => ch.g.some((g) => cats.includes(g));
const lang = (ch, langs) => (ch.la ?? []).some((l) => langs.includes(l));
const name = (ch, re) => re.test(ch.n) || (ch.nw ? re.test(ch.nw) : false);
const fun = (ch) => !has(ch, NOT_FUN);

// tab: which home filter the row belongs to ("movies", "tv" or "all")
const COLLECTIONS = [
  {
    id: 'bollywood', title: 'Bollywood Blockbusters', emoji: '💃', tab: 'movies', colors: ['#FF8A00', '#E52E71'],
    subtitle: 'Hindi cinema, filmi hits & desi drama',
    prefer: ['movies'],
    rule: (ch) =>
      fun(ch) &&
      !has(ch, ['music']) &&
      !name(ch, /bhojpuri|punjabi|bangla|marathi/i) &&
      (name(ch, /bolly|filmi|goldmines|b4u|zee cinema|zee anmol|sony max|star gold|sony pix|colors cineplex|movies ok|manoranjan|dangal|shemaroo|anmol|pitaara|india talkies|indywood|\bdesi\b/i) ||
        ((ch.c === 'IN' || lang(ch, ['hin', 'urd'])) && has(ch, ['movies', 'entertainment', 'series', 'classic']) && !lang(ch, ['tam', 'tel', 'mal', 'kan', 'ben', 'mar', 'pan', 'guj', 'bho']))),
  },
  {
    id: 'south-indian', title: 'South Indian Cinema', emoji: '🔥', tab: 'movies', colors: ['#F7971E', '#C2185B'],
    subtitle: 'Tollywood, Kollywood, Mollywood & Sandalwood',
    prefer: ['movies'],
    rule: (ch) => fun(ch) && lang(ch, ['tam', 'tel', 'mal', 'kan']) && has(ch, ['movies', 'entertainment', 'series', 'general', 'music']),
  },
  {
    id: 'desi-regional', title: 'Punjabi, Bhojpuri & Bangla', emoji: '🪘', tab: 'tv', colors: ['#F857A6', '#FF5858'],
    subtitle: 'Regional Indian entertainment',
    rule: (ch) => fun(ch) && lang(ch, ['pan', 'bho', 'ben', 'mar', 'guj']) && has(ch, ['movies', 'entertainment', 'series', 'music', 'general', 'comedy']),
  },
  {
    id: 'hollywood', title: 'Hollywood Movies', emoji: '🎬', tab: 'movies', colors: ['#7F00FF', '#E100FF'],
    subtitle: '24/7 English-language movie channels',
    rule: (ch) => has(ch, ['movies']) && ['US', 'UK', 'CA', 'AU', 'NZ', 'IE'].includes(ch.c) && !lang(ch, ['spa', 'por', 'fra', 'hin']) && !name(ch, /nolly|bolly/i),
  },
  {
    id: 'action', title: 'Action & Adventure', emoji: '💥', tab: 'movies', colors: ['#FF416C', '#FF4B2B'],
    prefer: ['movies'],
    rule: (ch) =>
      fun(ch) && !has(ch, ['documentary', 'travel', 'sports', 'outdoor', 'comedy']) && !name(ch, /mr bean|sport/i) &&
      name(ch, /action|acci[oó]n|a[cç][aã]o|adrenal|fury|fight|luta|aventura|adventure|bang bang|kadak|military|martial|kung ?fu/i),
  },
  {
    id: 'horror', title: 'Horror & Thrillers', emoji: '👻', tab: 'movies', colors: ['#232526', '#B20A2C'],
    rule: (ch) => fun(ch) && name(ch, /horror|terror|scream|fright|thriller|suspens|ghost|zombie|z nation|walking dead|paranormal|haunt|supernatural|creepy|chiller/i),
  },
  {
    id: 'comedy', title: 'Laugh Out Loud', emoji: '😂', tab: 'all', colors: ['#F9D423', '#FF4E50'],
    rule: (ch) => !has(ch, NOT_FUN) && !has(ch, ['music']) && (has(ch, ['comedy']) || name(ch, /comed|comic|funny|laugh|humou?r|risas|sitcom/i)),
  },
  {
    id: 'crime', title: 'Crime & Mystery', emoji: '🕵️', tab: 'tv', colors: ['#141E30', '#3A6073'],
    rule: (ch) => fun(ch) && !name(ch, /science theater/i) && name(ch, /crime|crimen|csi|ncis|fbi|detective|cops|murder|forensic|investiga|mystery|misterio|homicide|cold case|unsolved|midsomer|criminal/i),
  },
  {
    id: 'scifi', title: 'Sci-Fi & Fantasy', emoji: '🛸', tab: 'all', colors: ['#00C9FF', '#7F00FF'],
    rule: (ch) =>
      fun(ch) && !has(ch, ['music']) && !name(ch, /radio|\bfm\b/i) &&
      name(ch, /sci-?fi|syfy|star trek|jornada nas estrelas|\bfantas(y|tic|tica|tika|tique)\b|\baliens?\b|fic[cç][aã]o|outersphere|battlestar|farscape|doctor who|andromeda|dark matter|stargate|twilight zone/i),
  },
  {
    id: 'romance', title: 'Romance & Feel-Good', emoji: '💘', tab: 'movies', colors: ['#FF5F6D', '#FFC371'],
    prefer: ['movies'],
    rule: (ch) =>
      fun(ch) && !has(ch, ['music', 'documentary', 'outdoor', 'lifestyle']) && !name(ch, /nature|pets?\b|planet|loveland|musica|radio/i) &&
      name(ch, /romanc|rom[aá]nti|amor|love|feel good|hallmark|wedding|cine drama|drama movies/i),
  },
  {
    id: 'kdrama', title: 'K-Drama & Asian Hits', emoji: '🫰', tab: 'tv', colors: ['#FC466B', '#3F5EFB'],
    subtitle: 'Korean, Chinese, Japanese & Thai entertainment',
    rule: (ch) =>
      fun(ch) &&
      !has(ch, ['cooking', 'lifestyle']) &&
      !name(ch, /\bpet|food|gugak/i) &&
      (name(ch, /korea|coreano|k\.?movies|k-?drama|kdrama|viki|asiancrush|asianbox|asian culture|k-?pop|kix\b/i) ||
        (['KR', 'JP', 'TW', 'TH', 'CN', 'HK', 'PH'].includes(ch.c) && has(ch, ['movies', 'series', 'entertainment', 'animation']))),
  },
  {
    id: 'anime', title: 'Anime & Animation', emoji: '🍥', tab: 'tv', colors: ['#8E2DE2', '#4A00E0'],
    rule: (ch) => has(ch, ['animation']) || name(ch, /anime|cartoon|toon|retrocrush|desenhos|dibujos|manga/i),
  },
  {
    id: 'nollywood', title: 'Nollywood & African Vibes', emoji: '🌍', tab: 'all', colors: ['#11998E', '#F7B733'],
    subtitle: 'Nigeria, Ghana, Kenya, South Africa & more',
    prefer: ['movies', 'entertainment', 'series'],
    rule: (ch) =>
      (AFRICA.includes(ch.c) && !ARAB.includes(ch.c) && fun(ch) && has(ch, [...FICTION, 'music', 'culture', 'lifestyle'])) ||
      name(ch, /nolly|africa magic|afrobeat|afroland/i),
  },
  {
    id: 'telenovelas', title: 'Telenovelas', emoji: '🌹', tab: 'tv', colors: ['#EE0979', '#FF6A00'],
    rule: (ch) => name(ch, /novela|telenovela|tlnovelas|saga/i) || (LATAM.includes(ch.c) && has(ch, ['series'])),
  },
  {
    id: 'latino', title: 'Cine Latino', emoji: '🌶️', tab: 'movies', colors: ['#F00000', '#DC281E'],
    rule: (ch) => has(ch, ['movies']) && (lang(ch, ['spa', 'por']) || LATAM.includes(ch.c) || ch.c === 'ES'),
  },
  {
    id: 'turkish', title: 'Turkish Dramas', emoji: '🧿', tab: 'tv', colors: ['#E53935', '#E35D5B'],
    rule: (ch) => (ch.c === 'TR' || lang(ch, ['tur'])) && has(ch, ['series', 'entertainment', 'movies', 'general']),
  },
  {
    id: 'arabic', title: 'Arabic Entertainment', emoji: '🌙', tab: 'tv', colors: ['#B79891', '#94716B'],
    rule: (ch) => (ARAB.includes(ch.c) || lang(ch, ['ara'])) && fun(ch) && has(ch, ['series', 'entertainment', 'movies', 'general', 'kids']),
  },
  {
    id: 'westerns', title: 'Wild West', emoji: '🤠', tab: 'movies', colors: ['#C79081', '#DFA579'],
    rule: (ch) => name(ch, /western|cowboy|gunsmoke|bonanza|rawhide|rifleman|wild wild west|wanted: dead/i),
  },
  {
    id: 'classics', title: 'Retro & Classics', emoji: '📼', tab: 'all', colors: ['#614385', '#516395'],
    rule: (ch) =>
      fun(ch) && !has(ch, ['music']) && !name(ch, /vevo|xite|now \d0s|radio/i) &&
      (has(ch, ['classic']) || name(ch, /retro|classic|cl[aá]sic|70s|80s|90s|00s|nostalg|rewind|throwback|oldies|vintage|vault|golden/i)),
  },
  {
    id: 'reality', title: 'Reality TV', emoji: '📱', tab: 'tv', colors: ['#FF0099', '#493240'],
    rule: (ch) =>
      fun(ch) && !has(ch, ['music']) &&
      name(ch, /reality|survivor|jersey shore|challenge|love island|bar rescue|hell's kitchen|masterchef|wipeout|fear factor|dating|teen mom|love & hip hop|storage wars|pawn|bounty/i),
  },
  {
    id: 'sports', title: 'Sports Live', emoji: '⚽', tab: 'tv', colors: ['#56AB2F', '#A8E063'],
    rule: (ch) => has(ch, ['sports', 'auto']) && !name(ch, /kisan/i),
  },
  {
    id: 'kids', title: 'Kids & Family', emoji: '🧸', tab: 'tv', colors: ['#FDC830', '#F37335'],
    rule: (ch) => has(ch, ['kids', 'family']) && !has(ch, ['religious']),
  },
  {
    id: 'music', title: 'Music & Vibes', emoji: '🎧', tab: 'tv', colors: ['#DA22FF', '#9733EE'],
    rule: (ch) => has(ch, ['music']) && !has(ch, ['religious']),
  },
  {
    id: 'docs', title: 'Docs, Nature & Science', emoji: '🦁', tab: 'tv', colors: ['#134E5E', '#71B280'],
    rule: (ch) => has(ch, ['documentary', 'science', 'travel']) || name(ch, /nature|wild|discovery|nat ?geo|history/i),
  },
  {
    id: 'food', title: 'Food & Lifestyle', emoji: '🍜', tab: 'tv', colors: ['#F2994A', '#F2C94C'],
    rule: (ch) => has(ch, ['cooking', 'lifestyle']),
  },
  {
    id: 'news', title: 'World News 24/7', emoji: '🌐', tab: 'tv', colors: ['#2193B0', '#6DD5ED'],
    rule: (ch) => has(ch, ['news', 'business', 'weather']),
  },
  {
    id: 'faith', title: 'Faith & Inspiration', emoji: '🕊️', tab: 'tv', colors: ['#5C258D', '#4389A2'],
    rule: (ch) => has(ch, ['religious']),
  },
];

const collections = [];
for (const col of COLLECTIONS) {
  // Prefer channels with logos and working-looking streams; cap row length to keep the file small
  const boost = (ch) => ch.score + (col.prefer && has(ch, col.prefer) ? 40 : 0);
  const ids = out
    .filter(col.rule)
    .sort((a, b) => boost(b) - boost(a))
    .slice(0, 120)
    .map((ch) => ch.id);
  if (ids.length < 6) continue;
  const { rule, prefer, ...meta } = col;
  collections.push({ ...meta, ids });
}

// ---------------------------------------------------------------- write

const { movies, movieRows } = args.includes('--no-movies') ? { movies: [], movieRows: [] } : await buildMovies();

const usedCountries = new Set(out.map((c) => c.c));
const usedLanguages = new Set(out.flatMap((c) => c.la ?? []));
const catalog = {
  updated: new Date().toISOString(),
  countries: Object.fromEntries(
    countries.filter((c) => usedCountries.has(c.code)).map((c) => [c.code, { n: c.name, f: c.flag }]),
  ),
  languages: Object.fromEntries(languages.filter((l) => usedLanguages.has(l.code)).map((l) => [l.code, l.name])),
  collections,
  channels: out,
  movies,
  movieRows,
};

const json = JSON.stringify(catalog);
for (const file of outputs) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, json);
}

console.log(`Catalog: ${out.length} channels, ${collections.length} collections, ${(json.length / 1e6).toFixed(2)} MB`);
for (const c of collections) console.log(`  ${c.emoji} ${c.title}: ${c.ids.length}`);
