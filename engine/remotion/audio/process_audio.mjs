// process_audio.mjs — EQ de "de-muffle" pra narração TTS (sem dependência npm).
// Aplica 2 biquads RBJ em série: corte leve em ~300Hz (tira o abafado/boxiness 200-400Hz)
// + high-shelf de presença em ~3.5kHz. Depois normaliza o pico (o loudnorm final fica
// por conta do ffmpeg embutido do Remotion, que TEM loudnorm mas não tem EQ).
//
// Uso: node process_audio.mjs <in.wav> <out.wav>
// Suporta WAV PCM 16-bit (mono/estéreo).

import { readFileSync, writeFileSync } from 'node:fs';

// --- parâmetros do EQ ---
const PEAK = { f0: 300, Q: 1.0, gainDb: -3.0 }; // corte leve do low-mid (muffle)
const SHELF = { f0: 3500, S: 0.7, gainDb: 4.0 }; // presença (de-muffle)
const PEAK_TARGET = 0.97; // normaliza o pico pré-loudnorm (evita clipping entre estágios)

function parseWav(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('não é WAV RIFF/WAVE');
  }
  let off = 12;
  let fmt = null;
  let data = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    const sz = buf.readUInt32LE(off + 4);
    if (id === 'fmt ') {
      fmt = {
        audioFormat: buf.readUInt16LE(off + 8),
        channels: buf.readUInt16LE(off + 10),
        rate: buf.readUInt32LE(off + 12),
        bits: buf.readUInt16LE(off + 22),
      };
    } else if (id === 'data') {
      data = buf.subarray(off + 8, off + 8 + sz);
    }
    off += 8 + sz + (sz & 1);
  }
  if (!fmt || !data) throw new Error('chunks fmt/data ausentes');
  if (fmt.audioFormat !== 1 || fmt.bits !== 16) {
    throw new Error(`esperado PCM 16-bit, recebi audioFormat=${fmt.audioFormat} bits=${fmt.bits}`);
  }
  return { fmt, data };
}

// coeficientes RBJ (normalizados por a0) — peaking EQ
function peaking(f0, Q, gainDb, Fs) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / Fs;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Q);
  const a0 = 1 + alpha / A;
  return {
    b0: (1 + alpha * A) / a0,
    b1: (-2 * cos) / a0,
    b2: (1 - alpha * A) / a0,
    a1: (-2 * cos) / a0,
    a2: (1 - alpha / A) / a0,
  };
}

// coeficientes RBJ — high shelf
function highShelf(f0, S, gainDb, Fs) {
  const A = Math.pow(10, gainDb / 40);
  const w0 = (2 * Math.PI * f0) / Fs;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = (sin / 2) * Math.sqrt((A + 1 / A) * (1 / S - 1) + 2);
  const twoSqrtAalpha = 2 * Math.sqrt(A) * alpha;
  const a0 = A + 1 - (A - 1) * cos + twoSqrtAalpha;
  return {
    b0: (A * (A + 1 + (A - 1) * cos + twoSqrtAalpha)) / a0,
    b1: (-2 * A * (A - 1 + (A + 1) * cos)) / a0,
    b2: (A * (A + 1 + (A - 1) * cos - twoSqrtAalpha)) / a0,
    a1: (2 * (A - 1 - (A + 1) * cos)) / a0,
    a2: (A + 1 - (A - 1) * cos - twoSqrtAalpha) / a0,
  };
}

function applyBiquad(samples, c) {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const x = samples[i];
    const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    samples[i] = y;
  }
}

function main() {
  const [inPath, outPath] = process.argv.slice(2);
  if (!inPath || !outPath) {
    console.error('Uso: node process_audio.mjs <in.wav> <out.wav>');
    process.exit(1);
  }
  const { fmt, data } = parseWav(readFileSync(inPath));
  const n = data.length / 2;
  const ch = fmt.channels;
  // desentrelaça em canais (float)
  const chans = Array.from({ length: ch }, () => new Float64Array(Math.floor(n / ch)));
  for (let i = 0; i < n; i++) {
    const v = data.readInt16LE(i * 2) / 32768;
    chans[i % ch][Math.floor(i / ch)] = v;
  }
  // EQ por canal: peaking -> high shelf
  const peak = peaking(PEAK.f0, PEAK.Q, PEAK.gainDb, fmt.rate);
  const shelf = highShelf(SHELF.f0, SHELF.S, SHELF.gainDb, fmt.rate);
  let absMax = 0;
  for (const c of chans) {
    applyBiquad(c, peak);
    applyBiquad(c, shelf);
    for (let i = 0; i < c.length; i++) absMax = Math.max(absMax, Math.abs(c[i]));
  }
  // normaliza o pico (headroom pro loudnorm seguinte)
  const gain = absMax > 0 ? PEAK_TARGET / absMax : 1;
  // re-entrelaça em int16
  const out = Buffer.alloc(chans[0].length * ch * 2);
  for (let i = 0; i < chans[0].length; i++) {
    for (let c = 0; c < ch; c++) {
      let s = Math.round(chans[c][i] * gain * 32767);
      if (s > 32767) s = 32767;
      if (s < -32768) s = -32768;
      out.writeInt16LE(s, (i * ch + c) * 2);
    }
  }
  // escreve WAV canônico
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + out.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(ch, 22);
  header.writeUInt32LE(fmt.rate, 24);
  header.writeUInt32LE(fmt.rate * ch * 2, 28); // byte rate
  header.writeUInt16LE(ch * 2, 32); // block align
  header.writeUInt16LE(16, 34); // bits
  header.write('data', 36);
  header.writeUInt32LE(out.length, 40);
  writeFileSync(outPath, Buffer.concat([header, out]));
  console.log(`EQ ok: ${inPath} -> ${outPath} (${ch}ch ${fmt.rate}Hz, peakNorm gain=${gain.toFixed(3)})`);
}

main();
