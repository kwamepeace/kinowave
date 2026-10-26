import type { CatalogIndex } from './catalogIndex';
import { Recommender } from './recommender';
import type { Prefs } from './store';
import { isUnreliable, MOVIE_PREFIX, type Channel, type Collection, type Movie, type MovieRow } from './types';

export type HomeFilter = 'all' | 'movies' | 'tv';
export const HOME_FILTERS: [HomeFilter, string][] = [
  ['all', 'For You'],
  ['movies', 'Movies'],
  ['tv', 'TV & Live'],
];

/** One card in the hero carousel: a live channel or an on-demand film. */
export interface HeroItem {
  key: string;
  title: string;
  pill: string;
  colors: string[];
  channel?: Channel;
  movie?: Movie;
}

export type HomeRow =
  | { kind: 'channels'; key: string; col: Collection; channels: Channel[] }
  | { kind: 'movies'; key: string; row: MovieRow; movies: Movie[] };

export interface HomeContent {
  hero: HeroItem[];
  top10: Channel[];
  regionCode: string | null;
  rows: HomeRow[];
}

const channelRow = (col: Collection, channels: Channel[]): HomeRow => ({ kind: 'channels', key: `c-${col.id}`, col, channels });
const movieRow = (row: MovieRow, movies: Movie[]): HomeRow => ({ kind: 'movies', key: `m-${row.id}`, row, movies });

export function buildHome(
  index: CatalogIndex,
  filter: HomeFilter,
  prefs: Prefs,
  regionCode: string,
  language: string,
  profileName?: string,
): HomeContent {
  const hide = prefs.hideUnreliable;
  const clean = (list: Channel[]) => (hide ? list.filter((c) => !isUnreliable(c)) : list);
  const rec = new Recommender(index, prefs.stats, prefs.myList, regionCode, language);

  // Curated rows, each re-ranked for this profile, and the rows themselves ordered by taste
  const channelRows = index.rows
    .filter(({ col }) =>
      filter === 'all' ? col.id !== 'faith' : filter === 'movies' ? col.tab === 'movies' || col.tab === 'all' : col.tab === 'tv' || col.tab === 'all',
    )
    .map(({ col, channels }) => ({ col, channels: clean(channels) }))
    .filter((r) => r.channels.length >= 4)
    .map(({ col, channels }) => {
      const scored = channels.map((c) => [c, rec.score(c)] as const).sort((a, b) => b[1] - a[1]);
      return { row: channelRow(col, scored.slice(0, 40).map((x) => x[0])), score: rec.rowScore(col.id, channels) };
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row as Extract<HomeRow, { kind: 'channels' }>);

  const filmRows = index.movieRows
    .map(({ row, movies }) => ({
      row: movieRow(row, [...movies].sort((a, b) => rec.scoreMovie(b) - rec.scoreMovie(a))),
      score: rec.movieRowScore(row.id, movies),
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.row as Extract<HomeRow, { kind: 'movies' }>);

  // Personal rows: top picks, "because you watched", and films picked for you
  const personal: HomeRow[] = [];
  const picks = rec.topChannels(20, (c) => hide && isUnreliable(c));
  const moviePicks = filter === 'tv' ? [] : rec.topMovies(20);
  if (filter === 'all') {
    const who = profileName?.trim() && rec.hasHistory ? profileName.trim() : null;
    if (picks.length >= 6) {
      personal.push(
        channelRow({ id: 'fy-picks', title: who ? `Top picks for ${who}` : 'Picked for you', emoji: '✨', colors: ['#FF2D6F', '#8B5CF6'], ids: [] }, picks),
      );
    }
    const seed = rec.seed();
    if (seed?.startsWith(MOVIE_PREFIX)) {
      const m = index.movieById.get(seed.slice(2));
      const similar = m ? index.similarMovies(m, 20).sort((a, b) => rec.scoreMovie(b) - rec.scoreMovie(a)) : [];
      if (m && similar.length >= 4) personal.push(movieRow({ id: 'fy-because', title: `Because you watched ${m.t}`, emoji: '👀', ids: [] }, similar));
    } else if (seed) {
      const ch = index.byId.get(seed);
      const similar = ch ? clean(index.similarTo(ch, 30)).sort((a, b) => rec.score(b) - rec.score(a)).slice(0, 20) : [];
      if (ch && similar.length >= 4) {
        personal.push(
          channelRow({ id: 'fy-because', title: `Because you watched ${ch.n}`, emoji: '👀', colors: ['#00C9FF', '#7F00FF'], ids: [] }, similar),
        );
      }
    }
    if (moviePicks.length >= 6) personal.push(movieRow({ id: 'fy-movies', title: 'Movies picked for you', emoji: '🍿', ids: [] }, moviePicks));
  }

  let rows: HomeRow[];
  if (filter === 'movies') rows = [...filmRows, ...channelRows];
  else if (filter === 'tv') rows = channelRows;
  else {
    // Personal rows first, then the best-matching rows with a film row woven in every two
    rows = [...personal];
    let f = 0;
    channelRows.forEach((row, i) => {
      rows.push(row);
      if (i % 2 === 1 && f < filmRows.length) rows.push(filmRows[f++]);
    });
    rows.push(...filmRows.slice(f));
  }

  // Hero: personal picks once there's history, otherwise the leaders of the best-matching rows
  const used = new Set<string>();
  const pickPill = rec.hasHistory ? '✨ Picked for you' : null;
  const channelSource: [string, Channel][] =
    rec.hasHistory && filter !== 'movies'
      ? picks.map((c) => ['fy', c])
      : channelRows.flatMap((r) => {
          const lead = r.channels.find((c) => c.l);
          return lead ? [[r.col.id, lead] as [string, Channel]] : [];
        });
  const channelHeroes: HeroItem[] = channelSource
    .slice(0, filter === 'movies' ? 3 : 6)
    .filter(([, ch]) => !used.has(ch.id) && used.add(ch.id))
    .map(([colId, ch]) => {
      const col = index.collectionById.get(colId)?.col;
      return {
        key: `c-${ch.id}`,
        title: ch.n,
        pill: pickPill ?? `${col?.emoji ?? ''} ${col?.title ?? ''}`.trim(),
        colors: col?.colors ?? ['#FF2D6F', '#8B5CF6'],
        channel: ch,
      };
    });
  const movieSource: [MovieRow | null, Movie][] = rec.hasHistory
    ? moviePicks.map((m) => [null, m])
    : filmRows.flatMap((r) => (r.movies[0] ? [[r.row, r.movies[0]] as [MovieRow, Movie]] : []));
  const movieHeroes: HeroItem[] =
    filter === 'tv'
      ? []
      : movieSource
          .slice(0, 4)
          .filter(([, m]) => !used.has(m.id) && used.add(m.id))
          .map(([row, m]) => ({
            key: `m-${m.id}`,
            title: m.t,
            pill: pickPill ?? `${row?.emoji ?? ''} Free movie`.trim(),
            colors: row?.colors ?? [],
            movie: m,
          }));
  let hero: HeroItem[];
  if (filter === 'movies') hero = [...movieHeroes, ...channelHeroes];
  else {
    hero = [];
    const n = Math.max(channelHeroes.length, movieHeroes.length);
    for (let i = 0; i < n; i++) {
      if (channelHeroes[i]) hero.push(channelHeroes[i]);
      if (movieHeroes[i]) hero.push(movieHeroes[i]);
    }
  }

  const region = regionCode && !index.isKids && index.channels.filter((c) => c.c === regionCode).length >= 10 ? regionCode : null;
  const regional = region ? clean(index.byCountry(region)).filter((c) => !c.g.includes('religious') && !c.g.includes('shop')) : null;
  const top10 = (regional ?? clean(index.rows[0]?.channels ?? [])).filter((c) => c.l).slice(0, 10);

  return { hero, top10, regionCode: region, rows };
}
