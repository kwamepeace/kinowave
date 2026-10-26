import { categoryLabel, type Catalog, type Channel, type Collection, type Movie, type MovieRow } from './types';

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{Mn}+/gu, '');
const terms = (q: string) => normalize(q).split(' ').filter(Boolean);

export type ChannelRow = { col: Collection; channels: Channel[] };
export type FilmRow = { row: MovieRow; movies: Movie[] };

/** Lookup tables and search over a loaded catalog. */
export class CatalogIndex {
  readonly channels: Channel[];
  readonly byId: Map<string, Channel>;
  /** Collections with their channels resolved, in catalog order. */
  readonly rows: ChannelRow[];
  readonly collectionById: Map<string, ChannelRow>;
  readonly movies: Movie[];
  readonly movieById: Map<string, Movie>;
  readonly movieRows: FilmRow[];
  readonly movieRowById: Map<string, FilmRow>;
  /** Countries that have channels, most channels first. */
  readonly countryCounts: [string, number][];
  readonly languageCounts: [string, number][];
  readonly categoryCounts: [string, number][];
  private readonly haystacks: string[];

  constructor(readonly catalog: Catalog, readonly isKids = false) {
    this.channels = catalog.channels;
    this.byId = new Map(this.channels.map((c) => [c.id, c]));
    this.rows = catalog.collections.map((col) => ({ col, channels: col.ids.flatMap((id) => this.byId.get(id) ?? []) }));
    this.collectionById = new Map(this.rows.map((r) => [r.col.id, r]));
    this.movies = catalog.movies;
    this.movieById = new Map(this.movies.map((m) => [m.id, m]));
    this.movieRows = catalog.movieRows
      .map((row) => ({ row, movies: row.ids.flatMap((id) => this.movieById.get(id) ?? []) }))
      .filter((r) => r.movies.length > 0);
    this.movieRowById = new Map(this.movieRows.map((r) => [r.row.id, r]));
    this.countryCounts = countBy(this.channels.map((c) => c.c));
    this.languageCounts = countBy(this.channels.flatMap((c) => c.la ?? []));
    this.categoryCounts = countBy(this.channels.flatMap((c) => c.g));
    this.haystacks = this.channels.map((ch) =>
      normalize(
        [
          ch.n,
          ch.nw ?? '',
          ch.c,
          catalog.countries[ch.c]?.n ?? '',
          ...(ch.la ?? []).map((l) => catalog.languages[l] ?? ''),
          ...ch.g.map(categoryLabel),
        ].join(' '),
      ),
    );
  }

  countryName = (code: string) => this.catalog.countries[code]?.n ?? code;
  countryFlag = (code: string) => this.catalog.countries[code]?.f || '🌐';
  languageName = (code: string) => this.catalog.languages[code] ?? code;

  /** Collections whose title matches the query, e.g. "bolly" → Bollywood Blockbusters. */
  matchingCollections(query: string): ChannelRow[] {
    const q = normalize(query).trim();
    if (q.length < 2) return [];
    const words = q.split(' ').filter(Boolean);
    return this.rows.filter(({ col }) => {
      const hay = normalize(`${col.title} ${col.subtitle ?? ''} ${col.id}`);
      return words.every((w) => hay.includes(w));
    });
  }

  search(query: string, limit = 200): Channel[] {
    const t = terms(query);
    if (t.length === 0) return [];
    const whole = t.join(' ');
    const scored: [Channel, number][] = [];
    for (let i = 0; i < this.channels.length; i++) {
      const hay = this.haystacks[i];
      if (!t.every((w) => hay.includes(w))) continue;
      const ch = this.channels[i];
      const name = normalize(ch.n);
      const bonus = name === whole ? 1000 : name.startsWith(t[0]) ? 400 : name.includes(t[0]) ? 200 : 0;
      scored.push([ch, ch.score + bonus]);
    }
    return scored.sort((a, b) => b[1] - a[1]).slice(0, limit).map((x) => x[0]);
  }

  searchMovies(query: string, limit = 60): Movie[] {
    const t = terms(query);
    if (t.length === 0) return [];
    return this.movies
      .filter((m) => {
        const hay = normalize(`${m.t} ${m.y ?? ''} ${(m.g ?? []).join(' ')} ${(m.d ?? '').slice(0, 120)}`);
        return t.every((w) => hay.includes(w));
      })
      .slice(0, limit);
  }

  /** Films that share a row with [movie]. */
  similarMovies(movie: Movie, limit = 18): Movie[] {
    const seen = new Set([movie.id]);
    const out: Movie[] = [];
    for (const r of this.movieRows) {
      if (!r.movies.some((m) => m.id === movie.id)) continue;
      for (const m of r.movies) if (!seen.has(m.id)) (seen.add(m.id), out.push(m));
    }
    return out.slice(0, limit);
  }

  /** "More like this": channels sharing collections, then category + country. */
  similarTo(channel: Channel, limit = 18): Channel[] {
    const seen = new Set([channel.id]);
    const out: Channel[] = [];
    const add = (c: Channel) => {
      if (!seen.has(c.id)) (seen.add(c.id), out.push(c));
    };
    for (const r of this.rows) if (r.channels.some((c) => c.id === channel.id)) r.channels.forEach(add);
    for (const c of this.channels) {
      if (out.length >= limit) break;
      if (c.c === channel.c && c.g.some((g) => channel.g.includes(g))) add(c);
    }
    return out.slice(0, limit);
  }

  byCountry = (code: string) => this.channels.filter((c) => c.c === code);
  byLanguage = (code: string) => this.channels.filter((c) => c.la?.includes(code));
  byCategory = (id: string) => this.channels.filter((c) => c.g.includes(id));

  /**
   * A copy containing only kids-safe content: kids/animation/family channels,
   * the Kids and Anime rows, and the cartoon movie rows.
   */
  forKids(): CatalogIndex {
    const kidsCategories = ['kids', 'animation', 'family'];
    const safe = this.channels.filter((ch) => ch.g.some((g) => kidsCategories.includes(g)) && !ch.g.includes('religious'));
    const safeIds = new Set(safe.map((c) => c.id));
    const cols = this.catalog.collections
      .filter((c) => c.id === 'kids' || c.id === 'anime')
      .map((c) => ({ ...c, ids: c.ids.filter((id) => safeIds.has(id)) }));
    const kidsRows = this.catalog.movieRows.filter((r) => r.kids);
    const kidsMovieIds = new Set(kidsRows.flatMap((r) => r.ids));
    return new CatalogIndex(
      {
        ...this.catalog,
        channels: safe,
        collections: cols,
        movieRows: kidsRows,
        movies: this.catalog.movies.filter((m) => kidsMovieIds.has(m.id)),
      },
      true,
    );
  }
}

function countBy(keys: string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const k of keys) m.set(k, (m.get(k) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}
