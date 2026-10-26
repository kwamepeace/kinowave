import { ChevronDown, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import { buildHome, HOME_FILTERS, type HomeFilter, type HomeRow } from '../data/home';
import { activeProfile, prefs as prefsStore, progressFraction, settings, toggleMyList, useStore } from '../data/store';
import { movieKey, type Channel, type Movie } from '../data/types';
import { nav } from '../nav';
import { Chip, MoviePoster, MovieWideCard, PosterCard, ProfileAvatar, Rail, SectionHeader, Top10Card, WideCard } from '../ui/components';
import { HeroCarousel } from '../ui/Hero';
import { resolveKeys, type Watchable } from './resolve';

/** Kept across tab switches, like the view model's homeFilter on Android. */
let lastFilter: HomeFilter = 'all';

export function HomeScreen() {
  const { index, region, language, actions } = useApp();
  const profile = useStore(activeProfile);
  const prefs = useStore(prefsStore);
  const { dataSaver } = useStore(settings);
  const [filter, setFilter] = useState<HomeFilter>(lastFilter);
  const [barAlpha, setBarAlpha] = useState(0);
  lastFilter = filter;

  // The recommender only needs to rerun when taste inputs change, not on every watch-time tick
  const tasteKey = JSON.stringify([prefs.myList, prefs.hideUnreliable, Object.keys(prefs.stats).length, prefs.recents[0]]);
  const home = useMemo(
    () => buildHome(index, filter, prefsStore.get(), region, language, profile?.name),
    [index, filter, tasteKey, region, language, profile?.name],
  );

  useEffect(() => {
    const onScroll = () => setBarAlpha(Math.min(1, window.scrollY / 300));
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const flagOf = (ch: Channel) => index.countryFlag(ch.c);
  const progressOf = (m: Movie) => progressFraction(prefs, m.id);
  const continueItems = resolveKeys(index, prefs.recents, prefs);
  const saved = resolveKeys(index, prefs.myList, prefs);

  const pickFilter = (f: HomeFilter) => {
    setFilter(f);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="screen">
      <header className="topbar" style={{ ['--bar' as string]: barAlpha }}>
        <div className="row">
          <span className="brand-text">KinoWave</span>
          <button className="icon-btn press" aria-label="Search" onClick={() => nav.push({ tab: 'discover', page: null, sheet: null, focusSearch: true })}>
            <Search />
          </button>
          {profile && <ProfileAvatar profile={profile} size={44} onClick={() => activeProfile.set(null)} />}
        </div>
        <Rail tight className="chips">
          {HOME_FILTERS.map(([f, label]) => (
            <Chip key={f} label={label} selected={f === filter} onClick={() => pickFilter(f)} />
          ))}
          <button className="chip press" onClick={() => nav.push({ tab: 'discover', page: null, sheet: null })}>
            Categories <ChevronDown size={18} />
          </button>
        </Rail>
      </header>

      <div className="stack" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 124px)' }}>
        <HeroCarousel
          items={home.hero}
          saved={(it) => prefs.myList.includes(it.movie ? movieKey(it.movie) : it.channel?.id ?? '')}
          flagOf={index.countryFlag}
          lightweight={dataSaver}
          onPlay={(it) =>
            it.movie ? actions.playMovie(it.movie) : it.channel && actions.play(it.channel, home.hero.flatMap((h) => (h.channel ? [h.channel] : [])))
          }
          onOpen={(it) => (it.movie ? actions.openMovie(it.movie) : it.channel && actions.open(it.channel))}
          onToggleList={(it) => toggleMyList(it.movie ? movieKey(it.movie) : it.channel!.id)}
        />

        {continueItems.length > 0 && filter !== 'tv' && (
          <section className="section">
            <SectionHeader title="Continue watching" emoji="⏯️" />
            <Rail>
              {continueItems.map((it) => (
                <WatchableWide key={it.key} item={it} queue={continueItems} />
              ))}
            </Rail>
          </section>
        )}

        {home.top10.length >= 5 && (
          <section className="section">
            <SectionHeader
              title={home.regionCode ? `Top 10 in ${index.countryName(home.regionCode)} ${index.countryFlag(home.regionCode)}` : 'Top 10 Today'}
              emoji="🔥"
            />
            <Rail tight>
              {home.top10.map((ch, i) => (
                <Top10Card key={ch.id} rank={i + 1} channel={ch} onOpen={() => actions.open(ch)} onPlay={() => actions.play(ch, home.top10)} />
              ))}
            </Rail>
          </section>
        )}

        {saved.length > 0 && filter === 'all' && (
          <section className="section">
            <SectionHeader title="My List" emoji="💜" />
            <Rail>
              {saved.map((it) =>
                it.kind === 'live' ? (
                  <PosterCard
                    key={it.key}
                    channel={it.channel}
                    flag={flagOf(it.channel)}
                    onOpen={() => actions.open(it.channel)}
                    onPlay={() => actions.play(it.channel, liveQueue(saved))}
                  />
                ) : (
                  <MoviePoster
                    key={it.key}
                    movie={it.movie}
                    progress={it.progress}
                    onOpen={() => actions.openMovie(it.movie)}
                    onPlay={() => actions.playMovie(it.movie)}
                  />
                ),
              )}
            </Rail>
          </section>
        )}

        {home.rows.map((row) => (
          <HomeRowView key={row.key} row={row} flagOf={flagOf} progressOf={progressOf} />
        ))}

        <p className="footer-note">
          Live channels from the open-source iptv-org project. Movies from the Internet Archive&apos;s public-domain collection.
          <br />
          KinoWave doesn&apos;t host any video.
        </p>
      </div>
    </div>
  );
}

function HomeRowView({ row, flagOf, progressOf }: { row: HomeRow; flagOf: (c: Channel) => string; progressOf: (m: Movie) => number | undefined }) {
  const { actions } = useApp();
  // Personal "fy-" rows are computed on the fly and have no full page
  if (row.kind === 'channels') {
    return (
      <section className="section">
        <SectionHeader
          title={row.col.title}
          emoji={row.col.emoji}
          subtitle={row.col.subtitle}
          onSeeAll={row.col.id.startsWith('fy-') ? undefined : () => nav.push({ page: { kind: 'collection', id: row.col.id }, sheet: null })}
        />
        <Rail>
          {row.channels.map((ch) => (
            <PosterCard key={ch.id} channel={ch} flag={flagOf(ch)} onOpen={() => actions.open(ch)} onPlay={() => actions.play(ch, row.channels)} />
          ))}
        </Rail>
      </section>
    );
  }
  const subtitle = row.row.id.startsWith('yt-') ? 'New releases · free from the official studio' : row.row.id.startsWith('fy-') ? null : 'Free classic movies · on demand';
  return (
    <section className="section">
      <SectionHeader
        title={row.row.title}
        emoji={row.row.emoji}
        subtitle={subtitle}
        onSeeAll={row.row.id.startsWith('fy-') ? undefined : () => nav.push({ page: { kind: 'movies', id: row.row.id }, sheet: null })}
      />
      <Rail>
        {row.movies.map((m) => (
          <MoviePoster key={m.id} movie={m} progress={progressOf(m)} onOpen={() => actions.openMovie(m)} onPlay={() => actions.playMovie(m)} />
        ))}
      </Rail>
    </section>
  );
}

export const liveQueue = (items: Watchable[]) => items.flatMap((it) => (it.kind === 'live' ? [it.channel] : []));

export function WatchableWide({ item, queue }: { item: Watchable; queue: Watchable[] }) {
  const { actions } = useApp();
  return item.kind === 'live' ? (
    <WideCard channel={item.channel} onPlay={() => actions.play(item.channel, liveQueue(queue))} />
  ) : (
    <MovieWideCard movie={item.movie} progress={item.progress} onPlay={() => actions.playMovie(item.movie)} />
  );
}
