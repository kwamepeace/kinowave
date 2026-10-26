/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Search,
  Tv,
  Film,
  FolderGit2,
  Bookmark,
  DownloadCloud,
  RotateCcw,
  X,
  LayoutGrid,
  ListVideo,
  Play,
} from 'lucide-react';
import { IptvChannel, filterAndSortChannels } from './utils/m3uParser';
import { INITIAL_IPTV_CHANNELS, IPTV_ORG_REMOTE_CATEGORIES } from './data/iptvCatalog';
import { LiveStreamPlayer } from './components/LiveStreamPlayer';
import { ChannelCard } from './components/ChannelCard';
import { ChannelArtwork } from './components/ChannelArtwork';
import { PlaylistImporterModal } from './components/PlaylistImporterModal';

type NavSection = 'live' | 'cinema' | 'directory' | 'watchlist';

const CATEGORIES = [
  'All',
  'Movies',
  'Sports',
  'News',
  'Documentary',
  'Sci-Fi & Tech',
  'Music',
  'Animation',
  'Lifestyle',
] as const;

const STORAGE_KEYS = {
  watchlist: 'kinowave_watchlist_v1',
  customChannels: 'kinowave_custom_channels_v1',
};

export default function App() {
  const [channels, setChannels] = useState<IptvChannel[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.customChannels);
      if (raw) {
        const parsedCustom = JSON.parse(raw) as IptvChannel[];
        if (Array.isArray(parsedCustom) && parsedCustom.length > 0) {
          return [...parsedCustom, ...INITIAL_IPTV_CHANNELS];
        }
      }
    } catch {
      // ignore storage errors
    }
    return INITIAL_IPTV_CHANNELS;
  });

  const [watchlistIds, setWatchlistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.watchlist);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return ['kinowave-4k-premiere', 'redbull-tv-global'];
  });

  const [activeNav, setActiveNav] = useState<NavSection>('live');
  const [activeChannelId, setActiveChannelId] = useState<string>(INITIAL_IPTV_CHANNELS[0].id);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedResolution, setSelectedResolution] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'grid' | 'epg'>('grid');
  const [isImporterOpen, setIsImporterOpen] = useState<boolean>(false);
  const [lastSyncedLabel, setLastSyncedLabel] = useState<string>('iptv-org/iptv master index');

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.watchlist, JSON.stringify(watchlistIds));
    } catch {
      // ignore
    }
  }, [watchlistIds]);

  const activeChannel = useMemo(() => {
    return channels.find((c) => c.id === activeChannelId) || channels[0];
  }, [channels, activeChannelId]);

  const availableCountries = useMemo(() => {
    const map = new Map<string, string>();
    channels.forEach((c) => {
      if (!map.has(c.countryCode)) {
        map.set(c.countryCode, c.country);
      }
    });
    return Array.from(map.entries());
  }, [channels]);

  const effectiveCategory = useMemo(() => {
    if (activeNav === 'cinema') return 'Movies';
    return selectedCategory;
  }, [activeNav, selectedCategory]);

  const filteredChannels = useMemo(() => {
    return filterAndSortChannels(channels, {
      category: effectiveCategory,
      countryCode: selectedCountry,
      resolution: selectedResolution,
      searchQuery,
      onlyIds: activeNav === 'watchlist' ? watchlistIds : undefined,
    });
  }, [
    channels,
    effectiveCategory,
    selectedCountry,
    selectedResolution,
    searchQuery,
    activeNav,
    watchlistIds,
  ]);

  // Featured 4K & Premiere Bento Spotlights
  const spotlightChannels = useMemo(() => {
    return channels.filter((c) => c.resolution === '4K UHD' || c.category === 'Movies').slice(0, 3);
  }, [channels]);

  const handleToggleSave = (channelId: string) => {
    setWatchlistIds((prev) =>
      prev.includes(channelId) ? prev.filter((id) => id !== channelId) : [...prev, channelId]
    );
  };

  const handleSelectChannel = (channel: IptvChannel) => {
    setActiveChannelId(channel.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleImportChannels = (newChannels: IptvChannel[], sourceLabel: string) => {
    setChannels((prev) => {
      const existingIds = new Set(prev.map((c) => c.id));
      const uniqueNew = newChannels.filter((c) => !existingIds.has(c.id));
      const updated = [...uniqueNew, ...prev];
      try {
        const customOnly = updated.filter((c) => c.isCustom).slice(0, 60);
        localStorage.setItem(STORAGE_KEYS.customChannels, JSON.stringify(customOnly));
      } catch {
        // ignore
      }
      return updated;
    });
    if (newChannels.length > 0) {
      setActiveChannelId(newChannels[0].id);
    }
    setLastSyncedLabel(sourceLabel);
  };

  const handleResetFilters = () => {
    setSelectedCategory('All');
    setSelectedCountry('ALL');
    setSelectedResolution('ALL');
    setSearchQuery('');
    if (activeNav === 'cinema') {
      setActiveNav('live');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-[#F3F4F6] flex flex-col pb-20 md:pb-10">
      {/* Top Bar Contract: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 h-14 bg-[#07090E]/90 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveNav('live');
          }}
          className="text-lg font-bold tracking-tight text-white font-display whitespace-nowrap shrink-0"
        >
          KinoWave
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300"
        >
          <button
            type="button"
            onClick={() => setActiveNav('live')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'live'
                ? 'text-white underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : 'hover:text-white'
            }`}
          >
            Live TV
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('cinema')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'cinema'
                ? 'text-white underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : 'hover:text-white'
            }`}
          >
            Cinema
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('directory')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'directory'
                ? 'text-white underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : 'hover:text-white'
            }`}
          >
            IPTV Directory
          </button>
          <button
            type="button"
            onClick={() => setActiveNav('watchlist')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activeNav === 'watchlist'
                ? 'text-white underline underline-offset-8 decoration-[#E11D48] decoration-2'
                : 'hover:text-white'
            }`}
          >
            Watchlist ({watchlistIds.length})
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => setIsImporterOpen(true)}
            className="min-h-[40px] px-4 py-2 text-xs font-semibold text-white bg-[#E11D48] hover:bg-[#BE123C] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#E11D48]/20"
          >
            Sync M3U
          </button>
        </div>
      </header>

      <main className="flex-1">
        {/* Dominant Focal Anchor: Live HLS Cinema Player & EPG Guide */}
        <LiveStreamPlayer
          channel={activeChannel}
          isSaved={watchlistIds.includes(activeChannel.id)}
          onToggleSave={handleToggleSave}
          onSelectChannel={handleSelectChannel}
          allChannels={channels}
        />

        {/* IPTV-Org Repository Directory View (when Directory tab is selected) */}
        {activeNav === 'directory' && (
          <section
            aria-label="IPTV-Org Category Playlists"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-white/[0.07]">
              <div>
                <div className="text-xs text-slate-400">
                  Open-Source Playlist Index <span aria-hidden="true">·</span> github.com/iptv-org/iptv
                </div>
                <h2 className="text-2xl font-bold text-white mt-1">
                  Global M3U Category Feeds
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsImporterOpen(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <DownloadCloud className="w-4 h-4 text-[#E11D48]" aria-hidden="true" />
                <span>Open Custom M3U Importer</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-6">
              {IPTV_ORG_REMOTE_CATEGORIES.map((cat) => (
                <div
                  key={cat.id}
                  className="p-5 rounded-3xl bg-[#10141F] border border-white/[0.08] hover:border-white/20 transition-colors flex flex-col justify-between space-y-4 shadow-lg shadow-black/30"
                >
                  <div className="space-y-1.5">
                    <div className="text-xs text-slate-400 font-mono-tabular">
                      categories/{cat.id}.m3u <span aria-hidden="true">·</span> ~{cat.estimatedChannels} channels
                    </div>
                    <h3 className="text-lg font-bold text-white">{cat.label}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{cat.description}</p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory(cat.category);
                        setActiveNav('live');
                      }}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Filter {cat.category}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsImporterOpen(true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold text-[#FB7185] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      Sync Feed →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Featured 4K & Premiere Cinema Bento Row (gives editorial pacing on Live TV view) */}
        {activeNav === 'live' && selectedCategory === 'All' && !searchQuery && (
          <section
            aria-label="Featured 4K Premieres"
            className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-2"
          >
            <div className="flex items-end justify-between gap-4 mb-5">
              <div>
                <div className="text-xs text-slate-400">
                  01. Curated High-Bitrate Selections <span aria-hidden="true">·</span> Direct HLS Streams
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mt-0.5">
                  Featured 4K & Arthouse Spotlight
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {spotlightChannels.map((spot, idx) => {
                const isCurrent = spot.id === activeChannel.id;
                return (
                  <div
                    key={spot.id}
                    className={`group relative rounded-3xl overflow-hidden border transition-all duration-200 ${
                      isCurrent
                        ? 'border-[#E11D48] shadow-xl shadow-[#E11D48]/15'
                        : 'border-white/[0.09] hover:border-white/25'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSelectChannel(spot)}
                      aria-label={`Play spotlight channel ${spot.name}`}
                      className="w-full text-left block relative aspect-[16/9] overflow-hidden cursor-pointer"
                    >
                      <ChannelArtwork
                        channel={spot}
                        className="w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#07090E] via-[#07090E]/50 to-transparent" />

                      <div className="absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4">
                        <div className="space-y-1 min-w-0">
                          <div className="text-xs text-slate-300 font-mono-tabular">
                            0{idx + 1} <span aria-hidden="true">·</span> {spot.category} <span aria-hidden="true">·</span>{' '}
                            {spot.resolution}
                          </div>
                          <h3 className="text-lg font-bold text-white truncate">{spot.name}</h3>
                          <p className="text-xs text-slate-300 truncate">{spot.currentProgram}</p>
                        </div>

                        <span className="w-11 h-11 rounded-2xl bg-[#E11D48] text-white flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform">
                          <Play className="w-4 h-4 fill-current ml-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Workspace Filter Toolbar & Live Channel Catalog */}
        <section
          aria-label="Live Channels Catalog"
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6"
        >
          {/* Section Header & Search/Country/View Controls */}
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pt-2 border-t border-white/[0.06]">
            <div>
              <div className="text-xs text-slate-400">
                02. Source: {lastSyncedLabel} <span aria-hidden="true">·</span>{' '}
                <span className="font-mono-tabular">{filteredChannels.length} channels available</span>
              </div>
              <h2 className="text-2xl font-bold text-white mt-0.5">
                {activeNav === 'watchlist'
                  ? 'Saved Watchlist Channels'
                  : activeNav === 'cinema'
                  ? '24/7 Cinema & Feature Film Streams'
                  : 'All Live Broadcast Channels'}
              </h2>
            </div>

            {/* Search Input, Country Selector, Resolution Filter & View Switcher */}
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative flex-1 sm:w-64">
                <label htmlFor="channel-search-input" className="sr-only">
                  Search channels or programs
                </label>
                <Search
                  className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
                <input
                  id="channel-search-input"
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search channels, movies, countries..."
                  className="w-full min-h-[44px] pl-10 pr-9 py-2 rounded-xl bg-[#10141F] border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#E11D48]"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search query"
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                )}
              </div>

              <div>
                <label htmlFor="country-filter-select" className="sr-only">
                  Filter by Country
                </label>
                <select
                  id="country-filter-select"
                  value={selectedCountry}
                  onChange={(e) => setSelectedCountry(e.target.value)}
                  aria-label="Filter by Country"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#10141F] border border-white/10 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#E11D48] cursor-pointer"
                >
                  <option value="ALL">All Regions ({availableCountries.length})</option>
                  {availableCountries.map(([code, name]) => (
                    <option key={code} value={code}>
                      {name} ({code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="resolution-filter-select" className="sr-only">
                  Filter by Resolution
                </label>
                <select
                  id="resolution-filter-select"
                  value={selectedResolution}
                  onChange={(e) => setSelectedResolution(e.target.value)}
                  aria-label="Filter by Resolution"
                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#10141F] border border-white/10 text-xs font-medium text-slate-200 focus:outline-none focus:border-[#E11D48] cursor-pointer"
                >
                  <option value="ALL">All Resolutions</option>
                  <option value="4K UHD">4K UHD</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD</option>
                </select>
              </div>

              {/* Segmented View Mode Toggle: Cinema Cards vs EPG Guide */}
              <div
                role="group"
                aria-label="Catalog View Layout"
                className="flex items-center gap-1 p-1 rounded-xl bg-[#10141F] border border-white/10"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Gallery Card View"
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'grid'
                      ? 'bg-[#E11D48] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Cards</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('epg')}
                  aria-label="EPG Schedule View"
                  className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    viewMode === 'epg'
                      ? 'bg-[#E11D48] text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ListVideo className="w-3.5 h-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">EPG List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Interactive Category Filter Bar with Fluid Motion Highlight */}
          {activeNav !== 'cinema' && (
            <div
              role="group"
              aria-label="Channel Category Filter"
              className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar"
            >
              {CATEGORIES.map((category) => {
                const isSelected = selectedCategory === category;
                return (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`relative min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isSelected
                        ? 'text-white'
                        : 'bg-[#10141F] text-slate-300 hover:text-white border border-white/[0.07]'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="active-category-bg"
                        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 rounded-xl bg-[#E11D48] -z-0"
                      />
                    )}
                    <span className="relative z-10">{category}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Channel Cards Grid or EPG Rows */}
          {filteredChannels.length > 0 ? (
            <div
              data-testid="channel-grid"
              className={
                viewMode === 'grid'
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'
                  : 'space-y-3'
              }
            >
              {filteredChannels.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  isActive={channel.id === activeChannel.id}
                  isSaved={watchlistIds.includes(channel.id)}
                  viewMode={viewMode}
                  onSelect={handleSelectChannel}
                  onToggleSave={handleToggleSave}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-[#10141F] border border-white/[0.08] p-10 text-center max-w-lg mx-auto my-6 space-y-4">
              <h3 className="text-lg font-bold text-white">No Matching Broadcast Streams</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeNav === 'watchlist'
                  ? 'Your Watchlist has no channels matching the current filters. Bookmark any live stream or reset filters to browse all channels.'
                  : 'No channels matched your active search query or region filter.'}
              </p>
              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="min-h-[44px] px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                  <span>Reset Filters</span>
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Clean Quiet Footer */}
      <footer className="border-t border-white/[0.07] py-6 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            KinoWave Live TV & Cinema <span aria-hidden="true">·</span> Powered by open-source M3U playlists from{' '}
            <a
              href="https://github.com/iptv-org/iptv"
              target="_blank"
              rel="noreferrer"
              className="text-white hover:underline"
            >
              github.com/iptv-org/iptv
            </a>
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsImporterOpen(true)}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Import M3U Playlist
            </button>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={handleResetFilters}
              className="hover:text-white transition-colors cursor-pointer"
            >
              Reset Catalog View
            </button>
          </div>
        </div>
      </footer>

      {/* Mobile Fixed Bottom Tab Bar (Thumb-Zone Navigation for Android/Mobile Viewports) */}
      <nav
        aria-label="Mobile Bottom Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#07090E]/95 backdrop-blur-xl border-t border-white/[0.08] grid grid-cols-4 items-center px-2"
      >
        <button
          type="button"
          onClick={() => setActiveNav('live')}
          className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
            activeNav === 'live' ? 'text-[#E11D48]' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Tv className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Live TV</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('cinema')}
          className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
            activeNav === 'cinema' ? 'text-[#E11D48]' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Film className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Cinema</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('directory')}
          className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
            activeNav === 'directory' ? 'text-[#E11D48]' : 'text-slate-400 hover:text-white'
          }`}
        >
          <FolderGit2 className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium tracking-tight mt-1">Directory</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveNav('watchlist')}
          className={`min-h-[48px] flex flex-col items-center justify-center cursor-pointer ${
            activeNav === 'watchlist' ? 'text-[#E11D48]' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Bookmark className="w-5 h-5" aria-hidden="true" />
          <span className="text-[10px] font-medium tracking-tight mt-1">
            Watchlist ({watchlistIds.length})
          </span>
        </button>
      </nav>

      {/* Interactive M3U / IPTV-Org Importer Modal */}
      <PlaylistImporterModal
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportChannels={handleImportChannels}
      />
    </div>
  );
}
