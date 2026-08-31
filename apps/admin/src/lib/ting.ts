"use client";

/**
 * A short "ting", synthesised rather than shipped as an audio file.
 *
 * Two decaying sine partials (988Hz + its octave) through a gain envelope —
 * a bell is close enough to that for the four hundred bytes it costs, and it
 * avoids adding a binary asset that has to be hosted, cached and kept in the
 * repo forever.
 */
export function ting() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    // Browsers start the context suspended until a user gesture. An admin has
    // invariably clicked something by the time a poll fires, but resume() is
    // cheap insurance and silently no-ops when it is already running.
    void ctx.resume?.();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
    gain.connect(ctx.destination);

    for (const [freq, level] of [
      [988, 1],
      [1976, 0.35],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now);
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, now);
      osc.connect(g).connect(gain);
      osc.start(now);
      osc.stop(now + 1.2);
    }
    // Free the hardware context rather than leaking one per ring.
    setTimeout(() => void ctx.close?.(), 1500);
  } catch {
    // Audio is a nicety. A blocked or unsupported context must never break
    // the admin shell it is mounted in.
  }
}

