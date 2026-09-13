// Decodes a finished recording and reports what is actually in it: how long
// the audio runs and how loud its loudest sample is.
//
// Both recorders need this because neither the on-screen timer nor the blob's
// size says whether sound was captured. A microphone taken away mid-recording
// leaves the timer running and still produces a well-formed file.
//
// Returns null when the browser cannot decode the blob — a codec quirk is not
// evidence of a broken recording, so callers must not treat null as failure.
export async function analyzeRecording(blob) {
  const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctor || !blob) return null;
  let ctx = null;
  try {
    ctx = new Ctor();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    let peak = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const samples = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) {
        const value = Math.abs(samples[i]);
        if (value > peak) peak = value;
      }
    }
    return { durationSeconds: decoded.duration, peak };
  } catch {
    return null;
  } finally {
    try { await ctx?.close(); } catch { /* already closed */ }
  }
}
