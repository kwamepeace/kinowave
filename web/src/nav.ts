import { useSyncExternalStore } from 'react';
import type { Channel, Movie } from './data/types';

// Navigation lives in the URL hash so the browser Back button and shared links work:
//   #/home  #/discover  #/live  #/me
//   #/home/collection/bollywood   (a pushed page: collection | country | language | category | movies)
//   #/live?ch=CNN.us  #/home?movie=nosferatu   (a detail sheet)
// The player isn't in the URL (its queue isn't shareable) but gets its own history entry,
// so Back closes it like the Android back gesture.

export type Tab = 'home' | 'discover' | 'live' | 'me';
export type PageKind = 'collection' | 'country' | 'language' | 'category' | 'movies';
export interface Page {
  kind: PageKind;
  id: string;
}
export interface Sheet {
  kind: 'channel' | 'movie';
  id: string;
}

export interface NavState {
  tab: Tab;
  page: Page | null;
  sheet: Sheet | null;
  player: boolean;
  /** Focus the Discover search box when arriving there */
  focusSearch?: boolean;
  /** How many entries this tab's history has above the page it landed on */
  depth?: number;
}

export type Playback =
  | { kind: 'live'; queue: Channel[]; index: number; stream: number }
  | { kind: 'movie'; movie: Movie; fromStart: boolean };

const TABS: Tab[] = ['home', 'discover', 'live', 'me'];
const PAGES: PageKind[] = ['collection', 'country', 'language', 'category', 'movies'];

export function parseHash(hash: string): NavState {
  const [path, query = ''] = hash.replace(/^#\/?/, '').split('?');
  const [tab, kind, ...rest] = path.split('/').map(decodeURIComponent);
  const params = new URLSearchParams(query);
  const ch = params.get('ch');
  const movie = params.get('movie');
  return {
    tab: TABS.includes(tab as Tab) ? (tab as Tab) : 'home',
    page: PAGES.includes(kind as PageKind) && rest.length ? { kind: kind as PageKind, id: rest.join('/') } : null,
    sheet: ch ? { kind: 'channel', id: ch } : movie ? { kind: 'movie', id: movie } : null,
    player: false,
  };
}

export function toHash(s: NavState): string {
  let h = `#/${s.tab}`;
  if (s.page) h += `/${s.page.kind}/${encodeURIComponent(s.page.id)}`;
  if (s.sheet) h += `?${s.sheet.kind === 'channel' ? 'ch' : 'movie'}=${encodeURIComponent(s.sheet.id)}`;
  return h;
}

// After a reload the history entry still knows its depth; a fresh visit starts from the hash
const saved = history.state as NavState | null;
let state: NavState = { ...(saved?.tab && toHash(saved) === location.hash ? saved : parseHash(location.hash)), player: false };
history.replaceState(state, '', toHash(state));
const listeners = new Set<() => void>();
const scrollMemory = new Map<string, number>();
const scrollKey = (s: NavState) => `${s.tab}/${s.page?.kind ?? ''}/${s.page?.id ?? ''}`;

function emit(next: NavState) {
  const prevKey = scrollKey(state);
  const nextKey = scrollKey(next);
  if (prevKey !== nextKey) scrollMemory.set(prevKey, window.scrollY);
  state = next;
  listeners.forEach((l) => l());
  if (prevKey !== nextKey) {
    const y = scrollMemory.get(nextKey) ?? 0;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
}

window.addEventListener('popstate', (e) => {
  const next = (e.state as NavState | null) ?? parseHash(location.hash);
  // A reload can't restore the player's queue, so a stale player entry just closes
  emit({ ...next, player: next.player && playbackRef.current !== null });
});

export const nav = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  push(patch: Partial<NavState>) {
    const next = { ...state, focusSearch: false, ...patch, depth: (state.depth ?? 0) + 1 };
    history.pushState(next, '', toHash(next));
    emit(next);
  },
  replace(patch: Partial<NavState>) {
    const next = { ...state, ...patch };
    history.replaceState(next, '', toHash(next));
    emit(next);
  },
  /** Go back when this entry was pushed inside the app; on a landing entry (a shared link) apply the fallback. */
  back(fallback: Partial<NavState>) {
    if ((state.depth ?? 0) > 0) history.back();
    else nav.replace(fallback);
  },
};

export function useNav(): NavState {
  return useSyncExternalStore(nav.subscribe, nav.get);
}

/** The current playback request; owned by App, read by the popstate handler. */
export const playbackRef: { current: Playback | null } = { current: null };

export const shareLink = (sheet: Sheet) => `${location.origin}${location.pathname}${toHash({ tab: 'home', page: null, sheet, player: false })}`;
