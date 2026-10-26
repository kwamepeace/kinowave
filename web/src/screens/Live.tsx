import { Info, Play } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '../context';
import { prefs as prefsStore, useStore } from '../data/store';
import { bestQuality, categoryLabel, isGeoBlocked, isPartTime, isUnreliable, qualityBadge, type Channel } from '../data/types';
import { ChannelLogo, Chip, Pill, Rail, useIncremental } from '../ui/components';

const LIVE_CATEGORIES: (string | null)[] = [null, 'news', 'sports', 'movies', 'entertainment', 'music', 'kids', 'documentary', 'series', 'general', 'religious'];

let lastCountry: string | null = null;
let lastCategory: string | null = null;

/** Channel guide: pick a country and a category, tap to zap straight into the player. */
export function LiveScreen() {
  const { index, region, actions } = useApp();
  const { hideUnreliable } = useStore(prefsStore);
  const countries = useMemo(() => {
    const codes = index.countryCounts.map(([c]) => c);
    return ['ALL', ...(codes.includes(region) ? [region, ...codes.filter((c) => c !== region)] : codes).slice(0, 80)];
  }, [index, region]);
  const [country, setCountry] = useState(lastCountry ?? (countries.includes(region) ? region : 'ALL'));
  const [category, setCategory] = useState<string | null>(lastCategory);
  lastCountry = country;
  lastCategory = category;

  const list = useMemo(() => {
    const base = country === 'ALL' ? index.channels : index.byCountry(country);
    const byCat = category ? base.filter((c) => c.g.includes(category)) : base;
    return hideUnreliable ? byCat.filter((c) => !isUnreliable(c)) : byCat;
  }, [index, country, category, hideUnreliable]);
  const [shown, sentinel] = useIncremental(list);

  const pick = (fn: () => void) => {
    fn();
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="screen">
      <div className="pad head-pad" style={{ display: 'flex', alignItems: 'flex-end' }}>
        <h1 className="display page-title" style={{ flex: 1 }}>
          Live TV
        </h1>
        <span className="low" style={{ fontSize: 12, fontWeight: 700 }}>
          {list.length.toLocaleString()} channels
        </span>
      </div>
      <div style={{ marginTop: 12 }}>
        <Rail tight>
          {countries.map((code) =>
            code === 'ALL' ? (
              <Chip key={code} label="Worldwide" leading="🌍" selected={country === code} onClick={() => pick(() => setCountry(code))} />
            ) : (
              <Chip
                key={code}
                label={index.countryName(code)}
                leading={index.countryFlag(code)}
                selected={country === code}
                onClick={() => pick(() => setCountry(code))}
              />
            ),
          )}
        </Rail>
        <div style={{ height: 8 }} />
        <Rail tight>
          {LIVE_CATEGORIES.map((c) => (
            <Chip key={c ?? 'all'} label={c ? categoryLabel(c) : 'Everything'} selected={category === c} onClick={() => pick(() => setCategory(c))} />
          ))}
        </Rail>
      </div>

      <div className="channel-list" style={{ marginTop: 8 }}>
        {shown.map((ch) => (
          <ChannelListItem
            key={ch.id}
            channel={ch}
            subtitle={`${index.countryFlag(ch.c)}  ${ch.g.slice(0, 2).map(categoryLabel).join(' · ') || index.countryName(ch.c)}`}
            onPlay={() => actions.play(ch, list)}
            onInfo={() => actions.open(ch)}
          />
        ))}
      </div>
      {sentinel}
    </div>
  );
}

export function ChannelListItem({ channel, subtitle, onPlay, onInfo }: { channel: Channel; subtitle: string; onPlay: () => void; onInfo: () => void }) {
  const q = qualityBadge(bestQuality(channel));
  return (
    <div className="channel-item">
      <button className="press" onClick={onPlay} style={{ display: 'contents' }} aria-label={`Play ${channel.n}`}>
        <ChannelLogo channel={channel} />
        <span className="meta">
          <span className="n" style={{ display: 'block' }}>
            {channel.n}
          </span>
          <span className="s" style={{ display: 'block' }}>
            {subtitle}
          </span>
          {(isGeoBlocked(channel) || isPartTime(channel)) && (
            <span className="flags">
              {isGeoBlocked(channel) && <Pill tone="geo">GEO-LOCKED</Pill>}
              {isPartTime(channel) && <Pill tone="part">PART-TIME</Pill>}
            </span>
          )}
        </span>
        {q && <Pill tone="soft">{q}</Pill>}
      </button>
      <button className="info" onClick={onInfo} aria-label={`About ${channel.n}`}>
        <Info size={20} />
      </button>
      <button className="go press" onClick={onPlay} aria-label={`Play ${channel.n}`} tabIndex={-1}>
        <Play size={20} fill="currentColor" />
      </button>
    </div>
  );
}
