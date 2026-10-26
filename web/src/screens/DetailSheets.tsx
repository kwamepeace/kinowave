import { Check, Play, Plus, RotateCcw, Share2 } from 'lucide-react';
import { useMemo } from 'react';
import { useApp } from '../context';
import { prefs as prefsStore, progressFraction, toggleMyList, useStore } from '../data/store';
import {
  bestQuality,
  capitalize,
  categoryLabel,
  gradient,
  isGeoBlocked,
  isPartTime,
  movieKey,
  qualityBadge,
  runtimeLabel,
  seedColors,
  shareUrlOf,
  sourceLabel,
  type Channel,
  type Movie,
} from '../data/types';
import { shareLink } from '../nav';
import { ChannelLogo, MoviePoster, Pill, PosterCard, ProgressBar, Rail, SectionHeader } from '../ui/components';
import { Sheet } from '../ui/Sheet';

async function share(title: string, text: string, url: string, toast: (t: string) => void) {
  try {
    if (navigator.share) await navigator.share({ title, text, url });
    else {
      await navigator.clipboard.writeText(`${text} ${url}`);
      toast('Link copied 🔗');
    }
  } catch {
    /* share sheet dismissed */
  }
}

export function ChannelSheet({ channel, onClose }: { channel: Channel; onClose: () => void }) {
  const { index, actions } = useApp();
  const prefs = useStore(prefsStore);
  const saved = prefs.myList.includes(channel.id);
  const similar = useMemo(() => index.similarTo(channel), [index, channel]);
  const q = qualityBadge(bestQuality(channel));
  const meta = [`${index.countryFlag(channel.c)} ${index.countryName(channel.c)}`, ...(channel.la ?? []).slice(0, 2).map(index.languageName)];
  if (channel.nw) meta.push(channel.nw);

  return (
    <Sheet onClose={onClose} label={channel.n}>
      <div className="banner" style={{ background: gradient(seedColors(channel.id)) }}>
        {channel.l && <img className="wash" src={channel.l} alt="" referrerPolicy="no-referrer" />}
        <ChannelLogo channel={channel} lazy={false} />
        <div className="fade" />
      </div>
      <div className="sheet-body">
        <h1 className="display">{channel.n}</h1>
        <p className="meta-line">{meta.join('  •  ')}</p>
        <div className="pills">
          <Pill tone="lime">● LIVE</Pill>
          {q && <Pill tone="glass">{q}</Pill>}
          {channel.g.map((g) => (
            <Pill key={g} tone="glass">
              {categoryLabel(g)}
            </Pill>
          ))}
          {isGeoBlocked(channel) && <Pill tone="geo">GEO-LOCKED</Pill>}
          {isPartTime(channel) && <Pill tone="part">NOT 24/7</Pill>}
        </div>

        <button className="btn white block press" style={{ marginTop: 20 }} onClick={() => actions.play(channel, [channel, ...similar])}>
          <Play size={20} fill="currentColor" /> Watch live
        </button>
        <div className="sheet-actions">
          <button className="btn outline press" onClick={() => toggleMyList(channel.id)}>
            {saved ? <Check size={20} /> : <Plus size={20} />} {saved ? 'In My List' : 'My List'}
          </button>
          <button
            className="btn outline press"
            onClick={() => share(channel.n, `Watching ${channel.n} live on KinoWave 📺✨`, shareLink({ kind: 'channel', id: channel.id }), actions.toast)}
          >
            <Share2 size={20} /> Share
          </button>
        </div>

        {channel.s.length > 1 && (
          <div style={{ marginTop: 22 }}>
            <h2 className="section-title">Sources</h2>
            <p className="low" style={{ fontSize: 12 }}>
              If one doesn&apos;t load, try another.
            </p>
          </div>
        )}
      </div>
      {channel.s.length > 1 && (
        <div style={{ marginTop: 10 }}>
          <Rail tight>
            {channel.s.map((s, i) => {
              const sq = qualityBadge(s.q);
              return (
                <button key={s.u} className="chip press" style={{ color: 'var(--text-high)' }} onClick={() => actions.play(channel, [channel, ...similar], i)}>
                  Server {i + 1}
                  {sq ? ` · ${sq}` : ''}
                  {s.gb ? ' · 🔒' : ''}
                </button>
              );
            })}
          </Rail>
        </div>
      )}

      {similar.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionHeader title="More like this" emoji="✨" />
          <Rail>
            {similar.map((ch) => (
              <PosterCard key={ch.id} channel={ch} flag={index.countryFlag(ch.c)} onOpen={() => actions.open(ch)} onPlay={() => actions.play(ch, similar)} />
            ))}
          </Rail>
        </div>
      )}
    </Sheet>
  );
}

export function MovieSheet({ movie, onClose }: { movie: Movie; onClose: () => void }) {
  const { index, actions } = useApp();
  const prefs = useStore(prefsStore);
  const saved = prefs.myList.includes(movieKey(movie));
  const progress = progressFraction(prefs, movie.id);
  const similar = useMemo(() => index.similarMovies(movie), [index, movie]);
  const meta = [movie.y && String(movie.y), runtimeLabel(movie), sourceLabel(movie)].filter(Boolean);

  return (
    <Sheet onClose={onClose} label={movie.t}>
      {/* Backdrop: a frame from the film, with the poster overlapping it */}
      <div className="backdrop-art" style={{ background: gradient(seedColors(movie.id)) }}>
        {(movie.b || movie.p) && <img src={movie.b ?? movie.p} alt="" />}
      </div>
      <div className="movie-head">
        <MoviePoster movie={movie} onOpen={() => actions.playMovie(movie)} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="display">{movie.t}</h1>
          <p className="meta-line" style={{ marginTop: 4 }}>
            {meta.join('  •  ')}
          </p>
        </div>
      </div>
      <div className="sheet-body" style={{ marginTop: 16 }}>
        <div className="pills" style={{ marginTop: 0 }}>
          <Pill tone="lime">ON DEMAND</Pill>
          {(movie.g ?? []).map((t) => (
            <Pill key={t} tone="glass">
              {capitalize(t)}
            </Pill>
          ))}
        </div>
        <button className="btn white block press" style={{ marginTop: 18 }} onClick={() => actions.playMovie(movie)}>
          <Play size={20} fill="currentColor" /> {progress !== undefined ? 'Resume' : 'Play'}
        </button>
        {progress !== undefined && (
          <div style={{ marginTop: 10 }}>
            <ProgressBar value={progress} />
          </div>
        )}
        <div className="sheet-actions">
          <button className="btn outline press" onClick={() => toggleMyList(movieKey(movie))}>
            {saved ? <Check size={20} /> : <Plus size={20} />} {saved ? 'In My List' : 'My List'}
          </button>
          {progress !== undefined ? (
            <button className="btn outline press" onClick={() => actions.playMovie(movie, true)}>
              <RotateCcw size={20} /> Start over
            </button>
          ) : (
            <button
              className="btn outline press"
              onClick={() =>
                share(movie.t, `Watching ${movie.t} (${movie.y ?? 'classic'}) free on KinoWave 🍿`, shareLink({ kind: 'movie', id: movie.id }), actions.toast)
              }
            >
              <Share2 size={20} /> Share
            </button>
          )}
        </div>
        {movie.d && <p className="description">{movie.d}</p>}
        <p className="low" style={{ fontSize: 12, marginTop: 10 }}>
          {movie.yt ? (
            `Published free by ${movie.g?.[0] ?? 'the studio'} on its official YouTube channel.`
          ) : (
            <>
              From the Internet Archive&apos;s{' '}
              <a href={shareUrlOf(movie)} target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
                public-domain film collection
              </a>
              .
            </>
          )}
        </p>
      </div>

      {similar.length > 0 && (
        <div style={{ marginTop: 26 }}>
          <SectionHeader title="More like this" emoji="✨" />
          <Rail>
            {similar.map((m) => (
              <MoviePoster key={m.id} movie={m} progress={progressFraction(prefs, m.id)} onOpen={() => actions.openMovie(m)} onPlay={() => actions.playMovie(m)} />
            ))}
          </Rail>
        </div>
      )}
    </Sheet>
  );
}
