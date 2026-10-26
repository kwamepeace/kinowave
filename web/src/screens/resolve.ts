import type { CatalogIndex } from '../data/catalogIndex';
import { progressFraction, type Prefs } from '../data/store';
import { MOVIE_PREFIX, type Channel, type Movie } from '../data/types';

/** Something in "Continue watching" or My List: a live channel or a film. */
export type Watchable =
  | { kind: 'live'; key: string; channel: Channel }
  | { kind: 'film'; key: string; movie: Movie; progress?: number };

/** Turns My List / history keys back into channels and films ("m:" keys are films). */
export function resolveKeys(index: CatalogIndex, keys: string[], prefs: Prefs): Watchable[] {
  return keys.flatMap((key): Watchable[] => {
    if (key.startsWith(MOVIE_PREFIX)) {
      const m = index.movieById.get(key.slice(MOVIE_PREFIX.length));
      return m ? [{ kind: 'film', key, movie: m, progress: progressFraction(prefs, m.id) }] : [];
    }
    const ch = index.byId.get(key);
    return ch ? [{ kind: 'live', key, channel: ch }] : [];
  });
}
