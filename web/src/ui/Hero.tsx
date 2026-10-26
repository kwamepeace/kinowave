import { Check, Play, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { HeroItem } from '../data/home';
import { bestQuality, capitalize, categoryLabel, colorsOf, gradient, qualityBadge, runtimeLabel } from '../data/types';
import { ChannelLogo, LivePill, Pill } from './components';

/** Big swipeable spotlight carousel at the top of Home, mixing live channels and films. */
export function HeroCarousel({
  items,
  saved,
  flagOf,
  lightweight,
  onPlay,
  onOpen,
  onToggleList,
}: {
  items: HeroItem[];
  saved: (item: HeroItem) => boolean;
  flagOf: (code: string) => string;
  lightweight: boolean;
  onPlay: (item: HeroItem) => void;
  onOpen: (item: HeroItem) => void;
  onToggleList: (item: HeroItem) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [paused, setPaused] = useState(false);

  // Scale and fade cards by their distance from the centre, like the Compose pager
  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    const centre = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const dist = Math.abs(c.offsetLeft + c.offsetWidth / 2 - centre);
      c.style.setProperty('--d', String(Math.min(1, dist / c.offsetWidth)));
      if (dist < bestDist) (bestDist = dist), (best = i);
    });
    setPage(best);
  };

  useEffect(onScroll, [items]);

  const goTo = (i: number) => {
    const el = ref.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (el && card) el.scrollTo({ left: card.offsetLeft - (el.clientWidth - card.offsetWidth) / 2, behavior: 'smooth' });
  };

  // Gentle auto-advance; pauses while hovered, touched or the tab is hidden
  useEffect(() => {
    if (paused || items.length < 2) return;
    const t = window.setInterval(() => {
      if (!document.hidden) goTo((page + 1) % items.length);
    }, 6000);
    return () => clearInterval(t);
  }, [paused, page, items.length]);

  if (items.length === 0) return null;
  return (
    <section aria-label="Spotlight">
      <div
        ref={ref}
        className="hero"
        onScroll={onScroll}
        onPointerEnter={() => setPaused(true)}
        onPointerLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setTimeout(() => setPaused(false), 4000)}
      >
        {items.map((item) => {
          const { channel, movie } = item;
          const tags: string[] = [];
          if (channel) {
            tags.push(flagOf(channel.c), ...channel.g.slice(0, 2).map(categoryLabel));
            const q = qualityBadge(bestQuality(channel));
            if (q) tags.push(q);
          }
          if (movie) {
            if (movie.y) tags.push(String(movie.y));
            const r = runtimeLabel(movie);
            if (r) tags.push(r);
            tags.push(...(movie.g ?? []).slice(0, 2).map(capitalize));
          }
          const isSaved = saved(item);
          return (
            <div
              key={item.key}
              className="hero-card"
              style={{ background: gradient(colorsOf(item.colors, item.key)) }}
              onClick={() => onOpen(item)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && e.target === e.currentTarget && onOpen(item)}
              aria-label={item.title}
            >
              {movie && (movie.p || movie.b) && <img className="poster-art" src={movie.p ?? movie.b} alt="" decoding="async" />}
              {channel && (
                <>
                  {!lightweight && channel.l && <img className="wash" src={channel.l} alt="" referrerPolicy="no-referrer" decoding="async" />}
                  <ChannelLogo channel={channel} lazy={false} />
                </>
              )}
              <div className="scrim" />
              <div className="badges">
                {channel ? <LivePill /> : <Pill tone="lime">ON DEMAND</Pill>}
                {item.pill && <Pill>{item.pill}</Pill>}
              </div>
              <div className="info">
                <h2 className="display">{item.title}</h2>
                <div className="tags">{tags.join('  •  ')}</div>
                <div className="actions">
                  <button
                    className="btn white press"
                    onClick={(e) => {
                      e.stopPropagation();
                      onPlay(item);
                    }}
                  >
                    <Play size={20} fill="currentColor" /> {movie ? 'Play movie' : 'Watch now'}
                  </button>
                  <button
                    className="icon-btn add press"
                    aria-label={isSaved ? 'Remove from My List' : 'Add to My List'}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleList(item);
                    }}
                  >
                    {isSaved ? <Check /> : <Plus />}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="dots">
        {items.map((it, i) => (
          <button key={it.key} className={i === page ? 'on' : ''} onClick={() => goTo(i)} aria-label={`Slide ${i + 1}`} />
        ))}
      </div>
    </section>
  );
}
