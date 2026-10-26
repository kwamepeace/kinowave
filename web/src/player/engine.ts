import type Hls from 'hls.js';
import type { Channel } from '../data/types';

export type Phase = 'tuning' | 'playing' | 'failed';

/** Dead streams sometimes hang instead of erroring; move on if nothing plays in time. */
const TUNE_TIMEOUT_MS = 15_000;

let hlsModule: Promise<typeof import('hls.js')> | null = null;
const loadHls = () => (hlsModule ??= import('hls.js'));

/**
 * Plays a live channel's sources into a <video>, falling back across them like PlayerActivity:
 * an extension-less URL is retried once as HLS, then the next server is tried, and when every
 * source fails the caller hears about it. hls.js is used wherever MSE exists; Safari on iOS
 * falls back to native HLS.
 */
export class LiveEngine {
  private hls: Hls | null = null;
  private watchdog = 0;
  private forcedHls = false;
  private channel: Channel | null = null;
  private streamIndex = 0;
  private generation = 0;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly events: {
      onPhase: (p: Phase) => void;
      onStream: (index: number) => void;
      /** Max video height to allow, or 0 for no cap (data saver) */
      maxHeight: () => number;
    },
  ) {
    video.addEventListener('playing', this.onPlaying);
    video.addEventListener('error', this.onVideoError);
  }

  play(channel: Channel, streamIndex: number) {
    this.channel = channel;
    this.playStream(Math.min(Math.max(streamIndex, 0), Math.max(channel.s.length - 1, 0)), false);
  }

  retry() {
    if (this.channel) this.playStream(0, false);
  }

  /** Try the same channel's next source; when none are left, report failure. */
  nextSource(userInitiated: boolean) {
    const ch = this.channel;
    if (!ch) return;
    const stream = ch.s[this.streamIndex];
    // Extension-less URLs are often HLS anyway: retry once as HLS before giving up on the source
    if (!userInitiated && !this.forcedHls && stream && !/\.m3u8|\.mpd/i.test(stream.u)) {
      this.playStream(this.streamIndex, true);
      return;
    }
    const next = this.streamIndex + 1;
    if (next < ch.s.length) this.playStream(next, false);
    else if (userInitiated && ch.s.length > 1) this.playStream(0, false);
    else this.fail();
  }

  destroy() {
    this.generation++;
    clearTimeout(this.watchdog);
    this.video.removeEventListener('playing', this.onPlaying);
    this.video.removeEventListener('error', this.onVideoError);
    this.teardown();
  }

  private async playStream(index: number, forceHls: boolean) {
    const ch = this.channel;
    const stream = ch?.s[index];
    if (!ch || !stream) return this.fail();
    const gen = ++this.generation;
    this.streamIndex = index;
    this.forcedHls = forceHls;
    this.events.onStream(index);
    this.events.onPhase('tuning');
    this.teardown();

    clearTimeout(this.watchdog);
    this.watchdog = window.setTimeout(() => {
      if (gen === this.generation) this.nextSource(false);
    }, TUNE_TIMEOUT_MS);

    const url = stream.u;
    const isHls = forceHls || /\.m3u8/i.test(url);
    const video = this.video;
    if (!isHls) {
      video.src = url;
      video.play().catch(() => {});
      return;
    }

    const { default: HlsClass } = await loadHls();
    if (gen !== this.generation) return;
    if (HlsClass.isSupported()) {
      const hls = new HlsClass({
        capLevelToPlayerSize: true,
        manifestLoadingMaxRetry: 1,
        levelLoadingMaxRetry: 2,
        fragLoadingMaxRetry: 3,
        liveSyncDurationCount: 3,
        enableWorker: true,
      });
      this.hls = hls;
      hls.on(HlsClass.Events.MANIFEST_PARSED, (_e, data) => {
        const cap = this.events.maxHeight();
        if (cap > 0) {
          let best = -1;
          data.levels.forEach((l, i) => {
            if (l.height && l.height <= cap) best = i;
          });
          if (best >= 0) hls.autoLevelCapping = best;
        }
        video.play().catch(() => {});
      });
      let recovered = false;
      hls.on(HlsClass.Events.ERROR, (_e, data) => {
        if (!data.fatal || gen !== this.generation) return;
        if (data.type === HlsClass.ErrorTypes.MEDIA_ERROR && !recovered) {
          recovered = true;
          hls.recoverMediaError();
          return;
        }
        this.nextSource(false);
      });
      hls.loadSource(url);
      hls.attachMedia(video);
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.play().catch(() => {});
    } else {
      this.nextSource(false);
    }
  }

  private onPlaying = () => {
    clearTimeout(this.watchdog);
    this.events.onPhase('playing');
  };

  private onVideoError = () => {
    // hls.js reports its own errors; this covers native playback
    if (!this.hls && this.channel && this.video.getAttribute('src')) this.nextSource(false);
  };

  private fail() {
    clearTimeout(this.watchdog);
    this.teardown();
    this.events.onPhase('failed');
  }

  private teardown() {
    this.hls?.destroy();
    this.hls = null;
    this.video.removeAttribute('src');
    this.video.load();
  }
}
