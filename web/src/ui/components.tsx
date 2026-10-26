import { ChevronLeft, ChevronRight, Play, Search, X } from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { PROFILE_COLORS, type Profile } from '../data/store';
import { bestQuality, gradient, monogram, qualityBadge, seedColors, type Channel, type Movie } from '../data/types';

// ---------------------------------------------------------------- small bits

export function Pill({ children, tone, className = '' }: { children: ReactNode; tone?: string; className?: string }) {
  return <span className={`pill ${tone ?? ''} ${className}`}>{children}</span>;
}

export function LivePill() {
  return (
    <span className="pill lime">
      <i className="live-dot" />
      LIVE
    </span>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="progress">
      <i style={{ width: `${Math.min(1, Math.max(0.03, value)) * 100}%` }} />
    </div>
  );
}

export function Chip({ label, leading, selected, onClick }: { label: string; leading?: string; selected?: boolean; onClick: () => void }) {
  return (
    <button className={`chip press ${selected ? 'on' : ''}`} onClick={onClick} aria-pressed={selected}>
      {leading && <span>{leading}</span>}
      {label}
    </button>
  );
}

export function Toggle({ title, subtitle, checked, onChange }: { title: string; subtitle: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button className="toggle-row" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
      <div>
        <div className="t">{title}</div>
        <div className="s">{subtitle}</div>
      </div>
      <span className={`switch ${checked ? 'on' : ''}`} />
    </button>
  );
}

export function SectionHeader({ title, emoji, subtitle, onSeeAll }: { title: string; emoji?: string; subtitle?: string | null; onSeeAll?: () => void }) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title">{emoji ? `${emoji}  ${title}` : title}</h2>
        {subtitle && <div className="section-sub">{subtitle}</div>}
      </div>
      {onSeeAll && (
        <button className="see-all press" onClick={onSeeAll}>
          See all <ChevronRight size={18} />
        </button>
      )}
    </div>
  );
}

export function SearchField({ query, onQuery, autoFocus }: { query: string; onQuery: (q: string) => void; autoFocus?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <label className="search">
      <Search size={22} />
      <input
        ref={ref}
        type="search"
        value={query}
        placeholder="Bollywood, anime, Ghana, Hindi, CNN…"
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        aria-label="Search channels and movies"
        enterKeyHint="search"
      />
      {query && (
        <button onClick={() => onQuery('')} aria-label="Clear search" className="press">
          <X size={22} />
        </button>
      )}
    </label>
  );
}

export function ProfileAvatar({ profile, size, onClick }: { profile: Profile; size: number; onClick?: () => void }) {
  const [a, b] = PROFILE_COLORS[Math.min(Math.max(profile.color, 0), PROFILE_COLORS.length - 1)];
  const style: CSSProperties = {
    width: size,
    height: size,
    borderRadius: size * 0.3,
    background: `linear-gradient(135deg, ${a}, ${b})`,
    fontSize: size * 0.5,
  };
  return onClick ? (
    <button className="avatar press" style={style} onClick={onClick} aria-label={`Profile: ${profile.name}`}>
      {profile.avatar}
    </button>
  ) : (
    <span className="avatar" style={style}>
      {profile.avatar}
    </span>
  );
}

// ---------------------------------------------------------------- channel logo

/** Logo URL → whether it needs a dark tile, analysed once per browser. */
const darkTiles: Record<string, boolean> = (() => {
  try {
    return JSON.parse(localStorage.getItem('kw.darkTiles') ?? '{}');
  } catch {
    return {};
  }
})();
let saveTimer = 0;
function rememberTile(url: string, dark: boolean) {
  darkTiles[url] = dark;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      const entries = Object.entries(darkTiles).slice(-3000);
      localStorage.setItem('kw.darkTiles', JSON.stringify(Object.fromEntries(entries)));
    } catch {
      /* ignore */
    }
  }, 1500);
}

/** True when the logo is mostly light pixels on a largely transparent background. */
function needsDarkTile(img: HTMLImageElement): boolean {
  const size = 24;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let opaque = 0;
  let luminance = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 140) continue;
    opaque++;
    luminance += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
  }
  const total = size * size;
  if (opaque === 0) return false;
  return 1 - opaque / total > 0.15 && luminance / opaque > 0.72;
}

/**
 * Channel logo on a soft tile, falling back to a monogram when there is no logo or it fails to load.
 * Most iptv-org logos are drawn for light backgrounds; mostly-white logos on transparent backgrounds
 * get a dark tile instead. The logo is first requested with CORS so its pixels can be read; hosts
 * that don't allow that get a plain request and keep the light tile.
 */
export function ChannelLogo({ channel, className = '', lazy = true }: { channel: Channel; className?: string; lazy?: boolean }) {
  const url = channel.l;
  const [mode, setMode] = useState<'cors' | 'plain' | 'failed'>(url ? (url in darkTiles ? 'plain' : 'cors') : 'failed');
  const [dark, setDark] = useState(url ? darkTiles[url] ?? false : false);

  useEffect(() => {
    setMode(url ? (url in darkTiles ? 'plain' : 'cors') : 'failed');
    setDark(url ? darkTiles[url] ?? false : false);
  }, [url]);

  if (mode === 'failed' || !url) {
    return (
      <div className={`logo ${className}`} style={{ background: gradient(seedColors(channel.id)) }}>
        <span className="mono">{monogram(channel.n)}</span>
      </div>
    );
  }
  return (
    <div className={`logo ${dark ? 'dark' : ''} ${className}`}>
      <img
        key={mode}
        src={url}
        alt=""
        loading={lazy ? 'lazy' : 'eager'}
        decoding="async"
        referrerPolicy="no-referrer"
        crossOrigin={mode === 'cors' ? 'anonymous' : undefined}
        onLoad={(e) => {
          if (mode !== 'cors') return;
          let d = false;
          try {
            d = needsDarkTile(e.currentTarget);
          } catch {
            /* tainted canvas */
          }
          rememberTile(url, d);
          setDark(d);
        }}
        onError={() => setMode(mode === 'cors' ? 'plain' : 'failed')}
      />
    </div>
  );
}

// ---------------------------------------------------------------- posters

function QuickPlay({ onPlay, label }: { onPlay: () => void; label: string }) {
  return (
    <button
      className="quick-play"
      aria-label={`Play ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        onPlay();
      }}
    >
      <Play size={18} fill="currentColor" />
    </button>
  );
}

/** Portrait channel poster: vivid gradient, logo tile, name, flag + quality badge. */
export function PosterCard({ channel, flag, onOpen, onPlay, fluid }: { channel: Channel; flag?: string; onOpen: () => void; onPlay?: () => void; fluid?: boolean }) {
  const q = qualityBadge(bestQuality(channel));
  return (
    <div className={`card-host ${fluid ? 'fluid' : ''}`}>
      <button className="poster press" style={{ background: gradient(seedColors(channel.id)) }} onClick={onOpen} title={channel.n}>
        <span className="glow" />
        <ChannelLogo channel={channel} />
        <span className="scrim" />
        <span className="name">{channel.n}</span>
        <span className="top">
          <span>{flag}</span>
          {q && <Pill>{q}</Pill>}
        </span>
      </button>
      {onPlay && <QuickPlay onPlay={onPlay} label={channel.n} />}
    </div>
  );
}

/** Portrait film poster with real artwork, year badge and an optional resume bar. */
export function MoviePoster({ movie, progress, onOpen, onPlay, fluid }: { movie: Movie; progress?: number; onOpen: () => void; onPlay?: () => void; fluid?: boolean }) {
  return (
    <div className={`card-host ${fluid ? 'fluid' : ''}`}>
      <button className="poster press" style={{ background: gradient(seedColors(movie.id)) }} onClick={onOpen} title={movie.t}>
        {movie.yt ? (
          <>
            {/* Wide YouTube thumbnail: show it whole over a blurred copy of itself */}
            <img className="art blur" src={movie.p} alt="" loading="lazy" decoding="async" />
            <img className="art wide" src={movie.p} alt="" loading="lazy" decoding="async" />
            <span className="top">
              <Pill tone="lime">NEW</Pill>
            </span>
          </>
        ) : (
          (movie.p || movie.b) && <img className="art" src={movie.p ?? movie.b} alt="" loading="lazy" decoding="async" />
        )}
        <span className="scrim" />
        <span className="bottom">
          <span className="name">{movie.t}</span>
          {progress !== undefined && (
            <span className="progress" style={{ display: 'block' }}>
              <i style={{ width: `${Math.max(0.03, progress) * 100}%` }} />
            </span>
          )}
        </span>
        {movie.y && !movie.yt && (
          <span className="top" style={{ justifyContent: 'flex-end' }}>
            <Pill>{movie.y}</Pill>
          </span>
        )}
      </button>
      {onPlay && <QuickPlay onPlay={onPlay} label={movie.t} />}
    </div>
  );
}

/** Netflix-style Top 10 card: giant outlined rank number tucked behind the poster. */
export function Top10Card({ rank, channel, onOpen, onPlay }: { rank: number; channel: Channel; onOpen: () => void; onPlay: () => void }) {
  return (
    <div className={`top10 ${rank >= 10 ? 'two' : ''}`}>
      <svg className="rank" viewBox={`0 0 ${rank >= 10 ? 150 : 90} 172`} width={rank >= 10 ? 150 : 90} aria-hidden>
        <defs>
          <linearGradient id={`rk${rank}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#c8ff2e" />
            <stop offset="1" stopColor="#ff2d6f" />
          </linearGradient>
        </defs>
        <text x="2" y="166" fill="#07070b" stroke={`url(#rk${rank})`} strokeWidth="3">
          {rank}
        </text>
      </svg>
      <PosterCard channel={channel} onOpen={onOpen} onPlay={onPlay} />
    </div>
  );
}

/** Landscape card for "Continue watching": click plays, the info button opens details. */
export function WideCard({ channel, onPlay }: { channel: Channel; onPlay: () => void }) {
  return (
    <button className="wide-card press" onClick={onPlay} title={channel.n}>
      <div className="frame" style={{ background: gradient(seedColors(channel.id)) }}>
        <ChannelLogo channel={channel} />
        <span className="play-dot">
          <Play size={18} fill="currentColor" />
        </span>
        <LivePill />
      </div>
      <div className="title">{channel.n}</div>
    </button>
  );
}

export function MovieWideCard({ movie, progress, onPlay }: { movie: Movie; progress?: number; onPlay: () => void }) {
  return (
    <button className="wide-card press" onClick={onPlay} title={movie.t}>
      <div className="frame" style={{ background: gradient(seedColors(movie.id)) }}>
        {(movie.b || movie.p) && <img src={movie.b ?? movie.p} alt="" loading="lazy" decoding="async" />}
        <span className="play-dot center">
          <Play size={22} fill="currentColor" />
        </span>
        {progress !== undefined && <ProgressBar value={progress} />}
      </div>
      <div className="title">{movie.t}</div>
    </button>
  );
}

// ---------------------------------------------------------------- rails

/** Horizontal scroller with arrow buttons for mouse users. */
export function Rail({ children, tight, className = '' }: { children: ReactNode; tight?: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const measure = () => {
    const el = ref.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 8 });
  };
  useLayoutEffect(measure, [children]);

  const scroll = (dir: number) => {
    const el = ref.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className="rail-wrap">
      <div ref={ref} className={`rail ${tight ? 'tight' : ''} ${className}`} onScroll={measure}>
        {children}
      </div>
      <button className="rail-arrow left" disabled={edges.start} onClick={() => scroll(-1)} aria-label="Scroll left" tabIndex={-1}>
        <ChevronLeft />
      </button>
      <button className="rail-arrow right" disabled={edges.end} onClick={() => scroll(1)} aria-label="Scroll right" tabIndex={-1}>
        <ChevronRight />
      </button>
    </div>
  );
}

/** Renders a long list a page at a time as the user scrolls, so 8,000-channel lists stay smooth. */
export function useIncremental<T>(list: T[], step = 60): [T[], ReactNode] {
  const [count, setCount] = useState(step);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => setCount(step), [list, step]);
  useEffect(() => {
    const el = ref.current;
    if (!el || count >= list.length) return;
    const io = new IntersectionObserver((entries) => entries[0].isIntersecting && setCount((c) => c + step), { rootMargin: '800px' });
    io.observe(el);
    return () => io.disconnect();
  }, [count, list.length, step]);
  return [list.slice(0, count), count < list.length ? <div ref={ref} className="sentinel" /> : null];
}
