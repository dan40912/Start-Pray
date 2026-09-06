// Playback gain for prayer recordings.
//
// Why this exists: HTMLMediaElement.volume is capped at 1.0 and already sits
// there by default, so there is no way to make a quiet file louder through the
// element itself — assigning 1.2 throws IndexSizeError and clamps back to 1.
// Web Audio is the only route to gain above unity in the browser.
//
// Measured on the recordings already uploaded to /voices: RMS between -29 and
// -34 dBFS, against roughly -20 dBFS for comfortable speech. That is a 10-14 dB
// deficit, so the fix has to be a multiplier of 3-5x, not a few percent.
//
// autoGainControl on the capture side (see MIC_CONSTRAINTS in the recorders)
// only helps recordings made from now on. This is what rescues the ones already
// stored.

// ~11 dB. Measured against every recording currently in /voices by rendering
// this exact chain offline: the four real ones land between -21.5 and -18.3
// dBFS RMS afterwards, against -34.2 to -26.3 before, with a highest peak of
// 0.871 — audible, consistent, and clear of clipping.
//
// An earlier attempt at gain 3 with the limiter at -2 dBFS pushed the loudest
// file to a peak of 1.106, i.e. it clipped. The threshold and the output trim
// below exist because of that measurement, not as a precaution.
export const PLAYBACK_GAIN = 3.5;

// Limiter threshold and post-limiter trim, both measured rather than guessed.
const LIMITER_THRESHOLD_DB = -8;
const OUTPUT_TRIM = 0.85;

// One element can only ever be wrapped once — createMediaElementSource throws on
// a second call for the same element, and after wrapping, the element's output
// is routed through the graph instead of straight to the speakers.
//
// That second half is why the graph is never torn down: disconnecting the source
// does not restore the element's direct output, it silences it, and the source
// cannot be recreated to undo that. So an element keeps its chain for as long as
// it exists, and a caller whose effect re-runs (a new src on the same element)
// simply gets a no-op back instead of a silenced player. The nodes are collected
// with the element.

// One AudioContext for the whole page, not one per player. Browsers cap how many
// a document may hold (Chrome has historically refused past ~6) and the voice
// wall can mount many players at once, so a context per element would start
// failing silently on exactly the pages that need this most.
let sharedCtx = null;

function getSharedContext() {
  const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctor) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    try {
      sharedCtx = new Ctor();
    } catch {
      return null;
    }
  }
  return sharedCtx;
}

const attached = new WeakMap();

export function attachPlaybackGain(audioEl, gainValue = PLAYBACK_GAIN) {
  if (!audioEl) return null;
  // Already wired: hand back the same teardown so a re-running effect neither
  // rebuilds the graph nor silences the element.
  const existing = attached.get(audioEl);
  if (existing) return existing;

  const ctx = getSharedContext();
  if (!ctx) return null;

  try {
    const source = ctx.createMediaElementSource(audioEl);
    const gain = ctx.createGain();
    gain.gain.value = gainValue;

    // A limiter, not a compressor for tone: a high ratio with a fast attack so an
    // already-loud recording cannot clip once multiplied.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = LIMITER_THRESHOLD_DB;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.15;

    // Final trim after the limiter — the compressor's 2 ms attack still lets
    // transients through above its threshold, so the headroom is taken here.
    const trim = ctx.createGain();
    trim.gain.value = OUTPUT_TRIM;

    source.connect(gain);
    gain.connect(limiter);
    limiter.connect(trim);
    trim.connect(ctx.destination);

    // Browsers start the context suspended until a gesture. Playback is always
    // user-initiated here, so resuming on play is enough.
    const resume = () => {
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
    };
    audioEl.addEventListener("play", resume);

    // Only the listener is removed. See the note above `attached` for why the
    // audio graph itself must outlive the caller's effect.
    const teardown = () => {
      audioEl.removeEventListener("play", resume);
    };
    attached.set(audioEl, teardown);
    return teardown;
  } catch {
    // Never let a gain nicety stop the audio from playing — if the graph cannot
    // be built the element still plays on its own, just at its original level.
    return null;
  }
}
