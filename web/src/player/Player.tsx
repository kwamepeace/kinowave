import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Maximize,
  Minimize,
  Moon,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Proportions,
  Server,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useApp } from '../context';
import { addWatchTime, markWatched, positionOf, savePosition, savingData, settings } from '../data/store';
import { isGeoBlocked, movieKey, qualityBadge, runtimeLabel, type Channel, type Movie } from '../data/types';
import type { Playback } from '../nav';
import { ChannelLogo, LivePill, Pill } from '../ui/components';
import { LiveEngine, type Phase } from './engine';
import { YouTubePlayer } from './YouTubePlayer';

const AUTO_NEXT_SECONDS = 5;
const WATCH_TICK_SECONDS = 15;
const SLEEP_STEPS = [15, 30, 60, 90];

export function Player({ playback, onClose }: { playback: Playback; onClose: () => void }) {
  if (playback.kind === 'movie' && playback.movie.yt) return <YouTubePlayer movie={playback.movie} fromStart={playback.fromStart} onClose={onClose} />;
  return <VideoPlayer playback={playback} onClose={onClose} />;
}

function VideoPlayer({ playback, onClose }: { playback: Playback; onClose: () => void }) {
  const { index } = useApp();
  const rootRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const engineRef = useRef<LiveEngine | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  const movie = playback.kind === 'movie' ? playback.movie : null;
  const queue = playback.kind === 'live' ? playback.queue : [];
  const [queueIndex, setQueueIndex] = useState(playback.kind === 'live' ? playback.index : 0);
  const channel: Channel | null = queue[queueIndex] ?? null;
  const [streamIndex, setStreamIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('tuning');
  const [isPlaying, setIsPlaying] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [sleepAt, setSleepAt] = useState(0);
  const [autoNextIn, setAutoNextIn] = useState(0);
  /** The viewer tapped "stay" on the autoplay countdown */
  const [stay, setStay] = useState(false);
  const [controls, setControls] = useState(true);
  const [poke, setPoke] = useState(0);
  const [dataSaver] = useState(savingData);
  const firstStream = useRef(playback.kind === 'live' ? playback.stream : 0);

  const show = useCallback(() => {
    setControls(true);
    setPoke((p) => p + 1);
  }, []);

  const zap = useCallback(
    (step: number) => {
      if (queue.length <= 1) return;
      setQueueIndex((i) => (((i + step) % queue.length) + queue.length) % queue.length);
    },
    [queue.length],
  );

  // ------------------------------------------------------------ live: one engine, retuned per channel
  useEffect(() => {
    if (movie || !videoRef.current) return;
    const engine = new LiveEngine(videoRef.current, {
      onPhase: setPhase,
      onStream: setStreamIndex,
      maxHeight: () => (dataSaver ? 480 : 0),
    });
    engineRef.current = engine;
    return () => engine.destroy();
  }, [movie, dataSaver]);

  useEffect(() => {
    if (!channel || !engineRef.current) return;
    setAutoNextIn(0);
    setStay(false);
    markWatched(channel.id);
    engineRef.current.play(channel, firstStream.current);
    firstStream.current = 0;
    show();
  }, [channel, show]);

  // ------------------------------------------------------------ movies: direct MP4 with resume
  useEffect(() => {
    const video = videoRef.current;
    if (!movie || !video) return;
    markWatched(movieKey(movie));
    setPhase('tuning');
    const resumeAt = playback.kind === 'movie' && playback.fromStart ? 0 : positionOf(movie.id);
    video.src = (dataSaver && movie.lu) || movie.u || '';
    const onMeta = () => {
      if (resumeAt > 0) video.currentTime = resumeAt / 1000;
    };
    const onPlaying = () => setPhase('playing');
    const onError = () => setPhase('failed');
    const onEnded = () => {
      save();
      onClose();
    };
    const save = () => {
      const duration = isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : (movie.len ?? 0) * 1000;
      if (duration > 0 && video.currentTime > 0) savePosition(movie.id, video.currentTime * 1000, duration);
    };
    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('playing', onPlaying);
    video.addEventListener('error', onError);
    video.addEventListener('ended', onEnded);
    video.play().catch(() => {});
    // Remember the position every few seconds so "Continue watching" survives closed tabs
    const t = window.setInterval(save, 5000);
    window.addEventListener('pagehide', save);
    return () => {
      save();
      clearInterval(t);
      window.removeEventListener('pagehide', save);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('error', onError);
      video.removeEventListener('ended', onEnded);
      video.removeAttribute('src');
      video.load();
    };
  }, [movie]);

  const retry = () => {
    const v = videoRef.current;
    if (movie && v) {
      // load() rewinds, so carry the position across
      const at = v.currentTime || positionOf(movie.id) / 1000;
      setPhase('tuning');
      v.load();
      v.addEventListener('loadedmetadata', () => (v.currentTime = at), { once: true });
      v.play().catch(() => {});
    } else {
      setStay(false);
      engineRef.current?.retry();
    }
  };

  // ------------------------------------------------------------ autoplay: count down, then hop on
  useEffect(() => {
    if (phase !== 'failed' || stay || movie || queue.length <= 1 || !settings.get().autoplayNext) return;
    let s = AUTO_NEXT_SECONDS;
    setAutoNextIn(s);
    const t = window.setInterval(() => {
      s--;
      if (s <= 0) {
        clearInterval(t);
        setAutoNextIn(0);
        zap(1);
      } else setAutoNextIn(s);
    }, 1000);
    return () => clearInterval(t);
  }, [phase, stay, movie, queue.length, zap, queueIndex]);

  const cancelAutoNext = () => {
    setAutoNextIn(0);
    setStay(true);
  };

  // ------------------------------------------------------------ watch-time signal for For You
  useEffect(() => {
    const t = window.setInterval(() => {
      const v = videoRef.current;
      if (!v || v.paused) return;
      const key = movie ? movieKey(movie) : channel?.id;
      if (key) addWatchTime(key, WATCH_TICK_SECONDS);
    }, WATCH_TICK_SECONDS * 1000);
    return () => clearInterval(t);
  }, [movie, channel]);

  // ------------------------------------------------------------ play state, wake lock, media session
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let lock: WakeLockSentinel | null = null;
    const sync = async () => {
      setIsPlaying(!v.paused);
      setMuted(v.muted);
      // Keep the screen awake while playing; let it sleep when paused
      if (!v.paused && !lock && 'wakeLock' in navigator && document.visibilityState === 'visible') {
        lock = await navigator.wakeLock.request('screen').catch(() => null);
      } else if (v.paused && lock) {
        lock.release().catch(() => {});
        lock = null;
      }
    };
    const evs = ['play', 'pause', 'playing', 'volumechange'];
    evs.forEach((e) => v.addEventListener(e, sync));
    const onVis = () => {
      lock = null;
      sync();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      evs.forEach((e) => v.removeEventListener(e, sync));
      document.removeEventListener('visibilitychange', onVis);
      lock?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    const title = movie?.t ?? channel?.n ?? '';
    const art = movie?.p ?? channel?.l;
    navigator.mediaSession.metadata = new MediaMetadata({
      title,
      artist: movie ? 'KinoWave · On demand' : 'KinoWave · Live',
      artwork: art ? [{ src: art }] : [],
    });
    const ms = navigator.mediaSession;
    const set = (a: MediaSessionAction, h: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(a, h);
      } catch {
        /* unsupported action */
      }
    };
    set('nexttrack', movie ? null : () => zap(1));
    set('previoustrack', movie ? null : () => zap(-1));
    return () => {
      set('nexttrack', null);
      set('previoustrack', null);
    };
  }, [movie, channel, zap]);

  // ------------------------------------------------------------ sleep timer: off → 15 → 30 → 60 → 90 → off
  const cycleSleep = () => {
    const remaining = sleepAt ? Math.floor((sleepAt - Date.now()) / 60_000) + 1 : 0;
    const next = SLEEP_STEPS.find((m) => m > remaining);
    setSleepAt(next ? Date.now() + next * 60_000 : 0);
  };
  useEffect(() => {
    if (!sleepAt) return;
    const t = window.setTimeout(() => {
      videoRef.current?.pause();
      onClose();
    }, sleepAt - Date.now());
    return () => clearTimeout(t);
  }, [sleepAt, onClose]);
  const [, setNow] = useState(0);
  useEffect(() => {
    if (!sleepAt) return;
    const t = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, [sleepAt]);

  // ------------------------------------------------------------ controls auto-hide
  useEffect(() => {
    if (!controls || phase !== 'playing') return;
    const t = window.setTimeout(() => setControls(false), 3500);
    return () => clearTimeout(t);
  }, [controls, poke, phase]);

  // Keep the active channel in view in the strip
  useEffect(() => {
    const strip = stripRef.current;
    const el = strip?.children[queueIndex] as HTMLElement | undefined;
    if (strip && el) strip.scrollTo({ left: el.offsetLeft - strip.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [queueIndex, controls]);

  // ------------------------------------------------------------ actions
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const seekBy = (s: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + s));
  };
  const toggleFullscreen = () => {
    const root = rootRef.current;
    const v = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void }) | null;
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else if (root?.requestFullscreen) root.requestFullscreen().catch(() => {});
    else v?.webkitEnterFullscreen?.();
  };
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      document.removeEventListener('fullscreenchange', onFs);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);
  const pip = () => {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture?.().catch(() => {});
  };
  const toggleMute = () => {
    const v = videoRef.current;
    if (v) v.muted = !v.muted;
  };

  // ------------------------------------------------------------ keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement && e.target.type !== 'range') return;
      const k = e.key;
      let handled = true;
      if (k === ' ' || k === 'k') togglePlay();
      else if (k === 'Escape' && !document.fullscreenElement) onClose();
      else if ((k === 'ArrowUp' || k === 'PageUp') && !movie) zap(-1);
      else if ((k === 'ArrowDown' || k === 'PageDown') && !movie) zap(1);
      else if (k === 'ArrowLeft' && movie) seekBy(-10);
      else if (k === 'ArrowRight' && movie) seekBy(10);
      else if (k === 'f') toggleFullscreen();
      else if (k === 'm') toggleMute();
      else if (k === 'p') pip();
      else if (k === 'z') setZoom((z) => !z);
      else handled = false;
      if (handled) {
        // Capture phase + stop, so a detail sheet underneath doesn't also react (Escape)
        e.preventDefault();
        e.stopPropagation();
        show();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  // ------------------------------------------------------------ touch + mouse gestures
  const gesture = useRef({ y: 0, x: 0, t: 0, lastTap: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    gesture.current.y = e.clientY;
    gesture.current.x = e.clientX;
    gesture.current.t = Date.now();
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current;
    const dy = e.clientY - g.y;
    const dx = e.clientX - g.x;
    // Swipe up for the next channel, down for the previous one
    if (e.pointerType !== 'mouse' && Math.abs(dy) > 90 && Math.abs(dy) > Math.abs(dx) * 1.5 && !movie) {
      zap(dy < 0 ? 1 : -1);
      return;
    }
    if (Math.abs(dy) > 12 || Math.abs(dx) > 12) return;
    const now = Date.now();
    if (now - g.lastTap < 300) {
      // Double tap: fit / zoom on touch, fullscreen with a mouse
      g.lastTap = 0;
      if (e.pointerType === 'mouse') toggleFullscreen();
      else setZoom((z) => !z);
      return;
    }
    g.lastTap = now;
    if (controls && phase === 'playing') setControls(false);
    else show();
  };

  const sleepMinutes = sleepAt ? Math.max(1, Math.floor((sleepAt - Date.now()) / 60_000) + 1) : 0;
  const stream = channel?.s[streamIndex];
  const sourceLabel = channel
    ? [`Server ${streamIndex + 1}/${channel.s.length}`, qualityBadge(stream?.q), `${index.countryFlag(channel.c)} ${index.countryName(channel.c)}`].filter(Boolean).join(' · ')
    : '';
  const supportsPip = typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

  return (
    <div
      ref={rootRef}
      className={`player ${!controls && phase === 'playing' ? 'hide-cursor' : ''}`}
      onPointerMove={(e) => e.pointerType === 'mouse' && (controls ? setPoke((p) => p + 1) : show())}
      role="dialog"
      aria-label={movie?.t ?? channel?.n ?? 'Player'}
    >
      <video ref={videoRef} className={zoom ? 'zoom' : ''} playsInline autoPlay onPointerDown={onPointerDown} onPointerUp={onPointerUp} />

      {phase !== 'playing' && (
        <StatusOverlay
          movie={movie}
          channel={channel}
          phase={phase}
          streamIndex={streamIndex}
          autoNextIn={autoNextIn}
          countryName={channel ? index.countryName(channel.c) : ''}
          onRetry={retry}
          onNextSource={() => engineRef.current?.nextSource(true)}
          onNextChannel={() => zap(1)}
          canZap={queue.length > 1}
          onCancelAutoNext={cancelAutoNext}
        />
      )}

      <div className={`chrome ${controls ? '' : 'hidden'}`}>
        <div className="scrim-top" />
        <div className="scrim-bottom" />

        <div className="bar">
          <Glass icon={<ArrowLeft />} label="Back" onClick={onClose} />
          <div className="who">
            {channel && (
              <>
                <ChannelLogo channel={channel} lazy={false} />
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    <b>{channel.n}</b>
                    <LivePill />
                  </div>
                  <div className="sub">{sourceLabel}</div>
                </div>
              </>
            )}
            {movie && (
              <>
                {(movie.p || movie.b) && <img className="thumb" src={movie.p ?? movie.b} alt="" />}
                <div style={{ minWidth: 0 }}>
                  <div className="title">
                    <b>{movie.t}</b>
                  </div>
                  <div className="sub">{[movie.y, runtimeLabel(movie), 'On demand'].filter(Boolean).join(' · ')}</div>
                </div>
              </>
            )}
          </div>
          <div className="tools" onClick={show}>
            {dataSaver && <Pill tone="saver">DATA SAVER</Pill>}
            {sleepAt ? (
              <button className="sleep-on press" onClick={cycleSleep} aria-label="Sleep timer">
                <Moon size={20} /> {sleepMinutes}m
              </button>
            ) : (
              <Glass icon={<Moon />} label="Sleep timer" onClick={cycleSleep} />
            )}
            {channel && channel.s.length > 1 && <Glass icon={<Server />} label="Switch server" onClick={() => engineRef.current?.nextSource(true)} />}
            <Glass icon={muted ? <VolumeX /> : <Volume2 />} label={muted ? 'Unmute' : 'Mute'} onClick={toggleMute} className="wide-only" />
            <Glass icon={<Proportions />} label="Fit or fill" onClick={() => setZoom((z) => !z)} />
            {supportsPip && <Glass icon={<PictureInPicture2 />} label="Picture in picture" onClick={pip} />}
            <Glass icon={fullscreen ? <Minimize /> : <Maximize />} label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen} />
          </div>
        </div>

        {phase === 'playing' && (
          <div className="transport" onClick={show}>
            {movie ? (
              <Glass icon={<RotateCcw />} label="Back 10 seconds" onClick={() => seekBy(-10)} big />
            ) : (
              <Glass icon={<ChevronUp />} label="Previous channel" onClick={() => zap(-1)} big />
            )}
            <button className="big-play press" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
              {isPlaying ? <Pause size={40} fill="currentColor" /> : <Play size={40} fill="currentColor" />}
            </button>
            {movie ? (
              <Glass icon={<RotateCw />} label="Forward 10 seconds" onClick={() => seekBy(10)} big />
            ) : (
              <Glass icon={<ChevronDown />} label="Next channel" onClick={() => zap(1)} big />
            )}
          </div>
        )}

        <div className="bottom" onPointerDown={show}>
          {movie && <SeekBar video={videoRef} />}
          {queue.length > 1 && (
            <>
              <div className="strip-label">
                Swipe ↑↓ or use the arrow keys to zap · {queueIndex + 1} of {queue.length}
              </div>
              <div ref={stripRef} className="strip">
                {queue.map((ch, i) => (
                  <button key={ch.id} className={`press ${i === queueIndex ? 'on' : ''}`} onClick={() => setQueueIndex(i)} aria-label={ch.n} title={ch.n}>
                    <ChannelLogo channel={ch} />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Glass({ icon, label, onClick, big, className = '' }: { icon: ReactNode; label: string; onClick: () => void; big?: boolean; className?: string }) {
  return (
    <button className={`icon-btn glass press ${big ? 'big' : ''} ${className}`} onClick={onClick} aria-label={label} title={label}>
      {icon}
    </button>
  );
}

/** Scrubber with elapsed / remaining time for on-demand films. */
function SeekBar({ video }: { video: React.RefObject<HTMLVideoElement | null> }) {
  const [pos, setPos] = useState(0);
  const [dur, setDur] = useState(0);
  const [scrub, setScrub] = useState<number | null>(null);
  useEffect(() => {
    const t = window.setInterval(() => {
      const v = video.current;
      if (!v) return;
      setPos(v.currentTime);
      setDur(isFinite(v.duration) ? v.duration : 0);
    }, 500);
    return () => clearInterval(t);
  }, [video]);
  const value = scrub ?? pos;
  return (
    <div className="seek">
      <input
        type="range"
        min={0}
        max={dur || 1}
        step={1}
        value={value}
        aria-label="Seek"
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={() => {
          if (scrub !== null && video.current) video.current.currentTime = scrub;
          setScrub(null);
        }}
        onKeyUp={() => {
          if (scrub !== null && video.current) video.current.currentTime = scrub;
          setScrub(null);
        }}
      />
      <div className="times">
        <span>{formatTime(value)}</span>
        <span className="muted">-{formatTime(Math.max(0, dur - value))}</span>
      </div>
    </div>
  );
}

function formatTime(sec: number): string {
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

function StatusOverlay({
  movie,
  channel,
  phase,
  streamIndex,
  autoNextIn,
  countryName,
  canZap,
  onRetry,
  onNextSource,
  onNextChannel,
  onCancelAutoNext,
}: {
  movie: Movie | null;
  channel: Channel | null;
  phase: Phase;
  streamIndex: number;
  autoNextIn: number;
  countryName: string;
  canZap: boolean;
  onRetry: () => void;
  onNextSource: () => void;
  onNextChannel: () => void;
  onCancelAutoNext: () => void;
}) {
  if (movie) {
    return (
      <div className="status movie">
        {(movie.b || movie.p) && <img className="bg" src={movie.b ?? movie.p} alt="" />}
        <div className="inner">
          <div className="ring-host">
            {phase === 'tuning' && <span className="ring" />}
            {(movie.p || movie.b) && <img className="thumb" src={movie.p ?? movie.b} alt="" />}
          </div>
          {phase === 'tuning' ? (
            <h3>Loading {movie.t}…</h3>
          ) : (
            <>
              <h3>This movie didn&apos;t load</h3>
              <p>Check your connection and try again.</p>
              <div className="row">
                <button className="btn brand press" onClick={onRetry}>
                  <RefreshCw size={18} /> Try again
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }
  if (!channel) return null;
  return (
    <div className="status">
      <div className="inner">
        <div className="ring-host">
          {phase === 'tuning' && <span className="ring" />}
          <ChannelLogo channel={channel} lazy={false} />
        </div>
        {phase === 'tuning' ? (
          <>
            <h3>Tuning in to {channel.n}…</h3>
            <p>
              Server {streamIndex + 1} of {channel.s.length}
            </p>
          </>
        ) : (
          <>
            <h3>This channel isn&apos;t responding</h3>
            <p>
              {isGeoBlocked(channel)
                ? `It may only work in ${countryName || 'its home country'}.`
                : "Free streams come and go, and some block web players. Try again, hop to the next one, or watch it in the Android app."}
            </p>
            {autoNextIn > 0 && (
              <button className="countdown press" onClick={onCancelAutoNext}>
                Next channel in {autoNextIn}… tap to stay
              </button>
            )}
            <div className="row">
              <button className="btn glass press" onClick={onRetry}>
                <RefreshCw size={18} /> Try again
              </button>
              {channel.s.length > 1 && (
                <button className="btn glass press" onClick={onNextSource}>
                  <Server size={18} /> Other server
                </button>
              )}
              {canZap && (
                <button className="btn brand press" onClick={onNextChannel}>
                  <SkipForward size={18} /> Next channel
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
