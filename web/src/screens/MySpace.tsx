import { Smartphone } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../context';
import { activeProfile, clearRecents, prefs as prefsStore, setHideUnreliable, settings, useStore } from '../data/store';
import { MoviePoster, PosterCard, ProfileAvatar, Rail, Toggle } from '../ui/components';
import { liveQueue, WatchableWide } from './Home';
import { resolveKeys } from './resolve';

const RELEASES = 'https://github.com/kwamepeace/kinowave/releases/latest';

export function MySpaceScreen({ onEditProfile }: { onEditProfile: () => void }) {
  const { index, appOnly, actions, refresh } = useApp();
  const profile = useStore(activeProfile);
  const prefs = useStore(prefsStore);
  const s = useStore(settings);
  const [refreshing, setRefreshing] = useState(false);
  const saved = resolveKeys(index, prefs.myList, prefs);
  const watched = resolveKeys(index, prefs.recents, prefs);

  return (
    <div className="screen">
      <div className="pad head-pad" style={{ display: 'flex', alignItems: 'center', gap: 14, paddingBottom: 4 }}>
        {profile && <ProfileAvatar profile={profile} size={60} onClick={onEditProfile} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="display page-title">{profile?.name ?? 'My Space'}</h1>
          <div className="low" style={{ fontSize: 13 }}>
            {saved.length} saved · {watched.length} watched{index.isKids ? ' · Kids' : ''}
          </div>
        </div>
        <button className="btn outline press" style={{ padding: '10px 16px' }} onClick={() => activeProfile.set(null)}>
          Switch
        </button>
      </div>

      {watched.length > 0 && (
        <>
          <div className="title-row">
            <h2 className="grid-title">Recently watched</h2>
            <button className="link press" onClick={clearRecents}>
              Clear
            </button>
          </div>
          <Rail>
            {watched.map((it) => (
              <WatchableWide key={it.key} item={it} queue={watched} />
            ))}
          </Rail>
        </>
      )}

      <div className="title-row">
        <h2 className="grid-title">My List</h2>
      </div>
      {saved.length === 0 ? (
        <p className="empty-card">Nothing saved yet. Tap + on any channel or movie to keep it here. ✨</p>
      ) : (
        <div className="grid">
          {saved.map((it) =>
            it.kind === 'live' ? (
              <PosterCard
                key={it.key}
                channel={it.channel}
                fluid
                flag={index.countryFlag(it.channel.c)}
                onOpen={() => actions.open(it.channel)}
                onPlay={() => actions.play(it.channel, liveQueue(saved))}
              />
            ) : (
              <MoviePoster key={it.key} movie={it.movie} fluid progress={it.progress} onOpen={() => actions.openMovie(it.movie)} onPlay={() => actions.playMovie(it.movie)} />
            ),
          )}
        </div>
      )}

      <div className="title-row">
        <h2 className="grid-title">Playback</h2>
      </div>
      <div className="settings-card">
        <Toggle
          title="Data saver"
          subtitle="Cap video around 480p, use lighter movie files and skip heavy effects."
          checked={s.dataSaver}
          onChange={(v) => settings.set({ ...s, dataSaver: v })}
        />
        {s.dataSaver && (
          <Toggle
            title="Only on mobile data"
            subtitle="Full quality on Wi-Fi, data saver on mobile data (where the browser can tell)."
            checked={s.saverOnMobileOnly}
            onChange={(v) => settings.set({ ...s, saverOnMobileOnly: v })}
          />
        )}
        <hr />
        <Toggle
          title="Autoplay next channel"
          subtitle="If a channel won't load, hop to the next one after a few seconds."
          checked={s.autoplayNext}
          onChange={(v) => settings.set({ ...s, autoplayNext: v })}
        />
        <Toggle
          title="Hide unreliable channels"
          subtitle="Skip channels that are geo-locked or only on air part-time."
          checked={prefs.hideUnreliable}
          onChange={setHideUnreliable}
        />
      </div>

      <div className="title-row">
        <h2 className="grid-title">Library</h2>
      </div>
      <div className="settings-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700 }}>Channels and movies</div>
            <div className="low" style={{ fontSize: 12 }}>
              {index.channels.length.toLocaleString()} channels · {index.movies.length} movies · updated {index.catalog.updated.slice(0, 10)}
            </div>
          </div>
          <button
            className="btn brand press"
            style={{ padding: '9px 16px', minWidth: 96 }}
            disabled={refreshing}
            onClick={async () => {
              setRefreshing(true);
              const updated = await refresh().catch(() => false);
              setRefreshing(false);
              actions.toast(updated ? 'Library updated 🎉' : "You're already up to date");
            }}
          >
            {refreshing ? <span className="spinner" style={{ width: 18, height: 18, margin: 0, borderWidth: 2 }} /> : 'Refresh'}
          </button>
        </div>
        {appOnly > 0 && !index.isKids && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Smartphone size={22} style={{ flex: 'none' }} />
            <div style={{ flex: 1, fontSize: 13 }} className="muted">
              {appOnly.toLocaleString()} more channels only stream over plain http, which browsers block on secure pages. They play in the Android app.
            </div>
            <a className="btn outline press" style={{ padding: '9px 16px', textDecoration: 'none' }} href={RELEASES} target="_blank" rel="noreferrer">
              Get the app
            </a>
          </div>
        )}
        <p className="low" style={{ fontSize: 12 }}>
          KinoWave for the web · Live channels come from the open-source iptv-org project (github.com/iptv-org/iptv); movies come from the
          Internet Archive&apos;s public-domain collection. KinoWave doesn&apos;t host or own any of the content.
        </p>
      </div>
    </div>
  );
}
