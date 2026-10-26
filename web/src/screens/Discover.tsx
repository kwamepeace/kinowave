import { useDeferredValue, useMemo, useState } from 'react';
import { useApp } from '../context';
import type { ChannelRow, FilmRow } from '../data/catalogIndex';
import { prefs as prefsStore, useStore } from '../data/store';
import { categoryLabel, colorsOf, gradient, isUnreliable } from '../data/types';
import { nav, useNav } from '../nav';
import { Chip, MoviePoster, PosterCard, Rail, SearchField, useIncremental } from '../ui/components';

const QUICK_SEARCHES = ['Bollywood', 'Nollywood', 'K-Drama', 'Anime', 'Horror', 'Telenovelas', 'Sports', 'Comedy'];

/** Survives tab switches so coming back to Discover keeps the search. */
let lastQuery = '';

export function DiscoverScreen() {
  const { index, actions } = useApp();
  const { focusSearch } = useNav();
  const { hideUnreliable } = useStore(prefsStore);
  const [query, setQueryState] = useState(lastQuery);
  const setQuery = (q: string) => {
    lastQuery = q;
    setQueryState(q);
  };
  const deferred = useDeferredValue(query);

  const results = useMemo(() => {
    if (!deferred.trim()) return null;
    const channels = index.search(deferred);
    return {
      collections: index.matchingCollections(deferred),
      channels: hideUnreliable ? channels.filter((c) => !isUnreliable(c)) : channels,
      movies: index.searchMovies(deferred),
    };
  }, [index, deferred, hideUnreliable]);

  const [shown, sentinel] = useIncremental(results?.channels ?? []);

  return (
    <div className="screen">
      <div className="pad head-pad">
        <h1 className="display page-title">Discover</h1>
        <div style={{ marginTop: 14 }}>
          <SearchField query={query} onQuery={setQuery} autoFocus={focusSearch} />
        </div>
      </div>

      {!results ? (
        <Browse onQuickSearch={setQuery} />
      ) : (
        <div style={{ marginTop: 16 }}>
          {results.collections.length > 0 && (
            <Rail tight>
              {results.collections.map(({ col }) => (
                <Chip key={col.id} label={col.title} leading={col.emoji} selected onClick={() => nav.push({ page: { kind: 'collection', id: col.id } })} />
              ))}
            </Rail>
          )}
          {results.movies.length > 0 && (
            <>
              <h2 className="grid-title">Movies</h2>
              <Rail>
                {results.movies.map((m) => (
                  <MoviePoster key={m.id} movie={m} onOpen={() => actions.openMovie(m)} onPlay={() => actions.playMovie(m)} />
                ))}
              </Rail>
            </>
          )}
          <p className="pad low" style={{ margin: '18px 0 12px', fontSize: 13 }}>
            {results.channels.length === 0 ? `No channels match "${query}" yet. Try a country, language or genre.` : `${results.channels.length} channels`}
          </p>
          <div className="grid">
            {shown.map((ch) => (
              <PosterCard
                key={ch.id}
                channel={ch}
                fluid
                flag={index.countryFlag(ch.c)}
                onOpen={() => actions.open(ch)}
                onPlay={() => actions.play(ch, results.channels)}
              />
            ))}
          </div>
          {sentinel}
        </div>
      )}
    </div>
  );
}

function Browse({ onQuickSearch }: { onQuickSearch: (q: string) => void }) {
  const { index, region } = useApp();
  const countries = useMemo(() => {
    const codes = index.countryCounts.map(([c]) => c);
    return (codes.includes(region) ? [region, ...codes.filter((c) => c !== region)] : codes).slice(0, 60);
  }, [index, region]);

  return (
    <div style={{ marginTop: 16 }}>
      <Rail tight>
        {QUICK_SEARCHES.map((q) => (
          <Chip key={q} label={q} leading="🔎" onClick={() => onQuickSearch(q)} />
        ))}
      </Rail>

      <h2 className="grid-title">Browse by vibe</h2>
      <div className="tiles">
        {index.rows.map((r) => (
          <VibeTile key={r.col.id} row={r} />
        ))}
      </div>

      {index.movieRows.length > 0 && (
        <>
          <h2 className="grid-title">Free movies on demand</h2>
          <div className="tiles">
            {index.movieRows.map((r) => (
              <MovieVibeTile key={r.row.id} row={r} />
            ))}
          </div>
        </>
      )}

      <h2 className="grid-title">Countries</h2>
      <Rail tight>
        {countries.map((code) => (
          <Chip
            key={code}
            label={index.countryName(code)}
            leading={index.countryFlag(code)}
            selected={code === region}
            onClick={() => nav.push({ page: { kind: 'country', id: code } })}
          />
        ))}
      </Rail>

      <h2 className="grid-title">Languages</h2>
      <Rail tight>
        {index.languageCounts.slice(0, 40).map(([code]) => (
          <Chip key={code} label={index.languageName(code)} leading="🗣️" onClick={() => nav.push({ page: { kind: 'language', id: code } })} />
        ))}
      </Rail>

      <h2 className="grid-title">All categories</h2>
      <Rail tight>
        {index.categoryCounts.map(([id, count]) => (
          <Chip key={id} label={`${categoryLabel(id)} · ${count}`} onClick={() => nav.push({ page: { kind: 'category', id } })} />
        ))}
      </Rail>
    </div>
  );
}

function VibeTile({ row: { col, channels } }: { row: ChannelRow }) {
  return (
    <button className="tile press" style={{ background: gradient(colorsOf(col.colors, col.id)) }} onClick={() => nav.push({ page: { kind: 'collection', id: col.id } })}>
      <span className="emoji">{col.emoji}</span>
      <span className="text">
        <span className="t">{col.title}</span>
        <span className="n">{channels.length} channels</span>
      </span>
    </button>
  );
}

/** Movie row tile: the row's gradient with three posters fanned out. */
function MovieVibeTile({ row: { row, movies } }: { row: FilmRow }) {
  return (
    <button className="tile press" style={{ background: gradient(colorsOf(row.colors, row.id)) }} onClick={() => nav.push({ page: { kind: 'movies', id: row.id } })}>
      {movies.slice(0, 3).map((m, i) => (
        <img
          key={m.id}
          className="fan"
          src={m.p ?? m.b}
          alt=""
          loading="lazy"
          style={{ right: 10 + i * 26, rotate: `${(i - 1) * 8}deg`, zIndex: -1 - i }}
        />
      ))}
      <span className="shade" />
      <span className="text">
        <span style={{ fontSize: 22 }}>{row.emoji}</span>
        <span className="t">{row.title}</span>
      </span>
    </button>
  );
}
