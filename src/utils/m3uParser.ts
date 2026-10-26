export interface IptvChannel {
  id: string;
  name: string;
  category: 'Movies' | 'News' | 'Sports' | 'Documentary' | 'Sci-Fi & Tech' | 'Music' | 'Animation' | 'Lifestyle';
  country: string;
  countryCode: string;
  language: string;
  resolution: '4K UHD' | '1080p' | '720p';
  streamUrl: string;
  fallbackStreamUrl?: string;
  tvgId?: string;
  currentProgram: string;
  nextProgram: string;
  programProgress: number; // 0 to 100
  synopsis: string;
  bitrateKbps: number;
  isCustom?: boolean;
}

export interface ParsedM3UResult {
  channels: IptvChannel[];
  errors: string[];
  totalParsed: number;
}

const VALID_CATEGORIES: IptvChannel['category'][] = [
  'Movies',
  'News',
  'Sports',
  'Documentary',
  'Sci-Fi & Tech',
  'Music',
  'Animation',
  'Lifestyle',
];

export function normalizeCategory(rawGroup?: string): IptvChannel['category'] {
  if (!rawGroup) return 'Movies';
  const lower = rawGroup.toLowerCase();
  if (lower.includes('movie') || lower.includes('cinema') || lower.includes('film') || lower.includes('classic')) {
    return 'Movies';
  }
  if (lower.includes('news') || lower.includes('business') || lower.includes('weather')) {
    return 'News';
  }
  if (lower.includes('sport') || lower.includes('motor') || lower.includes('fight') || lower.includes('outdoor')) {
    return 'Sports';
  }
  if (lower.includes('doc') || lower.includes('nature') || lower.includes('history') || lower.includes('travel')) {
    return 'Documentary';
  }
  if (lower.includes('sci') || lower.includes('tech') || lower.includes('space') || lower.includes('education')) {
    return 'Sci-Fi & Tech';
  }
  if (lower.includes('music') || lower.includes('concert') || lower.includes('pop') || lower.includes('jazz')) {
    return 'Music';
  }
  if (lower.includes('anim') || lower.includes('kids') || lower.includes('family')) {
    return 'Animation';
  }
  if (lower.includes('life') || lower.includes('food') || lower.includes('cooking') || lower.includes('entertainment')) {
    return 'Lifestyle';
  }
  const matched = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return matched || 'Movies';
}

export function extractAttribute(extinfLine: string, attrName: string): string {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = extinfLine.match(regex);
  return match ? match[1].trim() : '';
}

export function extractChannelTitle(extinfLine: string): string {
  // Remove attributes in quotes first so commas inside quotes don't break splitting
  const withoutQuotes = extinfLine.replace(/[a-zA-Z0-9_-]+="[^"]*"/g, '');
  const commaIdx = withoutQuotes.indexOf(',');
  if (commaIdx === -1) return 'Untitled Stream';
  const rawTitle = withoutQuotes.slice(commaIdx + 1).trim();
  return rawTitle || 'Untitled Stream';
}

export function detectResolutionFromTitle(title: string): '4K UHD' | '1080p' | '720p' {
  if (/2160p|4k|uhd/i.test(title)) return '4K UHD';
  if (/720p|576p|480p/i.test(title)) return '720p';
  return '1080p';
}

export function cleanChannelDisplayName(title: string): string {
  return title
    .replace(/\s*\((1080p|720p|480p|576p|2160p|4K)\)/gi, '')
    .replace(/\s*\[(Geo-blocked|Not 24\/7|720p|1080p)\]/gi, '')
    .trim();
}

/**
 * Pure parser for iptv-org/iptv M3U and M3U8 playlists.
 * Supports standard #EXTM3U headers, #EXTINF metadata tags, #EXTVLCOPT options, and HTTP/HTTPS stream URLs.
 */
export function parseM3UPlaylist(
  m3uContent: string,
  defaultCategory: IptvChannel['category'] = 'Movies',
  maxLimit = 120
): ParsedM3UResult {
  const trimmed = m3uContent.trim();
  if (!trimmed) {
    return {
      channels: [],
      errors: ['Playlist content cannot be empty. Provide valid #EXTM3U content or stream entries.'],
      totalParsed: 0,
    };
  }

  const lines = trimmed.split(/\r?\n/);
  const channels: IptvChannel[] = [];
  const errors: string[] = [];

  let pendingExtinf: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTINF:')) {
      pendingExtinf = line;
      continue;
    }

    if (line.startsWith('#')) {
      // Other directives like #EXTM3U or #EXTVLCOPT
      continue;
    }

    if (/^https?:\/\/\S+/i.test(line)) {
      const extinf = pendingExtinf || `#EXTINF:-1 group-title="${defaultCategory}",Live Stream ${channels.length + 1}`;
      const rawTitle = extractChannelTitle(extinf);
      const cleanName = cleanChannelDisplayName(rawTitle);
      const groupTitle = extractAttribute(extinf, 'group-title');
      const tvgId = extractAttribute(extinf, 'tvg-id');
      const tvgCountry = extractAttribute(extinf, 'tvg-country') || detectCountryFromTvgId(tvgId);
      const resolution = detectResolutionFromTitle(rawTitle);
      const category = groupTitle ? normalizeCategory(groupTitle) : defaultCategory;

      const idSlug = (tvgId || cleanName)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

      channels.push({
        id: `m3u-${idSlug}-${channels.length + 1}`,
        name: cleanName || `Channel ${channels.length + 1}`,
        category,
        country: formatCountryName(tvgCountry),
        countryCode: (tvgCountry || 'INT').toUpperCase().slice(0, 3),
        language: 'English',
        resolution,
        streamUrl: line,
        tvgId: tvgId || undefined,
        currentProgram: `Live Broadcast: ${cleanName}`,
        nextProgram: `${category} Showcase`,
        programProgress: 35 + ((channels.length * 17) % 50),
        synopsis: `Direct HLS broadcast stream from iptv-org/iptv (${category} · ${resolution}).`,
        bitrateKbps: resolution === '4K UHD' ? 12800 : resolution === '1080p' ? 5400 : 2800,
        isCustom: true,
      });

      pendingExtinf = null;

      if (channels.length >= maxLimit) {
        break;
      }
    } else if (pendingExtinf) {
      errors.push(`Line ${i + 1}: Invalid stream URL "${line.slice(0, 40)}"`);
      pendingExtinf = null;
    }
  }

  if (channels.length === 0 && errors.length === 0) {
    errors.push('No valid HTTP/HTTPS stream URLs (.m3u8) found in the playlist.');
  }

  return {
    channels,
    errors,
    totalParsed: channels.length,
  };
}

function detectCountryFromTvgId(tvgId: string): string {
  if (!tvgId) return 'US';
  const dotParts = tvgId.split('.');
  if (dotParts.length >= 2) {
    const suffix = dotParts[dotParts.length - 1].split('@')[0].toUpperCase();
    if (suffix.length === 2) return suffix;
  }
  return 'US';
}

function formatCountryName(code: string): string {
  const map: Record<string, string> = {
    US: 'United States',
    UK: 'United Kingdom',
    GB: 'United Kingdom',
    CA: 'Canada',
    DE: 'Germany',
    FR: 'France',
    JP: 'Japan',
    KR: 'South Korea',
    ES: 'Spain',
    IT: 'Italy',
    AU: 'Australia',
    BR: 'Brazil',
    CH: 'Switzerland',
    AT: 'Austria',
    NL: 'Netherlands',
    INT: 'International',
  };
  const upper = (code || 'US').toUpperCase();
  return map[upper] || upper;
}

export function filterAndSortChannels(
  channels: IptvChannel[],
  options: {
    category: string;
    countryCode: string;
    resolution: string;
    searchQuery: string;
    onlyIds?: string[];
  }
): IptvChannel[] {
  const q = options.searchQuery.trim().toLowerCase();

  return channels.filter((ch) => {
    if (options.onlyIds && !options.onlyIds.includes(ch.id)) {
      return false;
    }
    if (options.category !== 'All' && ch.category !== options.category) {
      return false;
    }
    if (options.countryCode !== 'ALL' && ch.countryCode !== options.countryCode) {
      return false;
    }
    if (options.resolution !== 'ALL' && ch.resolution !== options.resolution) {
      return false;
    }
    if (q) {
      const hay = `${ch.name} ${ch.category} ${ch.country} ${ch.currentProgram} ${ch.synopsis}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
