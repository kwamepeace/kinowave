import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseM3UPlaylist,
  extractAttribute,
  extractChannelTitle,
  cleanChannelDisplayName,
  normalizeCategory,
  filterAndSortChannels,
} from './m3uParser';

test('extractAttribute and extractChannelTitle parse standard iptv-org EXTINF lines', () => {
  const line = '#EXTINF:-1 tvg-id="RedBullTV.at" tvg-logo="https://i.imgur.com/logo.png" group-title="Sports",Red Bull TV (1080p) [Not 24/7]';
  assert.equal(extractAttribute(line, 'tvg-id'), 'RedBullTV.at');
  assert.equal(extractAttribute(line, 'group-title'), 'Sports');
  const rawTitle = extractChannelTitle(line);
  assert.equal(rawTitle, 'Red Bull TV (1080p) [Not 24/7]');
  assert.equal(cleanChannelDisplayName(rawTitle), 'Red Bull TV');
});

test('parseM3UPlaylist parses multi-channel iptv-org M3U playlist accurately', () => {
  const sampleM3u = `#EXTM3U
#EXTINF:-1 tvg-id="NASATV.us" group-title="Science",NASA TV Public (1080p)
https://ntv1.akamaized.net/hls/live/2014075/NASA-NTV1-HLS/master.m3u8
#EXTINF:-1 tvg-id="Filmstream.uk" group-title="Movies",Filmstream Classic Cinema (720p)
https://cdn.example.com/filmstream/index.m3u8
`;

  const result = parseM3UPlaylist(sampleM3u);
  assert.equal(result.errors.length, 0);
  assert.equal(result.totalParsed, 2);
  assert.equal(result.channels[0].name, 'NASA TV Public');
  assert.equal(result.channels[0].category, 'Sci-Fi & Tech');
  assert.equal(result.channels[0].countryCode, 'US');
  assert.equal(result.channels[0].resolution, '1080p');
  assert.equal(result.channels[1].name, 'Filmstream Classic Cinema');
  assert.equal(result.channels[1].category, 'Movies');
  assert.equal(result.channels[1].countryCode, 'UK');
  assert.equal(result.channels[1].resolution, '720p');
});

test('parseM3UPlaylist rejects empty input and reports invalid stream URLs', () => {
  const emptyRes = parseM3UPlaylist('   ');
  assert.equal(emptyRes.totalParsed, 0);
  assert.ok(emptyRes.errors.length > 0);

  const badUrlRes = parseM3UPlaylist('#EXTM3U\n#EXTINF:-1,Bad Channel\nftp://invalid-stream');
  assert.equal(badUrlRes.totalParsed, 0);
  assert.ok(badUrlRes.errors.length > 0);
});

test('filterAndSortChannels filters by category, countryCode, resolution, and search query', () => {
  const parsed = parseM3UPlaylist(`#EXTM3U
#EXTINF:-1 tvg-id="Arirang.kr" group-title="News",Arirang World (1080p)
https://amdlive-ch01-ctnd-com.akamaized.net/arirang_1ch/smil:arirang_1ch.smil/playlist.m3u8
#EXTINF:-1 tvg-id="RedBull.at" group-title="Sports",Red Bull Action (4K)
https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8
`);

  const sportsOnly = filterAndSortChannels(parsed.channels, {
    category: 'Sports',
    countryCode: 'ALL',
    resolution: 'ALL',
    searchQuery: '',
  });
  assert.equal(sportsOnly.length, 1);
  assert.equal(sportsOnly[0].name, 'Red Bull Action');

  const searchMatch = filterAndSortChannels(parsed.channels, {
    category: 'All',
    countryCode: 'KR',
    resolution: '1080p',
    searchQuery: 'arirang',
  });
  assert.equal(searchMatch.length, 1);
  assert.equal(searchMatch[0].countryCode, 'KR');
});

test('normalizeCategory maps diverse iptv-org group titles cleanly', () => {
  assert.equal(normalizeCategory('Classic Movies'), 'Movies');
  assert.equal(normalizeCategory('Outdoor Sports'), 'Sports');
  assert.equal(normalizeCategory('Nature Documentary'), 'Documentary');
  assert.equal(normalizeCategory('Kids Animation'), 'Animation');
});
