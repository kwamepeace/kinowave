import { createContext, useContext } from 'react';
import type { CatalogIndex } from './data/catalogIndex';
import type { Channel, Movie } from './data/types';

export interface AppActions {
  /** Open the channel detail sheet */
  open: (ch: Channel) => void;
  /** Start playback, with the list the channel came from as the zapping queue */
  play: (ch: Channel, queue?: Channel[], stream?: number) => void;
  openMovie: (m: Movie) => void;
  playMovie: (m: Movie, fromStart?: boolean) => void;
  toast: (text: string) => void;
}

export interface AppContextValue {
  /** The catalog as the active profile sees it: kids-only content for Kids profiles */
  index: CatalogIndex;
  /** Channels hidden on the web because they only have http streams */
  appOnly: number;
  region: string;
  language: string;
  actions: AppActions;
  refresh: () => Promise<boolean>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const v = useContext(AppContext);
  if (!v) throw new Error('AppContext missing');
  return v;
}
