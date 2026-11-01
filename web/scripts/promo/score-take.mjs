// The one-take's score (133⅓ BPM, D aeolian): the beat of score.mjs, voiced dark, with the top end taken out.
//   node scripts/promo/score-take.mjs <out.wav> <take.json>
// Deterministic: same samples every run. Loudness is normalised afterwards with ffmpeg loudnorm.
import fs from 'node:fs'

const SR = 48000
const BEAT = 0.45
const BAR = 4 * BEAT
const TAKE = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'))
const DUR = TAKE.duration
const N = Math.ceil((DUR + 0.2) * SR)
const PI2 = Math.PI * 2

/* ------------------------------------------------------------------ buses */
const bus = () => ({ L: new Float32Array(N), R: new Float32Array(N) })
const B = { drums: bus(), bass: bus(), music: bus(), fx: bus(), verb: bus() }
const add = (b, i, l, r = l) => { if (i >= 0 && i < N) { b.L[i] += l; b.R[i] += r } }
let seed = 0x2f6e2b1
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 0xffffffff) * 2 - 1
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12)
const S = (t) => Math.round(t * SR)

/* ------------------------------------------------------------------ filters */
function svf() { // Chamberlin state-variable filter
  let lo = 0, bp = 0
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, SR / 6) / SR)
    lo += f * bp
    const hi = x - lo - (1 / q) * bp
    bp += f * hi
    return { lo, bp, hi }
  }
}

/* ------------------------------------------------------------------ instruments */
function kick(t, g = 1) {
  const i0 = S(t)
  let ph = 0
  for (let k = 0; k < S(0.5); k++) {
    const x = k / SR
    const f = 45 + 110 * Math.exp(-x / 0.03)
    ph += (PI2 * f) / SR
    const a = Math.exp(-x / 0.22) * (x < 0.002 ? x / 0.002 : 1)
    const click = k < 96 ? rnd() * 0.08 * (1 - k / 96) : 0
    const v = Math.tanh(1.6 * Math.sin(ph) * a) * 0.9 + click
    add(B.drums, i0 + k, v * g)
  }
  duck.push(t)
}
function clap(t, g = 1) {
  const i0 = S(t), f = svf(), body = svf()
  for (let k = 0; k < S(0.35); k++) {
    const x = k / SR
    const bursts = [0, 0.011, 0.022].reduce((s, o) => s + (x >= o ? Math.exp(-(x - o) / 0.006) : 0), 0)
    const env = 0.55 * bursts + Math.exp(-x / 0.09)
    const n = f(rnd(), 1050, 1.0).bp * env
    const b = Math.sin(PI2 * 185 * x) * Math.exp(-x / 0.05) * 0.35
    add(B.drums, i0 + k, (n * 1.1 + b) * g * 0.6, (n * 1.0 + b) * g * 0.6)
    if (k % 2 === 0) add(B.verb, i0 + k, n * g * 0.12)
  }
}
function hat(t, g = 1, open = false) {
  const i0 = S(t), f = svf()
  const d = open ? 0.18 : 0.035
  for (let k = 0; k < S(d * 6); k++) {
    const x = k / SR
    const v = f(rnd(), 5200, 0.7).hi * Math.exp(-x / d)
    add(B.drums, i0 + k, v * g * 0.075 * 0.9, v * g * 0.075)
  }
}
function tick(t, g = 1) { // a mechanical tick: short bright click with a little metal ring
  const i0 = S(t)
  for (let k = 0; k < S(0.08); k++) {
    const x = k / SR
    const v = (rnd() * Math.exp(-x / 0.002) + Math.sin(PI2 * 3100 * x) * Math.exp(-x / 0.015) * 0.5) * g * 0.18
    add(B.fx, i0 + k, v * 0.8, v)
    add(B.verb, i0 + k, v * 0.3)
  }
}
function boom(t, g = 1) { // sub drop + crash
  const i0 = S(t), f = svf()
  let ph = 0
  for (let k = 0; k < S(2.6); k++) {
    const x = k / SR
    ph += (PI2 * (32 + 45 * Math.exp(-x / 0.12))) / SR
    const sub = Math.sin(ph) * Math.exp(-x / 0.9) * 0.9
    const cr = f(rnd(), 1800 * Math.exp(-x / 0.5) + 400, 0.6).lo * Math.exp(-x / 0.5) * 0.3
    add(B.fx, i0 + k, (Math.tanh(sub * 1.4) + cr) * g, (Math.tanh(sub * 1.4) + cr * 0.9) * g)
    add(B.verb, i0 + k, cr * 0.5 * g)
  }
  duck.push(t)
}
function riser(t0, t1, g = 1) { // filtered noise and a sine sweep up into a hit
  const f = svf()
  let ph = 0
  for (let i = S(t0); i < S(t1); i++) {
    const u = (i - S(t0)) / (S(t1) - S(t0))
    const n = f(rnd(), 200 + 2000 * u * u, 1.6).bp * u * u * 0.6
    ph += (PI2 * (90 + 420 * u * u)) / SR
    const s = Math.sin(ph) * u * u * 0.08
    add(B.fx, i, (n + s) * g, (n * 0.9 + s) * g)
    add(B.verb, i, n * 0.4 * g)
  }
}
function whoosh(t, g = 1, d = 0.35) {
  const f = svf()
  for (let k = 0; k < S(d); k++) {
    const u = k / S(d)
    const n = f(rnd(), 1500 * (1 - u) + 250, 1.2).bp * Math.sin(Math.PI * u) * 0.5
    add(B.fx, S(t) + k, n * g * (1 - u * 0.5), n * g * (0.5 + u * 0.5))
  }
}
function chime(t, m, g = 1) { // bell: inharmonic sine partials
  const f0 = mtof(m)
  const parts = [[1, 1, 2.2], [2.01, 0.25, 1.0]]
  for (let k = 0; k < S(3.2); k++) {
    const x = k / SR
    let v = 0
    for (const [r, a, d] of parts) v += Math.sin(PI2 * f0 * r * x) * a * Math.exp(-x / d)
    v *= (x < 0.003 ? x / 0.003 : 1) * 0.09 * g
    add(B.music, S(t) + k, v * 0.85, v)
    add(B.verb, S(t) + k, v * 0.6)
  }
}
/** detuned saw pad on the chord, slow attack, lowpassed */
function pad(t, dur, notes, g = 1, { cut = 1400, att = 0.35, rel = 0.8 } = {}) {
  const voices = notes.flatMap((m) => [-0.09, 0, 0.08].map((d) => ({ f: mtof(m + d), ph: rnd() * 0.5 + 0.5 })))
  const fl = svf(), fr = svf()
  for (let k = 0; k < S(dur + rel); k++) {
    const x = k / SR
    const env = Math.min(1, x / att) * (x > dur ? Math.exp(-(x - dur) / (rel / 3)) : 1)
    let l = 0, r = 0
    voices.forEach((v, j) => { v.ph = (v.ph + v.f / SR) % 1; const s = 2 * v.ph - 1; if (j % 2) l += s; else r += s })
    const c = cut * (0.7 + 0.3 * Math.sin(PI2 * 0.15 * (t + x)))
    l = fl(l, c, 0.8).lo; r = fr(r, c, 0.8).lo
    const gg = (env * g * 0.05) / Math.sqrt(notes.length)
    add(B.music, S(t) + k, l * gg, r * gg)
    if (k % 2 === 0) add(B.verb, S(t) + k, (l + r) * gg * 0.35)
  }
}
function bass(t, dur, m, g = 1) { // saw + sub, filter envelope
  const f = mtof(m), fl = svf()
  let ph = 0
  for (let k = 0; k < S(dur + 0.04); k++) {
    const x = k / SR
    ph = (ph + f / SR) % 1
    const env = Math.min(1, x / 0.004) * Math.exp(-x / 0.25) * (x > dur ? Math.exp(-(x - dur) / 0.01) : 1)
    const saw = fl(2 * ph - 1, 180 + 1300 * Math.exp(-x / 0.06), 1.1).lo
    const sub = Math.sin(PI2 * ph) * 0.8
    const v = Math.tanh((saw * 0.7 + sub) * 1.3) * env * 0.32 * g
    add(B.bass, S(t) + k, v)
  }
}
function pluck(t, m, g = 1, pan = 0) {
  const f = mtof(m), fl = svf()
  let ph = 0, ph2 = 0.3
  for (let k = 0; k < S(0.45); k++) {
    const x = k / SR
    ph = (ph + f / SR) % 1; ph2 = (ph2 + (f * 1.004) / SR) % 1
    const s = (ph < 0.5 ? 1 : -1) * 0.5 + (2 * ph2 - 1) * 0.5
    const v = fl(s, 320 + 900 * Math.exp(-x / 0.05), 0.9).lo * Math.exp(-x / 0.16) * 0.07 * g
    add(B.music, S(t) + k, v * (1 - pan), v * (1 + pan))
    add(B.verb, S(t) + k, v * 0.5)
  }
}

/* ------------------------------------------------------------------ score */
const duck = []
// D aeolian: Dm9 – Bbmaj7 – Fadd9 – Cadd9, one chord a bar; the arpeggio sits an octave lower than in score.mjs
const PROG = [
  { root: 38, pad: [50, 53, 57, 60, 64], arp: [50, 53, 57, 60, 64, 60, 57, 53] },
  { root: 34, pad: [46, 50, 53, 57, 62], arp: [46, 50, 53, 57, 62, 57, 53, 50] },
  { root: 41, pad: [53, 57, 60, 64, 67], arp: [53, 57, 60, 64, 67, 64, 60, 57] },
  { root: 36, pad: [48, 52, 55, 62, 64], arp: [48, 52, 55, 60, 62, 60, 55, 52] },
]
const chord = (bar) => PROG[((bar % 4) + 4) % 4]
const bt = (bar, beat = 0) => bar * BAR + beat * BEAT
const barOf = (t) => Math.round(t / BAR)
const M = TAKE.marks
const END = barOf(M.end)
const SLOW = [barOf(M.slow), barOf(M.explode)]

function uiClick(t, g = 1) {
  const i0 = S(t), f = svf()
  for (let k = 0; k < S(0.05); k++) {
    const x = k / SR
    const v = (f(rnd(), 1500, 1.2).bp * Math.exp(-x / 0.006) + Math.sin(PI2 * 720 * x) * Math.exp(-x / 0.009) * 0.3) * 0.2 * g
    add(B.fx, i0 + k, v, v * 0.9)
  }
}

// intro (bars 0–1): the chord swelling in, a riser into the first move
pad(0, 3.6, [26, 38, 45], 1.4, { cut: 500, att: 2.2, rel: 0.4 })
pad(0.6, 3.0, PROG[0].pad, 0.9, { cut: 800, att: 2.4, rel: 0.6 })
riser(1.8, 3.6, 0.7)
boom(3.6, 0.9)

// the take: the same groove throughout; it thins for the slow motion and comes back for the explode
for (let b = 2; b < END; b++) {
  const c = chord(b - 2)
  const slow = b >= SLOW[0] && b < SLOW[1]
  pad(bt(b), BAR, c.pad, 1, { cut: slow ? 650 : 1000 })
  if (slow) {
    bass(bt(b, 0), BEAT * 2 - 0.05, c.root, 0.9)
    bass(bt(b, 2), BEAT * 2 - 0.05, c.root, 0.8)
    kick(bt(b, 0), 0.9)
    clap(bt(b, 2), 0.5)
    continue
  }
  for (let e = 0; e < 8; e++) bass(bt(b, e / 2), BEAT / 2 - 0.03, c.root + (e === 7 ? 12 : 0), e % 2 ? 0.75 : 1)
  kick(bt(b, 0)); kick(bt(b, 2)); if (b >= 4) kick(bt(b, 3.5), 0.6)
  if (b >= 3) { clap(bt(b, 1)); clap(bt(b, 3)) }
  for (let e = 0; e < 8; e++) hat(bt(b, e / 2), e % 2 ? 1 : 0.55)
  if (b >= 6) for (let s = 0; s < 8; s++) pluck(bt(b, s / 2), c.arp[s], 0.8, s % 2 ? 0.25 : -0.25)
}
// a soft lift into each new feature, and a click under every click
for (const k of Object.keys(M)) if (k !== 'open' && k !== 'end' && M[k] > 4) whoosh(M[k] - 0.3, 0.5, 0.34)
{
  let last = -1
  for (const t of TAKE.clicks) if (t - last >= 0.1) { uiClick(t); last = t }
}
riser(bt(SLOW[1] - 1), bt(SLOW[1]), 0.6)
boom(bt(SLOW[1]), 0.8)
riser(bt(END - 1), bt(END), 0.6)

// end card: the last hit, Dm9 ringing out, a low chime as the logo builds
boom(bt(END), 1.1)
kick(bt(END), 1)
pad(bt(END), 3.2, [38, 50, 53, 57, 60, 64], 1.5, { cut: 1100, att: 0.02, rel: 2.0 })
bass(bt(END), 1.6, 38, 1)
;[62, 69, 74].forEach((m, i) => chime(bt(END) + 0.18 + i * 0.11, m, 0.8))

/* ------------------------------------------------------------------ mix */
const out = { L: new Float32Array(N), R: new Float32Array(N) }
// sidechain duck for bass and music on every kick and boom
const duckEnv = new Float32Array(N).fill(1)
for (const t of duck) for (let k = 0; k < S(0.3); k++) { const i = S(t) + k; if (i < N) duckEnv[i] = Math.min(duckEnv[i], 1 - 0.55 * Math.exp(-(k / SR) / 0.09)) }
// reverb: 4-line feedback delay network on the verb bus
{
  const D = [1553, 2111, 2659, 3217].map((d) => ({ buf: new Float32Array(d), i: 0, lp: 0 }))
  for (let i = 0; i < N; i++) {
    const x = (B.verb.L[i] + B.verb.R[i]) * 0.5
    const o = D.map((d) => d.buf[d.i])
    const h = [o[0] + o[1] + o[2] + o[3], o[0] - o[1] + o[2] - o[3], o[0] + o[1] - o[2] - o[3], o[0] - o[1] - o[2] + o[3]].map((v) => v * 0.5)
    D.forEach((d, j) => { d.lp += 0.35 * (h[j] * 0.86 - d.lp); d.buf[d.i] = x + d.lp; d.i = (d.i + 1) % d.buf.length })
    out.L[i] += (o[0] + o[2]) * 0.45
    out.R[i] += (o[1] + o[3]) * 0.45
  }
}
for (let i = 0; i < N; i++) {
  const d = duckEnv[i]
  out.L[i] += B.drums.L[i] * 0.9 + B.bass.L[i] * d + B.music.L[i] * (0.4 + 0.6 * d) + B.fx.L[i] * 0.8
  out.R[i] += B.drums.R[i] * 0.9 + B.bass.R[i] * d + B.music.R[i] * (0.4 + 0.6 * d) + B.fx.R[i] * 0.8
}
// the top end comes off the whole mix: two one-pole low-passes in series, about 4.5 kHz
{
  const a = 1 - Math.exp((-PI2 * 4500) / SR)
  for (const ch of [out.L, out.R]) {
    let p = 0, q = 0
    for (let i = 0; i < N; i++) { p += a * (ch[i] - p); q += a * (p - q); ch[i] = q }
  }
}
// fade in from silence, fade the tail out at the end
for (let i = 0; i < N; i++) {
  const t = i / SR
  const g = Math.min(1, t / 0.05) * (t > DUR - 2.4 ? Math.max(0, (DUR - t) / 2.4) ** 1.5 : 1)
  out.L[i] = Math.tanh(out.L[i] * 0.9 * g)
  out.R[i] = Math.tanh(out.R[i] * 0.9 * g)
}

/* ------------------------------------------------------------------ wav */
const file = process.argv[2] || 'score-raw.wav'
const buf = Buffer.alloc(44 + N * 4)
buf.write('RIFF', 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write('WAVE', 8); buf.write('fmt ', 12)
buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34)
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40)
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out.L[i])) * 32000), 44 + i * 4)
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, out.R[i])) * 32000), 46 + i * 4)
}
fs.writeFileSync(file, buf)
console.log('wrote', file, (N / SR).toFixed(2), 's')
