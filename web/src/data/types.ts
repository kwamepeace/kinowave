// Compact catalog produced by scripts/build-catalog.mjs from the iptv-org API.
// Short keys match the JSON; see app/src/main/java/.../data/Models.kt for the Android twin.

export interface Catalog {
  updated: string;
  countries: Record<string, { n: string; f?: string }>;
  languages: Record<string, string>;
  collections: Collection[];
  channels: Channel[];
  movies: Movie[];
  movieRows: MovieRow[];
}

export interface Stream {
  u: string;
  q?: string;
  ua?: string;
  r?: string;
  /** Geo-blocked */
  gb?: boolean;
  /** Not on air 24/7 */
  p?: boolean;
}

export interface Channel {
  id: string;
  n: string;
  l?: string;
  c: string;
  g: string[];
  la?: string[];
  nw?: string;
  s: Stream[];
  score: number;
}

export interface Collection {
  id: string;
  title: string;
  emoji?: string;
  subtitle?: string;
  /** "movies", "tv" or "all": which home filter shows this row */
  tab?: string;
  colors?: string[];
  ids: string[];
}

/** An on-demand film: public domain from the Internet Archive, or a studio's free upload on YouTube. */
export interface Movie {
  id: string;
  t: string;
  /** Direct MP4 (Internet Archive films). Empty for YouTube films. */
  u?: string;
  /** ~240p copy used by data saver */
  lu?: string;
  p?: string;
  /** A frame from the film, used as a backdrop */
  b?: string;
  y?: number;
  len?: number;
  d?: string;
  g?: string[];
  /** YouTube video id for films a studio publishes on its official channel */
  yt?: string;
}

export interface MovieRow {
  id: string;
  title: string;
  emoji?: string;
  colors?: string[];
  ids: string[];
  /** Suitable for Kids profiles */
  kids?: boolean;
}

/** Key used in My List / history so movies and channels can share one list. */
export const MOVIE_PREFIX = 'm:';
export const movieKey = (m: Movie) => MOVIE_PREFIX + m.id;

export const isGeoBlocked = (ch: Channel) => ch.s.every((s) => s.gb);
export const isPartTime = (ch: Channel) => ch.s.every((s) => s.p);
export const isUnreliable = (ch: Channel) => isGeoBlocked(ch) || isPartTime(ch);
export const bestQuality = (ch: Channel) => ch.s[0]?.q;

/** Human label for a stream quality like "1080p" → "FHD". */
export function qualityBadge(quality?: string): string | null {
  const n = parseInt(quality ?? '', 10);
  if (!n) return null;
  if (n >= 2160) return '4K';
  if (n >= 1080) return 'FHD';
  if (n >= 720) return 'HD';
  return 'SD';
}

const CATEGORY_LABELS: Record<string, string> = {
  auto: 'Auto', animation: 'Animation', business: 'Business', classic: 'Classic', comedy: 'Comedy',
  cooking: 'Cooking', culture: 'Culture', documentary: 'Documentary', education: 'Education',
  entertainment: 'Entertainment', family: 'Family', general: 'General', kids: 'Kids', legislative: 'Legislative',
  lifestyle: 'Lifestyle', movies: 'Movies', music: 'Music', news: 'News', outdoor: 'Outdoor', relax: 'Relax',
  religious: 'Faith', science: 'Science', series: 'Series', shop: 'Shopping', sports: 'Sports', travel: 'Travel',
  weather: 'Weather', interactive: 'Interactive', public: 'Public',
};

export const categoryLabel = (id: string) => CATEGORY_LABELS[id] ?? id.charAt(0).toUpperCase() + id.slice(1);
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function runtimeLabel(m: Movie): string | null {
  const s = m.len ?? 0;
  if (s <= 0) return null;
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${min}m` : `${min}m`;
}

export const sourceLabel = (m: Movie) => (m.yt ? `Free on ${m.g?.[0] ?? 'YouTube'}` : 'Public domain');
export const shareUrlOf = (m: Movie) => (m.yt ? `https://youtu.be/${m.yt}` : `https://archive.org/details/${m.id}`);

/** Two vivid colors derived from a string, so every channel gets its own stable poster gradient. */
export function seedColors(seed: string): [string, string] {
  // Same 31-based hash as Kotlin's String.hashCode, so web and Android posters match
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  return [`hsl(${hue} 78% 52%)`, `hsl(${(hue + 48) % 360} 72% 26%)`];
}

export const colorsOf = (hex: string[] | undefined, seed: string): [string, string] =>
  hex && hex.length >= 2 ? [hex[0], hex[1]] : seedColors(seed);

export const gradient = (c: [string, string] | string[], angle = 135) => `linear-gradient(${angle}deg, ${c[0]}, ${c[1]})`;

export function monogram(name: string): string {
  const parts = name.split(/[ \-.]/).filter((p) => p && /[\p{L}\p{N}]/u.test(p[0]));
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('') || 'TV';
}
