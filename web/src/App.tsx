import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppContext, type AppActions, type AppContextValue } from './context';
import { loadCatalog, type LoadedCatalog } from './data/catalog';
import { CatalogIndex } from './data/catalogIndex';
import { browserLanguage, browserRegion } from './data/recommender';
import { activeProfile, profiles, useStore } from './data/store';
import { nav, playbackRef, useNav, type Playback, type Tab } from './nav';
import { Player } from './player/Player';
import { ChannelSheet, MovieSheet } from './screens/DetailSheets';
import { DiscoverScreen } from './screens/Discover';
import { HomeScreen } from './screens/Home';
import { ChannelListPage, MovieGridPage } from './screens/ListPage';
import { LiveScreen } from './screens/Live';
import { MySpaceScreen } from './screens/MySpace';
import { ProfileEditor, ProfilePicker } from './screens/Profiles';
import { TabBar } from './ui/TabBar';

type CatalogState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; index: CatalogIndex; appOnly: number };

const region = browserRegion();
const language = browserLanguage();

export function App() {
  const [state, setState] = useState<CatalogState>({ kind: 'loading' });
  const profile = useStore(activeProfile);
  const allProfiles = useStore(profiles);
  const route = useNav();
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const apply = (loaded: LoadedCatalog) => setState({ kind: 'ready', index: new CatalogIndex(loaded.catalog), appOnly: loaded.appOnly });

  const load = useCallback(() => {
    setState({ kind: 'loading' });
    loadCatalog()
      .then(apply)
      .catch(() => setState({ kind: 'error' }));
  }, []);
  useEffect(load, [load]);

  // A profile can be deleted or edited elsewhere (another tab); keep the active one in sync
  useEffect(() => {
    if (profile && !allProfiles.some((p) => p.id === profile.id)) activeProfile.set(null);
  }, [allProfiles, profile]);

  const full = state.kind === 'ready' ? state.index : null;
  // The catalog as the active profile sees it: kids-only content for Kids profiles
  const index = useMemo(() => (full && profile?.kids ? full.forKids() : full), [full, profile?.kids]);

  const showToast = useCallback((text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2600);
  }, []);

  const startPlayback = useCallback((pb: Playback) => {
    playbackRef.current = pb;
    setPlayback(pb);
    if (nav.get().player) nav.replace({ player: true });
    else nav.push({ player: true });
  }, []);

  const actions: AppActions = useMemo(
    () => ({
      open: (ch) => nav.push({ sheet: { kind: 'channel', id: ch.id } }),
      openMovie: (m) => nav.push({ sheet: { kind: 'movie', id: m.id } }),
      play: (ch, queue, stream = 0) => {
        let q = queue?.length ? queue : [ch];
        let i = q.findIndex((c) => c.id === ch.id);
        if (i < 0) (q = [ch, ...q]), (i = 0);
        startPlayback({ kind: 'live', queue: q, index: i, stream });
      },
      playMovie: (m, fromStart = false) => startPlayback({ kind: 'movie', movie: m, fromStart }),
      toast: showToast,
    }),
    [startPlayback, showToast],
  );

  const closePlayer = useCallback(() => nav.back({ player: false }), []);
  const closeSheet = useCallback(() => nav.back({ sheet: null }), []);

  // Drop the playback request once its history entry is gone (Back, or a closed player)
  useEffect(() => {
    if (!route.player && playback) {
      playbackRef.current = null;
      setPlayback(null);
    }
  }, [route.player, playback]);

  const playerOpen = route.player && playback !== null;
  const sheetChannel = route.sheet?.kind === 'channel' ? index?.byId.get(route.sheet.id) : undefined;
  const sheetMovie = route.sheet?.kind === 'movie' ? index?.movieById.get(route.sheet.id) : undefined;

  useEffect(() => {
    document.body.classList.toggle('locked', playerOpen || !!sheetChannel || !!sheetMovie);
  }, [playerOpen, sheetChannel, sheetMovie]);

  const contextValue: AppContextValue | null = useMemo(
    () =>
      index && state.kind === 'ready'
        ? {
            index,
            appOnly: state.appOnly,
            region,
            language,
            actions,
            refresh: async () => {
              const fresh = await loadCatalog(true);
              const changed = fresh.catalog.updated !== state.index.catalog.updated;
              if (changed) apply(fresh);
              return changed;
            },
          }
        : null,
    [index, state, actions],
  );

  if (state.kind === 'loading') {
    return (
      <div className="loading">
        <div>
          <div className="brand-text">KinoWave</div>
          <div className="spinner" />
        </div>
      </div>
    );
  }
  if (state.kind === 'error' || !contextValue) {
    return (
      <div className="loading">
        <div>
          <div className="brand-text">KinoWave</div>
          <p className="muted" style={{ margin: '12px 0 20px' }}>
            Couldn&apos;t load the channel list. Check your connection.
          </p>
          <button className="btn brand press" onClick={load}>
            Try again
          </button>
        </div>
      </div>
    );
  }
  if (!profile) return <ProfilePicker />;

  const selectTab = (tab: Tab) => {
    if (tab === route.tab && !route.page) window.scrollTo({ top: 0, behavior: 'smooth' });
    else nav.push({ tab, page: null, sheet: null });
  };
  const back = () => nav.back({ page: null });

  let screen;
  if (route.page?.kind === 'movies') screen = <MovieGridPage key={route.page.id} rowId={route.page.id} onBack={back} />;
  else if (route.page) screen = <ChannelListPage key={`${route.page.kind}/${route.page.id}`} page={route.page} onBack={back} />;
  else if (route.tab === 'discover') screen = <DiscoverScreen />;
  else if (route.tab === 'live') screen = <LiveScreen />;
  else if (route.tab === 'me') screen = <MySpaceScreen onEditProfile={() => setEditingProfile(true)} />;
  else screen = <HomeScreen />;

  return (
    <AppContext.Provider value={contextValue}>
      <div key={profile.id} inert={playerOpen || undefined}>
        {screen}
        <TabBar selected={route.tab} onSelect={selectTab} />
      </div>
      {sheetChannel && <ChannelSheet key={`sheet-${sheetChannel.id}`} channel={sheetChannel} onClose={closeSheet} />}
      {sheetMovie && <MovieSheet key={`sheet-m-${sheetMovie.id}`} movie={sheetMovie} onClose={closeSheet} />}
      {playerOpen && <Player key={`player-${playback.kind === 'movie' ? playback.movie.id : playback.queue[playback.index].id}`} playback={playback} onClose={closePlayer} />}
      {editingProfile && <ProfileEditor profile={profile} isNew={false} canDelete={allProfiles.length > 1} onClose={() => setEditingProfile(false)} />}
      {toast && <div className="toast">{toast}</div>}
    </AppContext.Provider>
  );
}
