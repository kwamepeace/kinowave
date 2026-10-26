import type { Catalog, Channel, Stream } from './types';

/** Published daily by .github/workflows/catalog.yml next to this app (…/kinowave/catalog.json). */
const REMOTE_CATALOG = 'https://kwamepeace.github.io/kinowave/catalog.json';
const SAME_SITE_CATALOG = '../catalog.json';

export interface LoadedCatalog {
  catalog: Catalog;
  /** Channels left out because every stream is plain http, which https pages can't load. */
  appOnly: number;
}

export async function loadCatalog(reload = false): Promise<LoadedCatalog> {
  const urls = import.meta.env.DEV ? [REMOTE_CATALOG] : [SAME_SITE_CATALOG, REMOTE_CATALOG];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: reload ? 'reload' : 'default' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const catalog = (await res.json()) as Catalog;
      if (!catalog.channels?.length) throw new Error('Empty catalog');
      return forThisPage(catalog);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/**
 * Browsers block http:// media on https:// pages and can't send custom Referer / User-Agent headers,
 * so drop http streams when served over https and try header-dependent streams last.
 */
function forThisPage(catalog: Catalog): LoadedCatalog {
  const secure = location.protocol === 'https:';
  const rank = (s: Stream) => (s.r || s.ua ? 1 : 0);
  let appOnly = 0;
  const channels: Channel[] = [];
  for (const ch of catalog.channels) {
    const streams = (secure ? ch.s.filter((s) => s.u.startsWith('https:')) : ch.s)
      .map((s, i) => ({ s, i }))
      .sort((a, b) => rank(a.s) - rank(b.s) || a.i - b.i)
      .map((x) => x.s);
    if (streams.length === 0) {
      appOnly++;
      continue;
    }
    channels.push({ ...ch, s: streams });
  }
  return { catalog: { ...catalog, channels }, appOnly };
}
