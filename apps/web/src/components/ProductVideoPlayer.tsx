"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toEmbeddableVideoUrl, youtubeVideoId } from "@/lib/media";

/**
 * The product video with our own controls instead of YouTube's chrome.
 *
 * What is and is not removable, because it is worth being straight about:
 * YouTube's embed used to accept `showinfo=0` and `modestbranding=1` to drop
 * the title bar and the watermark. Both are retired — `showinfo` was removed
 * outright and `modestbranding` is now a no-op. No parameter hides the title,
 * the channel avatar or the YouTube wordmark, and stripping them by other
 * means is against YouTube's terms.
 *
 * `controls=0` does still work and removes the whole bottom bar. On its own
 * that is too blunt: it takes pause, mute and the progress line with it. So
 * the player is driven through YouTube's IFrame API and the controls that
 * actually matter are rebuilt here — play/pause, mute, and a seekable
 * progress line — without the captions button, the fullscreen button, the
 * channel avatar or the wordmark.
 *
 * Nothing loads until the viewer presses play. A YouTube iframe pulls roughly
 * a megabyte of player JS; until then this costs one poster image, and no
 * YouTube cookie is set (nocookie host).
 */

interface YouTubePlayer {
  playVideo(): void;
  pauseVideo(): void;
  mute(): void;
  unMute(): void;
  isMuted(): boolean;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  /** 1 = playing, 2 = paused, 3 = buffering, 0 = ended, -1 = unstarted. */
  getPlayerState(): number;
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars: Record<string, string | number>;
      events: {
        onReady?: (e: { target: YouTubePlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
      };
    },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

// One script tag and one promise for the whole page, however many players
// mount. `onYouTubeIframeAPIReady` is a single global the API calls exactly
// once, so a second component must not overwrite it.
let apiPromise: Promise<YouTubeApi> | null = null;

function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<YouTubeApi>((resolve) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT as YouTubeApi);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(script);
  });
  return apiPromise;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ProductVideoPlayer({ videoUrl }: { videoUrl: string }) {
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [posterFailed, setPosterFailed] = useState(false);
  // While the viewer drags the progress line, stop the ticker overwriting the
  // handle position under their finger.
  const [scrubbing, setScrubbing] = useState(false);

  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YouTubePlayer | null>(null);

  const id = youtubeVideoId(videoUrl);
  const embed = toEmbeddableVideoUrl(videoUrl);

  useEffect(() => {
    if (!started || !id || !mountRef.current) return;
    let cancelled = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    void loadYouTubeApi().then((YT) => {
      if (cancelled || !mountRef.current) return;
      playerRef.current = new YT.Player(mountRef.current, {
        videoId: id,
        host: "https://www.youtube-nocookie.com",
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          iv_load_policy: 3,
          playsinline: 1,
          modestbranding: 1,
          disablekb: 1,
          // Without this the API posts to the nocookie origin and the browser
          // logs a postMessage origin mismatch on every message.
          origin: window.location.origin,
        },
        events: {
          // The ticker starts HERE, not right after the constructor. A
          // YT.Player is not usable the moment `new` returns — its methods
          // are attached when the API finishes wiring the iframe, so polling
          // any earlier threw "p.getDuration is not a function" several times
          // per second until it caught up.
          onReady: (e) => {
            setDuration(e.target.getDuration());
            setMuted(e.target.isMuted());
            ticker = setInterval(() => {
              const p = playerRef.current;
              if (!p || typeof p.getDuration !== "function") return;
              const d = p.getDuration();
              if (d) setDuration((prev) => (prev === d ? prev : d));
              setCurrent((prev) => (scrubbing ? prev : p.getCurrentTime()));
              // Polled, not left to onStateChange alone. Measured: the
              // playhead advanced while onStateChange never delivered a
              // "playing" event, so the cover stayed up and the video ran
              // behind the poster with no way to pause it. getPlayerState is
              // read straight off the player and cannot be missed.
              if (typeof p.getPlayerState === "function") {
                const state = p.getPlayerState();
                setPlaying((prev) => (state === 1) === prev ? prev : state === 1);
              }
            }, 250);
          },
          // 1 = playing, 2 = paused, 0 = ended
          onStateChange: (e) => {
            if (e.data === 1) setPlaying(true);
            if (e.data === 2) setPlaying(false);
            if (e.data === 0) setPlaying(false);
          },
        },
      });
    });

    return () => {
      cancelled = true;
      if (ticker) clearInterval(ticker);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // Deliberately only re-runs when playback is first started or the video
    // changes — `scrubbing` is read inside the ticker, not a dependency, or
    // every drag would tear the player down mid-video.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, id]);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (p.isMuted()) {
      p.unMute();
      setMuted(false);
    } else {
      p.mute();
      setMuted(true);
    }
  }, []);

  if (!embed) return null;

  // Anything that is not YouTube keeps the previous plain-iframe behaviour —
  // the params and the API above are YouTube's, and guessing at another
  // host's would be worse than leaving it alone.
  if (!id) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
        <iframe
          src={embed}
          title="Product video"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          className="h-full w-full"
        />
      </div>
    );
  }

  const poster = posterFailed
    ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
    : `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      {/* Mounted (and left mounted) from the first play onward. YT.Player
          REPLACES this node with its iframe, so it must stay a bare div. */}
      {started && <div ref={mountRef} className="h-full w-full" />}

      {/* The cover, and the whole answer to "hide the video title".
          `controls=0` hides YouTube's chrome WHILE PLAYING, but the moment the
          player is unstarted or paused it draws its own title card — title,
          channel avatar, big red play button — inside the iframe. A
          transparent overlay cannot help: the title is painted by YouTube, not
          by us, so blocking clicks leaves it perfectly visible.
          So whenever the player is not actually playing, an OPAQUE poster
          covers the frame. The iframe is only ever seen while it is playing,
          which is exactly when YouTube shows nothing. */}
      {!playing && (
        <button
          type="button"
          onClick={() => (started ? togglePlay() : setStarted(true))}
          aria-label="Play video"
          className="group absolute inset-0 h-full w-full cursor-pointer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={poster}
            alt=""
            onError={() => setPosterFailed(true)}
            className="h-full w-full object-cover"
          />
          <span className="absolute inset-0 bg-black/10 transition-colors group-hover:bg-black/20" />
          {/* 44px, not the 64px this started at — that read as a splash
              screen over a small card. 44 is still at the accessible tap
              target size, so nothing is lost on a phone. */}
          <span className="absolute left-1/2 top-1/2 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/95 shadow-lg transition-transform duration-150 group-hover:scale-110">
            <svg viewBox="0 0 24 24" width="18" height="18" className="ml-0.5 fill-green">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}

      {/* While PLAYING the iframe is on screen and tappable, and a tap makes
          YouTube draw its own layer over the video: the title, the channel
          name, a big centre play/pause button and the wordmark. This
          transparent sheet takes that tap first, so none of it ever appears —
          and the tap still does the obvious thing, because it toggles
          playback itself. Stops short of the control bar so the real controls
          stay clickable. */}
      {playing && (
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Pause video"
          tabIndex={-1}
          className="absolute inset-x-0 top-0 bottom-12 w-full cursor-pointer bg-transparent"
        />
      )}

      {started && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/75 to-transparent px-3 pb-2 pt-6">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause video" : "Play video"}
            className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/90 text-ink transition-transform hover:scale-105"
          >
            {playing ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          <span className="flex-none font-ui text-[11px] tabular-nums text-white/90">
            {formatTime(current)} / {formatTime(duration)}
          </span>

          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            aria-label="Seek"
            onMouseDown={() => setScrubbing(true)}
            onTouchStart={() => setScrubbing(true)}
            onChange={(e) => {
              const pct = Number(e.target.value);
              setCurrent((duration * pct) / 100);
            }}
            onMouseUp={(e) => {
              playerRef.current?.seekTo((duration * Number(e.currentTarget.value)) / 100, true);
              setScrubbing(false);
            }}
            onTouchEnd={(e) => {
              playerRef.current?.seekTo((duration * Number(e.currentTarget.value)) / 100, true);
              setScrubbing(false);
            }}
            className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/30 accent-green"
            style={{
              background: `linear-gradient(to right, #ffffff ${progress}%, rgba(255,255,255,0.3) ${progress}%)`,
            }}
          />

          <button
            type="button"
            onClick={toggleMute}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="grid h-8 w-8 flex-none place-items-center rounded-full bg-white/20 text-white transition-colors hover:bg-white/30"
          >
            {muted ? (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
                <path d="M17 9l4 6M21 9l-4 6" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor" stroke="none" />
                <path d="M16 9a4 4 0 0 1 0 6" />
                <path d="M19 6.5a8 8 0 0 1 0 11" />
              </svg>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
