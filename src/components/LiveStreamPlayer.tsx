import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { motion, AnimatePresence } from 'motion/react';
import {
  Volume2,
  VolumeX,
  Maximize2,
  Bookmark,
  Radio,
  SlidersHorizontal,
  Play,
  Pause,
  RotateCcw,
  SkipBack,
  SkipForward,
  RectangleHorizontal,
} from 'lucide-react';
import { IptvChannel } from '../utils/m3uParser';
import { ChannelArtwork } from './ChannelArtwork';

interface LiveStreamPlayerProps {
  channel: IptvChannel;
  isSaved: boolean;
  onToggleSave: (channelId: string) => void;
  onSelectChannel: (channel: IptvChannel) => void;
  allChannels: IptvChannel[];
}

export const LiveStreamPlayer: React.FC<LiveStreamPlayerProps> = ({
  channel,
  isSaved,
  onToggleSave,
  onSelectChannel,
  allChannels,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [streamState, setStreamState] = useState<'connecting' | 'playing' | 'simulated-canvas'>('connecting');
  const [usingFallbackStream, setUsingFallbackStream] = useState(false);
  const [showStreamDetails, setShowStreamDetails] = useState(false);
  const [isTheaterWide, setIsTheaterWide] = useState(false);
  const [reloadCount, setReloadCount] = useState(0);

  const currentIndex = allChannels.findIndex((c) => c.id === channel.id);
  const handlePrevChannel = () => {
    if (allChannels.length === 0) return;
    const prevIdx = (currentIndex - 1 + allChannels.length) % allChannels.length;
    onSelectChannel(allChannels[prevIdx]);
  };
  const handleNextChannel = () => {
    if (allChannels.length === 0) return;
    const nextIdx = (currentIndex + 1) % allChannels.length;
    onSelectChannel(allChannels[nextIdx]);
  };

  // Pick 3 quick-switch channels excluding current
  const quickSwitchChannels = allChannels
    .filter((c) => c.id !== channel.id)
    .slice(0, 3);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setStreamState('connecting');
    setUsingFallbackStream(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const targetUrl = channel.streamUrl;

    const attachSource = (urlToLoad: string, isBackup: boolean) => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          manifestLoadingTimeOut: 7000,
          levelLoadingTimeOut: 7000,
          startLevel: 3,
        });
        hlsRef.current = hls;
        hls.loadSource(urlToLoad);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          // Prefer a higher quality rendition immediately so initial frames are sharp
          if (data.levels && data.levels.length > 1) {
            hls.nextLevel = Math.min(data.levels.length - 1, 4);
          }
          // Skip opening black title cards on VOD test streams so a vibrant cinema frame is visible immediately
          if (urlToLoad.includes('tears-of-steel') || urlToLoad.includes('sintel')) {
            try {
              video.currentTime = 38;
            } catch {
              // ignore if live stream doesn't allow seek
            }
          }
          video.muted = isMuted;
          video
            .play()
            .then(() => {
              setIsPlaying(true);
              setStreamState('playing');
            })
            .catch(() => {
              video.muted = true;
              setIsMuted(true);
              video.play().catch(() => {});
              setStreamState('playing');
            });
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            hls.destroy();
            if (!isBackup && channel.fallbackStreamUrl && channel.fallbackStreamUrl !== urlToLoad) {
              setUsingFallbackStream(true);
              attachSource(channel.fallbackStreamUrl, true);
            } else {
              setStreamState('simulated-canvas');
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = urlToLoad;
        video.addEventListener(
          'loadedmetadata',
          () => {
            setStreamState('playing');
            video.play().catch(() => {});
          },
          { once: true }
        );
        video.addEventListener(
          'error',
          () => {
            if (!isBackup && channel.fallbackStreamUrl) {
              setUsingFallbackStream(true);
              attachSource(channel.fallbackStreamUrl, true);
            } else {
              setStreamState('simulated-canvas');
            }
          },
          { once: true }
        );
      } else {
        setStreamState('simulated-canvas');
      }
    };

    attachSource(targetUrl, false);

    const safetyTimer = window.setTimeout(() => {
      setStreamState((prev) => (prev === 'connecting' ? 'simulated-canvas' : prev));
    }, 6500);

    return () => {
      window.clearTimeout(safetyTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [channel.id, channel.streamUrl, channel.fallbackStreamUrl, reloadCount]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || streamState === 'simulated-canvas') {
      setIsPlaying((p) => !p);
      return;
    }
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    if (video) {
      video.muted = nextMuted;
    }
  };

  const handleFullscreen = () => {
    if (!playerContainerRef.current) return;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      playerContainerRef.current.requestFullscreen?.().catch(() => {});
    }
  };

  return (
    <section
      aria-label="Live Broadcast Theater"
      className="relative w-full border-b border-white/[0.07] bg-[#07090E] overflow-hidden"
    >
      {/* Subtle Ambient Cinema Radial Backdrop Glow */}
      <div
        className="pointer-events-none absolute -top-24 left-1/4 w-[560px] h-[320px] rounded-full bg-[#E11D48]/[0.07] blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 lg:py-7">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start lg:items-stretch">
          {/* Left Column (8 cols normal, 12 cols in Theater Wide Mode): Live HLS Video + Fluid Control Deck */}
          <motion.div
            layout
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            ref={playerContainerRef}
            data-testid="live-video-viewport"
            className={`${
              isTheaterWide ? 'lg:col-span-12' : 'lg:col-span-8'
            } w-full min-w-0 rounded-3xl overflow-hidden bg-[#10141F] border border-white/[0.09] shadow-2xl shadow-black/60 flex flex-col justify-between`}
          >
            {/* Pure 16:9 Cinema Video Screen on mobile, seamless full-height flex-1 on desktop */}
            <div className="relative w-full aspect-video lg:aspect-auto lg:flex-1 lg:min-h-[380px] bg-[#05070B] overflow-hidden">
              {/* Rich Illustrated Scene Artwork (always visible underneath & blends softly with live video) */}
              <div
                className={`absolute inset-0 transition-opacity duration-500 ${
                  streamState === 'playing' ? 'opacity-35' : 'opacity-100'
                }`}
              >
                <ChannelArtwork channel={channel} className="w-full h-full" showCallSign={false} />
              </div>

              {/* Real HTML5 HLS Video Element */}
              <video
                ref={videoRef}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${
                  streamState === 'playing' ? 'opacity-95' : 'opacity-0 pointer-events-none'
                }`}
                playsInline
                muted={isMuted}
                autoPlay
                crossOrigin="anonymous"
              />

              {/* Measured Cinema Vignette Scrims */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-transparent to-black/85 pointer-events-none" />

              {/* Single-Line Top Overlay HUD Bar */}
              <div className="relative z-10 flex items-center justify-between gap-3 p-3.5 sm:p-5">
                <div className="flex items-center gap-2.5 text-xs font-medium text-white/95 min-w-0">
                  <Radio className="w-4 h-4 text-[#E11D48] shrink-0" aria-hidden="true" />
                  <span className="font-semibold tracking-wide text-white truncate">
                    {channel.name}
                  </span>
                  <span aria-hidden="true" className="text-white/40 shrink-0">·</span>
                  <span className="text-white/80 shrink-0 hidden sm:inline">{channel.category}</span>
                  <span aria-hidden="true" className="text-white/40 shrink-0 hidden sm:inline">·</span>
                  <span className="font-mono-tabular text-white/90 shrink-0">{channel.resolution}</span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsTheaterWide((w) => !w)}
                    aria-label={isTheaterWide ? 'Exit wide theater mode' : 'Expand wide theater mode'}
                    className="hidden lg:flex min-h-[38px] px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-xs font-medium text-white/90 border border-white/15 items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RectangleHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isTheaterWide ? 'Standard View' : 'Theater Mode'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowStreamDetails((s) => !s)}
                    aria-label="Toggle stream technical info"
                    aria-expanded={showStreamDetails}
                    className="min-h-[38px] px-3 py-1.5 rounded-xl bg-black/60 hover:bg-black/80 text-xs font-medium text-white/90 border border-white/15 flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Stream Info</span>
                  </button>
                </div>
              </div>

              {/* Technical Stream Source Drawer */}
              <AnimatePresence>
                {showStreamDetails && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.16 }}
                    className="relative z-10 mx-3.5 sm:mx-5 p-3.5 rounded-2xl bg-black/90 backdrop-blur-md border border-white/15 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between text-white/75">
                      <span>
                        Source: <strong className="text-white">github.com/iptv-org/iptv</strong>
                      </span>
                      <span className="font-mono-tabular text-white/90">
                        {channel.bitrateKbps} kbps HLS
                      </span>
                    </div>
                    <div className="font-mono-tabular text-[11px] text-white/60 truncate">
                      M3U8: {channel.streamUrl}
                    </div>
                    <div className="text-[11px] text-white/75">
                      Status:{' '}
                      {streamState === 'playing'
                        ? usingFallbackStream
                          ? 'Active HLS Relay Stream (Geo-Unblocked)'
                          : 'Direct M3U8 Broadcast Active'
                        : streamState === 'connecting'
                        ? 'Negotiating HLS Manifest...'
                        : 'Cinema Standby Preview (Stream Geo-Restricted)'}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Bottom Glowing Progress Strip Pinned to Bottom Edge of Video */}
              <div className="absolute bottom-0 left-0 right-0 z-10">
                <div className="h-1.5 w-full bg-white/15 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#E11D48] to-[#FB7185] transition-all duration-300"
                    style={{ width: `${channel.programProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Dedicated Fluid Transport & Channel Zapper Deck Below Video */}
            <div className="p-4 sm:p-5 bg-[#10141F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span className="text-white font-medium">On Air</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {channel.country} ({channel.language})
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular text-slate-300">
                    {channel.programProgress}% elapsed
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight truncate">
                  {channel.currentProgram}
                </h1>
              </div>

              {/* Transport, Channel Zapper & Audio Controls (44x44px hitboxes) */}
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={handlePrevChannel}
                  aria-label="Previous channel"
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <SkipBack className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pause broadcast' : 'Play broadcast'}
                  className="min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl bg-[#E11D48] hover:bg-[#BE123C] text-white text-xs font-semibold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-lg shadow-[#E11D48]/25"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                      <span>Watch Live</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleNextChannel}
                  aria-label="Next channel"
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <SkipForward className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                  className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white text-xs font-medium flex items-center justify-center gap-1.5 border border-white/10 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {isMuted ? (
                    <>
                      <VolumeX className="w-4 h-4 text-amber-400" aria-hidden="true" />
                      <span>Muted</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-4 h-4 text-emerald-400" aria-hidden="true" />
                      <span>Audio On</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setReloadCount((c) => c + 1)}
                  aria-label="Reconnect stream"
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" aria-hidden="true" />
                </button>

                <button
                  type="button"
                  onClick={handleFullscreen}
                  aria-label="Enter fullscreen theater"
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-white border border-white/10 flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                >
                  <Maximize2 className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Right Column (4 cols, or full-width below when Theater Wide Mode is active): EPG & Quick Zapper */}
          <motion.div
            layout
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className={`${
              isTheaterWide ? 'lg:col-span-12' : 'lg:col-span-4'
            } w-full min-w-0 rounded-3xl bg-[#10141F] border border-white/[0.09] p-5 sm:p-6 flex flex-col justify-between shadow-xl shadow-black/40`}
          >
            <div className="space-y-5">
              {/* Channel Title & Watchlist Button */}
              <div className="flex items-start justify-between gap-3 border-b border-white/[0.07] pb-4">
                <div className="min-w-0">
                  <div className="text-xs text-slate-400">
                    Channel Guide <span aria-hidden="true">·</span> {channel.country}
                  </div>
                  <h2 className="text-lg font-bold text-white mt-0.5 truncate">{channel.name}</h2>
                </div>

                <button
                  type="button"
                  onClick={() => onToggleSave(channel.id)}
                  aria-label={
                    isSaved
                      ? `Remove ${channel.name} from Watchlist`
                      : `Save ${channel.name} to Watchlist`
                  }
                  className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isSaved
                      ? 'bg-[#E11D48]/15 border-[#E11D48]/50 text-white'
                      : 'bg-white/[0.05] hover:bg-white/[0.1] border-white/10 text-slate-200'
                  }`}
                >
                  <Bookmark
                    className={`w-4 h-4 ${isSaved ? 'fill-[#E11D48] text-[#E11D48]' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isSaved ? 'In Watchlist' : 'Watchlist'}</span>
                </button>
              </div>

              {/* Synopsis */}
              <div className="space-y-1.5">
                <div className="text-xs font-medium text-slate-400">Program Synopsis</div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed line-clamp-3">
                  {channel.synopsis}
                </p>
              </div>

              {/* Now & Next EPG Schedule */}
              <div className="space-y-2.5 pt-2 border-t border-white/[0.07]">
                <div className="text-xs font-medium text-slate-400">Broadcast Schedule (EPG)</div>

                <div className="p-3.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                    <span className="text-[#FB7185] font-semibold">ON AIR NOW</span>
                    <span>{100 - channel.programProgress}m remaining</span>
                  </div>
                  <div className="text-sm font-semibold text-white line-clamp-1">
                    {channel.currentProgram}
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-transparent border border-white/[0.06] space-y-1">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-tabular">
                    <span>UP NEXT</span>
                    <span>+45 min</span>
                  </div>
                  <div className="text-sm font-medium text-slate-300 line-clamp-1">
                    {channel.nextProgram}
                  </div>
                </div>
              </div>

              {/* Quick Channel Switcher Rail */}
              <div className="space-y-2 pt-2 border-t border-white/[0.07]">
                <div className="text-xs font-medium text-slate-400">Quick Tune Dial</div>
                <div className="space-y-1.5">
                  {quickSwitchChannels.map((qCh) => (
                    <button
                      key={qCh.id}
                      type="button"
                      onClick={() => onSelectChannel(qCh)}
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.07] border border-white/[0.05] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer group"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-white group-hover:text-[#FB7185] transition-colors truncate">
                          {qCh.name}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">
                          {qCh.currentProgram}
                        </div>
                      </div>
                      <span className="text-[11px] font-mono-tabular text-slate-400 shrink-0">
                        {qCh.resolution}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Unboxed Metadata Footer */}
            <div className="pt-4 mt-4 border-t border-white/[0.07] flex items-center justify-between text-xs text-slate-400 font-mono-tabular">
              <span>
                {channel.category} <span aria-hidden="true">·</span> {channel.countryCode}
              </span>
              <span>{channel.bitrateKbps} kbps</span>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};
