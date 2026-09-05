#!/usr/bin/env node
// Generates a tiny, valid, decodable WAV fixture for local dev/QA use — see
// docs/obsidian/24-Manual-QA.md "真實音訊播放驗證". Produces a short sine
// tone (not silence) so playback can be visually confirmed via the audio
// element's currentTime advancing, without needing to commit any binary
// audio file to the repo (the global safety rules for this project forbid
// committing test audio — regenerate locally with this script instead).
//
// Usage: node scripts/dev/generate-test-audio.mjs [outputPath] [seconds]

import { writeFileSync } from "node:fs";

const outputPath = process.argv[2] || "public/dev-test-audio.wav";
const seconds = Number(process.argv[3]) || 1.5;
const sampleRate = 8000;
const frequencyHz = 440; // A4, audible if you actually listen to it
const numSamples = Math.floor(sampleRate * seconds);
const bytesPerSample = 2; // 16-bit PCM
const dataSize = numSamples * bytesPerSample;

const buffer = Buffer.alloc(44 + dataSize);

// RIFF header
buffer.write("RIFF", 0);
buffer.writeUInt32LE(36 + dataSize, 4);
buffer.write("WAVE", 8);

// fmt chunk
buffer.write("fmt ", 12);
buffer.writeUInt32LE(16, 16); // PCM chunk size
buffer.writeUInt16LE(1, 20); // audio format = PCM
buffer.writeUInt16LE(1, 22); // channels = mono
buffer.writeUInt32LE(sampleRate, 24);
buffer.writeUInt32LE(sampleRate * bytesPerSample, 28); // byte rate
buffer.writeUInt16LE(bytesPerSample, 32); // block align
buffer.writeUInt16LE(16, 34); // bits per sample

// data chunk
buffer.write("data", 36);
buffer.writeUInt32LE(dataSize, 40);

for (let i = 0; i < numSamples; i += 1) {
  const t = i / sampleRate;
  const sample = Math.sin(2 * Math.PI * frequencyHz * t) * 0.2 * 32767;
  buffer.writeInt16LE(Math.round(sample), 44 + i * bytesPerSample);
}

writeFileSync(outputPath, buffer);
console.log(`Wrote ${buffer.length} bytes to ${outputPath}`);
