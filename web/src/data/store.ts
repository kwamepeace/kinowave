import { useSyncExternalStore } from 'react';

// Profiles, per-profile lists and device settings, persisted in localStorage.
// Mirrors ProfileStore / UserPrefs / AppSettings from the Android app.

export interface Profile {
  id: string;
  name: string;
  avatar: string;
  /** Index into PROFILE_COLORS */
  color: number;
  kids?: boolean;
  /** Optional 4-digit lock */
  pin?: string;
}

export interface WatchStat {
  seconds: number;
  last: number;
  plays: number;
}

export interface Prefs {
  myList: string[];
  recents: string[];
  /** Hide channels whose every stream is geo-blocked or part-time */
  hideUnreliable: boolean;
  /** Per item: how long, how often and how recently it was watched. Feeds For You. */
  stats: Record<string, WatchStat>;
  /** Movie id → [position ms, duration ms], for "Continue watching" progress bars */
  progress: Record<string, [number, number]>;
}

export interface Settings {
  /** Cap video around 480p and use lighter movie files */
  dataSaver: boolean;
  /** Only apply data saver on mobile data */
  saverOnMobileOnly: boolean;
  /** Jump to the next channel when every source of the current one fails */
  autoplayNext: boolean;
}

export const PROFILE_COLORS: [string, string][] = [
  ['#FF2D6F', '#8B5CF6'],
  ['#00C9FF', '#7F00FF'],
  ['#F7971E', '#E52E71'],
  ['#11998E', '#C8FF2E'],
  ['#FDC830', '#F37335'],
  ['#614385', '#516395'],
];

export const PROFILE_AVATARS = ['😎', '🦊', '🐼', '👾', '🦄', '🐸', '🤖', '🐯', '🍕', '🌸', '🎧', '🧸', '🚀', '⚽', '🎮', '💜'];

const MAX_STATS = 200;
const MAX_RECENTS = 30;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function readArray<T>(key: string): T[] | null {
  try {
    const raw = localStorage.getItem(key);
    const v = raw ? JSON.parse(raw) : null;
    return Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

/** A tiny observable value, readable from React with useStore(). */
class Store<T> {
  private listeners = new Set<() => void>();
  constructor(private value: T, private persist?: (v: T) => void) {}
  get = () => this.value;
  set = (next: T) => {
    this.value = next;
    this.persist?.(next);
    this.listeners.forEach((l) => l());
  };
  update = (fn: (v: T) => T) => this.set(fn(this.value));
  subscribe = (l: () => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

export function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(store.subscribe, store.get);
}

// ---------------------------------------------------------------- settings

export const settings = new Store<Settings>(
  read('kw.settings', { dataSaver: false, saverOnMobileOnly: true, autoplayNext: true }),
  (v) => write('kw.settings', v),
);

type NetworkInfo = { type?: string; saveData?: boolean };

/** Whether data saver applies right now, given the current connection. */
export function savingData(): boolean {
  const s = settings.get();
  if (!s.dataSaver) return false;
  if (!s.saverOnMobileOnly) return true;
  const conn = (navigator as Navigator & { connection?: NetworkInfo }).connection;
  // Without the Network Information API (Safari, Firefox) we can't tell, so save data
  if (!conn || conn.type === undefined) return true;
  return conn.type === 'cellular' || !!conn.saveData;
}

// ---------------------------------------------------------------- profiles

const DEFAULT_PROFILES: Profile[] = [
  { id: 'main', name: 'You', avatar: '😎', color: 0 },
  { id: 'kids', name: 'Kids', avatar: '🧸', color: 4, kids: true },
];

export const profiles = new Store<Profile[]>(readArray<Profile>('kw.profiles') ?? DEFAULT_PROFILES, (v) => write('kw.profiles', v));

function readActive(): Profile | null {
  try {
    const id = sessionStorage.getItem('kw.active');
    return profiles.get().find((p) => p.id === id) ?? null;
  } catch {
    return null;
  }
}

/** Null until someone picks a profile on "Who's watching?". Remembered for this tab only. */
export const activeProfile = new Store<Profile | null>(readActive(), (p) => {
  try {
    if (p) sessionStorage.setItem('kw.active', p.id);
    else sessionStorage.removeItem('kw.active');
  } catch {
    /* ignore */
  }
});

export function selectProfile(p: Profile | null) {
  if (p) switchPrefs(p.id);
  activeProfile.set(p);
}

export function saveProfile(p: Profile) {
  profiles.update((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [...list, p]));
  if (activeProfile.get()?.id === p.id) activeProfile.set(p);
}

export function deleteProfile(p: Profile) {
  if (profiles.get().length <= 1) return;
  profiles.update((list) => list.filter((x) => x.id !== p.id));
  try {
    localStorage.removeItem(`kw.prefs.${p.id}`);
  } catch {
    /* ignore */
  }
  if (activeProfile.get()?.id === p.id) activeProfile.set(null);
}

export function newProfile(kids = false): Profile {
  return {
    id: Math.random().toString(36).slice(2, 10),
    name: kids ? 'Kids' : '',
    avatar: kids ? '🧸' : PROFILE_AVATARS[Math.floor(Math.random() * PROFILE_AVATARS.length)],
    color: Math.floor(Math.random() * PROFILE_COLORS.length),
    kids,
  };
}

// ---------------------------------------------------------------- per-profile prefs

const EMPTY_PREFS: Prefs = { myList: [], recents: [], hideUnreliable: false, stats: {}, progress: {} };

let prefsId = activeProfile.get()?.id ?? 'main';
export const prefs = new Store<Prefs>(read(`kw.prefs.${prefsId}`, EMPTY_PREFS), (v) => write(`kw.prefs.${prefsId}`, v));

function switchPrefs(profileId: string) {
  if (profileId === prefsId) return;
  prefsId = profileId;
  prefs.set(read(`kw.prefs.${profileId}`, EMPTY_PREFS));
}

export function toggleMyList(key: string) {
  prefs.update((p) => ({ ...p, myList: p.myList.includes(key) ? p.myList.filter((k) => k !== key) : [key, ...p.myList] }));
}

export function markWatched(key: string) {
  prefs.update((p) => {
    const old = p.stats[key];
    return {
      ...p,
      recents: [key, ...p.recents.filter((k) => k !== key)].slice(0, MAX_RECENTS),
      stats: withStat(p.stats, key, { seconds: old?.seconds ?? 0, last: Date.now(), plays: (old?.plays ?? 0) + 1 }),
    };
  });
}

/** Called by the player while something is actually playing. */
export function addWatchTime(key: string, seconds: number) {
  prefs.update((p) => {
    const old = p.stats[key];
    return { ...p, stats: withStat(p.stats, key, { seconds: (old?.seconds ?? 0) + seconds, last: Date.now(), plays: old?.plays ?? 1 }) };
  });
}

function withStat(stats: Record<string, WatchStat>, key: string, stat: WatchStat): Record<string, WatchStat> {
  // Keep the most recent items so storage stays small
  const entries = Object.entries({ ...stats, [key]: stat }).sort((a, b) => b[1].last - a[1].last).slice(0, MAX_STATS);
  return Object.fromEntries(entries);
}

export const clearRecents = () => prefs.update((p) => ({ ...p, recents: [] }));
export const setHideUnreliable = (v: boolean) => prefs.update((p) => ({ ...p, hideUnreliable: v }));

export function savePosition(movieId: string, positionMs: number, durationMs: number) {
  // Treat the last couple of minutes as "finished"
  const finished = durationMs > 0 && positionMs > durationMs - 120_000;
  prefs.update((p) => {
    const progress = { ...p.progress };
    if (finished || positionMs < 15_000) delete progress[movieId];
    else progress[movieId] = [Math.round(positionMs), Math.round(durationMs)];
    return { ...p, progress };
  });
}

export const positionOf = (movieId: string) => prefs.get().progress[movieId]?.[0] ?? 0;

export function progressFraction(p: Prefs, movieId: string): number | undefined {
  const entry = p.progress[movieId];
  return entry && entry[1] > 0 ? entry[0] / entry[1] : undefined;
}
