import { ArrowLeft, Play, Shuffle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../context';
import type { CatalogIndex } from '../data/catalogIndex';
import { prefs as prefsStore, progressFraction, useStore } from '../data/store';
import { categoryLabel, colorsOf, isUnreliable, seedColors, type Channel } from '../data/types';
import type { Page } from '../nav';
import { Chip, MoviePoster, PosterCard, Rail, useIncremental } from '../ui/components';

interface ListSpec {
  title: string;
  emoji: string;
  subtitle?: string;
  colors: [string, string];
  channels: Channel[];
}

function specFor(page: Page, index: CatalogIndex): ListSpec {
  switch (page.kind) {
    case 'collection': {
      const r = index.collectionById.get(page.id);
      return { title: r?.col.title ?? 'Collection', emoji: r?.col.emoji ?? '', subtitle: r?.col.subtitle, colors: colorsOf(r?.col.colors, page.id), channels: r?.channels ?? [] };
    }
    case 'country':
      return {
        title: index.countryName(page.id),
        emoji: index.countryFlag(page.id),
        subtitle: `Live channels from ${index.countryName(page.id)}`,
        colors: seedColors(page.id),
        channels: index.byCountry(page.id),
      };
    case 'language':
      return {
        title: index.languageName(page.id),
        emoji: '🗣️',
        subtitle: `Channels in ${index.languageName(page.id)}`,
        colors: seedColors(page.id),
        channels: index.byLanguage(page.id),
      };
    default:
      return { title: categoryLabel(page.id), emoji: '📺', colors: seedColors(page.id), channels: index.byCategory(page.id) };
  }
}

// color-mix keeps this working for both hex row colors and hsl() seed colors
const headStyle = (colors: [string, string]) => ({
  background: `linear-gradient(color-mix(in srgb, ${colors[0]} 85%, transparent), color-mix(in srgb, ${colors[1]} 35%, transparent), var(--ink))`,
});

/** Full grid for a collection, country, language or category, with category sub-filters. */
export function ChannelListPage({ page, onBack }: { page: Page; onBack: () => void }) {
  const { index, actions } = useApp();
  const { hideUnreliable } = useStore(prefsStore);
  const spec = useMemo(() => specFor(page, index), [page, index]);
  const all = useMemo(() => (hideUnreliable ? spec.channels.filter((c) => !isUnreliable(c)) : spec.channels), [spec, hideUnreliable]);
  const subFilters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of all) for (const g of c.g) counts.set(g, (counts.get(g) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1]).filter(([, n]) => n >= 3).slice(0, 12).map(([g]) => g);
  }, [all]);
  const [sub, setSub] = useState<string | null>(null);
  const filtered = useMemo(() => (sub ? all.filter((c) => c.g.includes(sub)) : all), [all, sub]);
  const [shown, sentinel] = useIncremental(filtered);

  return (
    <div className="screen">
      <header className="list-head" style={headStyle(spec.colors)}>
        <BackButton onBack={onBack} />
        {spec.emoji && <div className="emoji">{spec.emoji}</div>}
        <h1 className="display" style={spec.emoji ? undefined : { marginTop: 28 }}>
          {spec.title}
        </h1>
        {spec.subtitle && <p className="sub">{spec.subtitle}</p>}
        <div className="bar">
          <button className="btn white press" style={{ padding: '11px 18px' }} onClick={() => filtered[0] && actions.play(filtered[0], filtered)}>
            <Play size={20} fill="currentColor" /> Play
          </button>
          <button
            className="btn glass press"
            style={{ padding: '11px 18px' }}
            onClick={() => filtered.length && actions.play(filtered[Math.floor(Math.random() * filtered.length)], filtered)}
          >
            <Shuffle size={20} /> Surprise me
          </button>
          <span className="count">{filtered.length.toLocaleString()}</span>
        </div>
      </header>
      {subFilters.length > 1 && (
        <div style={{ marginBottom: 12 }}>
          <Rail tight>
            <Chip label="All" selected={sub === null} onClick={() => setSub(null)} />
            {subFilters.map((g) => (
              <Chip key={g} label={categoryLabel(g)} selected={sub === g} onClick={() => setSub(sub === g ? null : g)} />
            ))}
          </Rail>
        </div>
      )}
      <div className="grid">
        {shown.map((ch) => (
          <PosterCard key={ch.id} channel={ch} fluid flag={index.countryFlag(ch.c)} onOpen={() => actions.open(ch)} onPlay={() => actions.play(ch, filtered)} />
        ))}
      </div>
      {sentinel}
    </div>
  );
}

/** Full poster grid for one on-demand movie row. */
export function MovieGridPage({ rowId, onBack }: { rowId: string; onBack: () => void }) {
  const { index, actions } = useApp();
  const prefs = useStore(prefsStore);
  const r = index.movieRowById.get(rowId);
  if (!r) {
    return (
      <div className="screen">
        <header className="list-head">
          <BackButton onBack={onBack} />
          <h1 className="display" style={{ marginTop: 28 }}>
            Not available
          </h1>
        </header>
      </div>
    );
  }
  const colors = colorsOf(r.row.colors, r.row.id);
  return (
    <div className="screen">
      <header className="list-head" style={headStyle(colors)}>
        <BackButton onBack={onBack} />
        <div className="emoji">{r.row.emoji}</div>
        <h1 className="display">{r.row.title}</h1>
        <p className="sub">{r.movies.length} free movies · on demand</p>
        <div className="bar">
          <button className="btn white press" style={{ padding: '11px 18px' }} onClick={() => actions.playMovie(r.movies[Math.floor(Math.random() * r.movies.length)])}>
            <Shuffle size={20} /> Surprise me
          </button>
        </div>
      </header>
      <div className="grid">
        {r.movies.map((m) => (
          <MoviePoster key={m.id} movie={m} fluid progress={progressFraction(prefs, m.id)} onOpen={() => actions.openMovie(m)} onPlay={() => actions.playMovie(m)} />
        ))}
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button className="icon-btn press" style={{ background: 'rgb(0 0 0 / 0.2)' }} onClick={onBack} aria-label="Back">
      <ArrowLeft />
    </button>
  );
}

