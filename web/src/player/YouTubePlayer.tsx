import { ArrowLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { addWatchTime, markWatched, positionOf, savePosition } from '../data/store';
import { movieKey, sourceLabel, type Movie } from '../data/types';

// Minimal typing for the YouTube IFrame API we use
interface YTPlayer {
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  destroy(): void;
}
interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width: string;
      height: string;
      playerVars: Record<string, number | string>;
      events: { onReady?: () => void; onStateChange?: (e: { data: number }) => void; onError?: () => void };
    },
  ) => YTPlayer;
}
declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  return (apiPromise ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.onerror = reject;
    document.head.appendChild(s);
  }));
}

const PLAYING = 1;
const ENDED = 0;

/**
 * Plays a studio's free film inside YouTube's official embedded player (as YouTube's terms require:
 * YouTube's own controls and ads stay intact). Resume points and watch time work like other films.
 */
export function YouTubePlayer({ movie, fromStart, onClose }: { movie: Movie; fromStart: boolean; onClose: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chrome, setChrome] = useState(true);
  const lastTime = useRef(0);

  useEffect(() => {
    const el = host.current;
    if (!el || !movie.yt) return;
    markWatched(movieKey(movie));
    let player: YTPlayer | null = null;
    let disposed = false;
    const save = () => {
      if (!player) return;
      const d = player.getDuration?.() ?? 0;
      lastTime.current = player.getCurrentTime?.() ?? lastTime.current;
      if (d > 0) savePosition(movie.id, lastTime.current * 1000, d * 1000);
    };
    loadYouTubeApi()
      .then((YT) => {
        if (disposed) return;
        const mount = document.createElement('div');
        el.appendChild(mount);
        player = new YT.Player(mount, {
          videoId: movie.yt!,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 1,
            rel: 0,
            iv_load_policy: 3,
            cc_load_policy: 1,
            playsinline: 1,
            start: fromStart ? 0 : Math.floor(positionOf(movie.id) / 1000),
          },
          events: {
            onReady: () => setReady(true),
            onStateChange: (e) => {
              if (e.data === ENDED) {
                save();
                onClose();
              }
            },
            onError: () => setFailed(true),
          },
        });
      })
      .catch(() => setFailed(true));

    // Watch-time signal for For You, and periodic resume points
    const t = window.setInterval(() => {
      if (player?.getPlayerState?.() === PLAYING) addWatchTime(movieKey(movie), 15);
      save();
    }, 15_000);
    window.addEventListener('pagehide', save);
    return () => {
      disposed = true;
      save();
      clearInterval(t);
      window.removeEventListener('pagehide', save);
      player?.destroy();
    };
  }, [movie, fromStart, onClose]);

  // Brief title bar; YouTube's own controls take over once playback starts
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => setChrome(false), 4000);
    return () => clearTimeout(t);
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (e.stopPropagation(), onClose());
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="player" style={{ touchAction: 'auto' }} onPointerMove={() => setChrome(true)}>
      <div ref={host} className="yt" style={{ display: 'grid' }} />
      {!ready && !failed && (
        <div className="status" style={{ background: '#000' }}>
          <div className="spinner" />
        </div>
      )}
      {failed ? (
        <div className="status">
          <div className="inner">
            <h3>This movie can&apos;t play inside KinoWave</h3>
            <p>The studio only allows it on YouTube itself.</p>
            <div className="row">
              <button className="btn glass press" onClick={onClose}>
                Back
              </button>
              <a
                className="btn brand press"
                style={{ textDecoration: 'none', pointerEvents: 'auto' }}
                href={`https://www.youtube.com/watch?v=${movie.yt}&t=${Math.floor(lastTime.current)}s`}
                target="_blank"
                rel="noreferrer"
              >
                Open in YouTube
              </a>
            </div>
          </div>
        </div>
      ) : (
        <div className={`chrome ${chrome ? '' : 'hidden'}`} style={{ inset: '0 0 auto', height: 100 }}>
          <div className="bar" style={{ pointerEvents: 'auto' }}>
            <button className="icon-btn glass press" onClick={onClose} aria-label="Back">
              <ArrowLeft />
            </button>
            <div className="who">
              <div style={{ minWidth: 0 }}>
                <div className="title">
                  <b>{movie.t}</b>
                </div>
                <div className="sub">{sourceLabel(movie)}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
