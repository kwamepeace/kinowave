import type { CatalogIndex } from './catalogIndex';
import { isGeoBlocked, isPartTime, MOVIE_PREFIX, type Channel, type Movie } from './types';
import type { WatchStat } from './store';

type Features = [string, number][];

/**
 * Content-based "For You" recommender, ported from the Android app.
 *
 * Every channel and film is described by features: its categories, country, languages, network,
 * the curated rows it belongs to, and (for films) its row and tags. A profile's taste is the sum of
 * the features of everything it watched, weighted by watch time, number of plays and recency
 * (half-life two weeks), plus everything saved to My List. Items are then ranked by how well their
 * features match the taste, with a small quality prior so reliable, high-res streams win ties.
 *
 * A brand-new profile has no history yet, so it starts from the browser's country and language.
 */
export class Recommender {
  private readonly channelRows = new Map<string, string[]>();
  private readonly filmRows = new Map<string, string[]>();
  private readonly taste = new Map<string, number>();
  /** Watched items, most engaged first. */
  readonly history: [string, number][];
  readonly hasHistory: boolean;

  constructor(
    private readonly index: CatalogIndex,
    stats: Record<string, WatchStat>,
    myList: string[],
    region: string,
    language: string,
    now = Date.now(),
  ) {
    for (const { col, channels } of index.rows) for (const ch of channels) push(this.channelRows, ch.id, col.id);
    for (const { row, movies } of index.movieRows) for (const m of movies) push(this.filmRows, m.id, row.id);

    const add = (f: string, w: number) => this.taste.set(f, (this.taste.get(f) ?? 0) + w);

    // Cold-start priors
    if (region) add(`cc:${region}`, 1.2);
    if (language) add(`lang:${language}`, 1.0);

    this.history = Object.entries(stats)
      .filter(([key]) => this.exists(key))
      .map(([key, st]): [string, number] => {
        const days = Math.max(0, now - st.last) / 86_400_000;
        const recency = Math.pow(0.5, days / 14);
        const engagement = Math.log(1 + st.seconds / 60) + 0.35 * st.plays;
        return [key, engagement * recency];
      })
      .sort((a, b) => b[1] - a[1]);

    for (const [key, w] of this.history) for (const [f, fw] of this.featuresOf(key)) add(f, w * fw);
    for (const key of myList) for (const [f, fw] of this.featuresOf(key)) add(f, 0.9 * fw);
    this.hasHistory = this.history.length > 0 || myList.length > 0;

    // Normalise so the strongest taste is worth 3 points, keeping the quality prior meaningful
    const top = Math.max(0, ...this.taste.values());
    if (top > 0) for (const [k, v] of this.taste) this.taste.set(k, (v / top) * 3);
  }

  private exists(key: string) {
    return key.startsWith(MOVIE_PREFIX) ? this.index.movieById.has(key.slice(2)) : this.index.byId.has(key);
  }

  /** Weighted features describing an item. Rows count most: they are the best genre signal we have. */
  private featuresOf(key: string): Features {
    if (key.startsWith(MOVIE_PREFIX)) {
      const m = this.index.movieById.get(key.slice(2));
      return m ? this.movieFeatures(m) : [];
    }
    const ch = this.index.byId.get(key);
    return ch ? this.channelFeatures(ch) : [];
  }

  private channelFeatures(ch: Channel): Features {
    const f: Features = [];
    for (const r of this.channelRows.get(ch.id) ?? []) f.push([`col:${r}`, 1.0]);
    for (const g of ch.g) f.push([`cat:${g}`, 0.6]);
    f.push([`cc:${ch.c}`, 0.5]);
    for (const l of (ch.la ?? []).slice(0, 2)) f.push([`lang:${l}`, 0.5]);
    if (ch.nw) f.push([`nw:${ch.nw}`, 0.4]);
    f.push(['kind:live', 0.3]);
    return f;
  }

  private movieFeatures(m: Movie): Features {
    const f: Features = [];
    for (const r of this.filmRows.get(m.id) ?? []) f.push([`mrow:${r}`, 1.0]);
    for (const t of m.g ?? []) f.push([`tag:${t}`, 0.5]);
    if (m.y) f.push([`decade:${Math.floor(m.y / 10)}`, 0.3]);
    f.push(['kind:movie', 0.3]);
    return f;
  }

  private match(features: Features) {
    let s = 0;
    for (const [f, w] of features) s += (this.taste.get(f) ?? 0) * w;
    return s;
  }

  score(ch: Channel): number {
    const unreliable = isGeoBlocked(ch) || isPartTime(ch) ? 0.6 : 0;
    return this.match(this.channelFeatures(ch)) + ch.score / 150 - unreliable;
  }

  scoreMovie(m: Movie): number {
    return this.match(this.movieFeatures(m)) + (m.p && !m.p.includes('services/img') ? 0.2 : 0);
  }

  /** How much this profile likes a curated row: its own weight plus how well its best items match. */
  rowScore(collectionId: string, channels: Channel[]): number {
    return (this.taste.get(`col:${collectionId}`) ?? 0) * 2 + avg(channels.slice(0, 8).map((c) => this.score(c))) * 0.5;
  }

  movieRowScore(rowId: string, movies: Movie[]): number {
    return (this.taste.get(`mrow:${rowId}`) ?? 0) * 2 + avg(movies.slice(0, 8).map((m) => this.scoreMovie(m))) * 0.5;
  }

  /** Best-matching channels, skipping hidden ones and keeping rows varied. */
  topChannels(limit: number, hide: (c: Channel) => boolean = () => false): Channel[] {
    const perRow = new Map<string, number>();
    const out: Channel[] = [];
    const ranked = this.index.channels
      .filter((c) => !hide(c) && c.l)
      .map((c) => [c, this.score(c)] as const)
      .sort((a, b) => b[1] - a[1]);
    for (const [ch] of ranked) {
      // At most 4 picks from the same curated row, so one genre can't take over
      const row = this.channelRows.get(ch.id)?.[0] ?? 'none';
      const n = perRow.get(row) ?? 0;
      if (n >= 4) continue;
      perRow.set(row, n + 1);
      out.push(ch);
      if (out.length >= limit) break;
    }
    return out;
  }

  topMovies(limit: number): Movie[] {
    return [...this.index.movies].sort((a, b) => this.scoreMovie(b) - this.scoreMovie(a)).slice(0, limit);
  }

  /** The most engaging recent item, for a "Because you watched…" row. */
  seed(): string | undefined {
    return this.history[0]?.[0];
  }
}

function push(map: Map<string, string[]>, key: string, value: string) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const ISO3: Record<string, string> = {
  en: 'eng', fr: 'fra', es: 'spa', pt: 'por', de: 'deu', it: 'ita', nl: 'nld', ru: 'rus', uk: 'ukr', pl: 'pol',
  tr: 'tur', ar: 'ara', fa: 'fas', he: 'heb', hi: 'hin', ur: 'urd', bn: 'ben', ta: 'tam', te: 'tel', ml: 'mal',
  kn: 'kan', mr: 'mar', gu: 'guj', pa: 'pan', zh: 'zho', ja: 'jpn', ko: 'kor', th: 'tha', vi: 'vie', id: 'ind',
  ms: 'msa', tl: 'tgl', fil: 'fil', sw: 'swa', am: 'amh', ha: 'hau', yo: 'yor', ig: 'ibo', zu: 'zul', af: 'afr',
  el: 'ell', ro: 'ron', hu: 'hun', cs: 'ces', sk: 'slk', sv: 'swe', no: 'nor', nb: 'nob', da: 'dan', fi: 'fin',
  sr: 'srp', hr: 'hrv', bg: 'bul', sq: 'sqi', az: 'aze', ka: 'kat', hy: 'hye', kk: 'kaz', uz: 'uzb', ne: 'nep',
  si: 'sin', km: 'khm', my: 'mya', ps: 'pus', ku: 'kur', so: 'som', tw: 'twi', ak: 'aka', ee: 'ewe',
};

/** The viewer's country from the browser locale, e.g. "GH" for en-GH ("GB" is "UK" in iptv-org). */
export function browserRegion(): string {
  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      // Only an explicit region: guessing "US" for plain "en" would skew Top 10 for everyone else
      const region = new Intl.Locale(tag).region;
      if (region) return region === 'GB' ? 'UK' : region;
    } catch {
      /* ignore malformed tags */
    }
  }
  return '';
}

/** The browser language as an iptv-org code ("eng", "hin", "fra"...). */
export function browserLanguage(): string {
  const base = (navigator.language || '').split('-')[0].toLowerCase();
  return ISO3[base] ?? '';
}
