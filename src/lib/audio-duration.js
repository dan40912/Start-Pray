// Server-side duration of an uploaded WebM recording, read from the container
// itself rather than trusted from the client.
//
// Why this exists: on 2026-09-13 two voice replies went live that held 0.18s
// and 0.6s of audio (3,059 and 301 bytes) although the recorder's on-screen
// timer had counted to 30 seconds — a client bug restarted the recorder every
// second, and nothing downstream measured the actual audio. The API only
// checked the 12 MB ceiling, so both were stored and published. The client is
// fixed; this keeps the next client bug from publishing silence again.
//
// MediaRecorder writes WebM as a live stream: the Segment and every Cluster
// have an "unknown" size and there is no Duration element. The only reliable
// length is the timestamp of the last block, so this walks the EBML elements
// and keeps the latest block time. Anything it cannot read returns null, and
// the caller treats null as "unknown", never as "too short".

const ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const ID_INFO = 0x1549a966;
const ID_TIMECODE_SCALE = 0x2ad7b1;
const ID_DURATION = 0x4489;
const ID_CLUSTER = 0x1f43b675;
const ID_CLUSTER_TIMECODE = 0xe7;
const ID_BLOCK_GROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_SIMPLE_BLOCK = 0xa3;

// Masters are entered rather than skipped, so their children are visited in the
// same linear pass. That is what makes unknown-size clusters readable at all.
const MASTER_IDS = new Set([ID_SEGMENT, ID_INFO, ID_CLUSTER, ID_BLOCK_GROUP]);

const DEFAULT_TIMECODE_SCALE_NS = 1_000_000;
// One Opus packet from Chrome spans 20-60 ms. The last block's timestamp marks
// where it starts, so its own length is added back, bounded so a large gap
// between the final two blocks cannot inflate the result.
const MAX_TRAILING_FRAME_MS = 120;

function readVint(buf, pos, keepMarker) {
  if (pos >= buf.length) return null;
  const first = buf[pos];
  if (first === 0) return null;
  let length = 1;
  let mask = 0x80;
  while (!(first & mask)) {
    mask >>= 1;
    length += 1;
  }
  if (pos + length > buf.length) return null;

  let value = keepMarker ? first : first & (mask - 1);
  let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < length; i += 1) {
    const byte = buf[pos + i];
    value = value * 256 + byte;
    if (byte !== 0xff) allOnes = false;
  }
  return { value, length, unknown: !keepMarker && allOnes };
}

function readUint(buf, start, size) {
  let value = 0;
  for (let i = 0; i < size; i += 1) value = value * 256 + buf[start + i];
  return value;
}

function readFloat(buf, start, size) {
  const view = new DataView(buf.buffer, buf.byteOffset + start, size);
  if (size === 4) return view.getFloat32(0);
  if (size === 8) return view.getFloat64(0);
  return null;
}

export function isWebmBuffer(buf) {
  return Boolean(buf && buf.length >= 4 && readUint(buf, 0, 4) === ID_EBML);
}

/**
 * @param {Uint8Array} buf the whole uploaded file
 * @returns {number|null} duration in seconds, or null when it cannot be read
 */
export function readWebmDurationSeconds(buf) {
  if (!isWebmBuffer(buf)) return null;

  let pos = 0;
  let timecodeScale = DEFAULT_TIMECODE_SCALE_NS;
  let declaredDuration = null;
  let clusterTimecode = 0;
  let lastBlockMs = null;
  let previousBlockMs = null;

  while (pos < buf.length) {
    const id = readVint(buf, pos, true);
    if (!id) break;
    const size = readVint(buf, pos + id.length, false);
    if (!size) break;
    const dataStart = pos + id.length + size.length;

    if (MASTER_IDS.has(id.value)) {
      pos = dataStart;
      continue;
    }
    // Only masters may have an unknown size; for anything else the rest of the
    // file cannot be located, so stop with what has been read so far.
    if (size.unknown) break;

    const dataEnd = dataStart + size.value;
    if (id.value === ID_TIMECODE_SCALE && dataEnd <= buf.length) {
      timecodeScale = readUint(buf, dataStart, size.value) || DEFAULT_TIMECODE_SCALE_NS;
    } else if (id.value === ID_DURATION && dataEnd <= buf.length) {
      declaredDuration = readFloat(buf, dataStart, size.value);
    } else if (id.value === ID_CLUSTER_TIMECODE && dataEnd <= buf.length) {
      clusterTimecode = readUint(buf, dataStart, size.value);
    } else if (id.value === ID_SIMPLE_BLOCK || id.value === ID_BLOCK) {
      // Block header: track number (vint), then a signed 16-bit offset from the
      // cluster timecode. A final block cut short still has a readable header.
      const track = readVint(buf, dataStart, false);
      const offsetAt = track ? dataStart + track.length : -1;
      if (track && offsetAt + 2 <= buf.length) {
        const relative = ((buf[offsetAt] << 24) >> 16) | buf[offsetAt + 1];
        const blockMs = clusterTimecode + relative;
        if (lastBlockMs === null || blockMs >= lastBlockMs) {
          previousBlockMs = lastBlockMs;
          lastBlockMs = blockMs;
        }
      }
    }
    pos = dataEnd;
  }

  const unitToSeconds = timecodeScale / 1e9;
  if (Number.isFinite(declaredDuration) && declaredDuration > 0) {
    return declaredDuration * unitToSeconds;
  }
  if (lastBlockMs === null) return null;

  const trailing = previousBlockMs === null
    ? 0
    : Math.min(Math.max(lastBlockMs - previousBlockMs, 0), MAX_TRAILING_FRAME_MS);
  return (lastBlockMs + trailing) * unitToSeconds;
}
