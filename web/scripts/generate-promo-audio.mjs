import fs from 'node:fs'
import path from 'node:path'

const SAMPLE_RATE = 48000
const DURATION = 30.0
const NUM_SAMPLES = Math.floor(SAMPLE_RATE * DURATION)

/**
 * Generates a mastered 30.0s 48kHz stereo WAV file tailored to the exact 4-Scene Commercial Beat Sheet:
 * - 00.0s - 02.6s: Deep 6-cylinder turbocharged diesel engine pull + turbo whistle spooling up
 * - 02.6s: High-impact metallic shutter snap + sub-bass drop into 128 BPM electronic commercial pulse
 * - 05.0s - 15.0s: Driving mid-tempo bassline + crisp hi-hats + UI click SFX & section-slice laser whoosh
 * - 15.0s - 25.0s: Split-screen octave arpeggio lift + workshop/classroom rhythmic momentum
 * - 25.0s - 27.2s: High-RPM gear turbine spin-up
 * - 27.2s - 30.0s: Heavy mechanical brake lock thud (32 Hz) + crystalline Solidify chord chime (E5-B5-F#6-G#6)
 */
export function generatePromoWav(outputPath = path.resolve('docs/.promo-audio.wav')) {
  const left = new Float32Array(NUM_SAMPLES)
  const right = new Float32Array(NUM_SAMPLES)

  // Deterministic PRNG for consistent noise textures
  let seed = 1337420
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return (seed / 0xffffffff) * 2 - 1
  }

  // Helper: add a stereo sample
  const add = (i, l, r = l) => {
    if (i >= 0 && i < NUM_SAMPLES) {
      left[i] += l
      right[i] += r
    }
  }

  // 1. SCENE 1 (0.0s - 2.65s): Diesel Engine Rumble + Turbo Spool + Dirt Texture
  let dieselPhase = 0
  let cylPhase = 0
  for (let i = 0; i < Math.floor(2.75 * SAMPLE_RATE); i++) {
    const t = i / SAMPLE_RATE
    const env = t < 2.55 ? Math.min(1, t / 0.25) : Math.max(0, 1 - (t - 2.55) / 0.2)
    // RPM climbs from 1400 to 2350 as camera swoops in
    const rpm = 1400 + (t / 2.65) * 950
    const firingFreq = (rpm / 60) * 3 // 6-cyl 4-stroke firing frequency
    dieselPhase += (2 * Math.PI * firingFreq) / SAMPLE_RATE
    cylPhase += (2 * Math.PI * (firingFreq * 0.5)) / SAMPLE_RATE

    // Rich cylinder pulse harmonics
    const pulse =
      Math.sin(dieselPhase) * 0.45 +
      Math.sin(dieselPhase * 2) * 0.28 +
      Math.sin(cylPhase) * 0.32 +
      Math.tanh(Math.sin(dieselPhase * 3) * 2.2) * 0.18

    // Turbocharger whistle (1800 Hz -> 4200 Hz)
    const turboFreq = 1800 + Math.pow(t / 2.65, 1.7) * 2600
    const turbo = Math.sin(2 * Math.PI * turboFreq * t) * 0.045 * Math.min(1, t / 0.8)

    // Soil/exhaust rumble noise
    const noise = rand() * 0.08 * (0.6 + 0.4 * Math.sin(dieselPhase))

    const sig = (pulse * 0.55 + turbo + noise) * env
    add(i, sig * 1.02, sig * 0.98)
  }

  // 2. SHUTTER SNAP & SUB DROP AT t = 2.60s (Transition into WebGL Browser)
  const snapStart = Math.floor(2.58 * SAMPLE_RATE)
  for (let k = 0; k < Math.floor(0.65 * SAMPLE_RATE); k++) {
    const dt = k / SAMPLE_RATE
    // Pitch-dropping sub impact (130 Hz -> 34 Hz)
    const freq = 34 + 96 * Math.exp(-dt * 18)
    const sub = Math.sin(2 * Math.PI * freq * dt) * Math.exp(-dt * 5.5) * 0.65
    // Crisp metallic transient click
    const click = rand() * Math.exp(-dt * 85) * 0.45
    const shimmer = Math.sin(2 * Math.PI * 2400 * dt) * Math.exp(-dt * 35) * 0.15
    add(snapStart + k, sub + click + shimmer, sub + click * 0.9 - shimmer)
  }

  // 3. ELECTRONIC COMMERCIAL BEAT (2.60s - 27.20s, 128 BPM)
  const bpm = 128
  const beatDur = 60 / bpm // 0.46875s per quarter note
  const stepDur = beatDur / 4 // 16th note
  const beatStart = 2.6
  const beatEnd = 27.2

  // Bassline progression in E minor (frequencies in Hz)
  // E1 (41.20), G1 (49.00), A1 (55.00), B1 (61.74), D2 (73.42), E2 (82.41)
  const bassNotes = [41.2, 41.2, 49.0, 55.0, 41.2, 61.74, 55.0, 49.0]

  for (let step = 0; ; step++) {
    const stepTime = beatStart + step * stepDur
    if (stepTime >= beatEnd) break
    const stepIdx = Math.floor(stepTime * SAMPLE_RATE)
    const isScene3 = stepTime >= 15.0 && stepTime < 25.0
    const isScene4Spin = stepTime >= 25.0

    // Kick drum on every quarter note (steps 0, 4, 8, 12)
    if (step % 4 === 0) {
      const kickLen = Math.floor(0.32 * SAMPLE_RATE)
      for (let k = 0; k < kickLen; k++) {
        const dt = k / SAMPLE_RATE
        const f = 44 + 115 * Math.exp(-dt * 34)
        const kSig = Math.sin(2 * Math.PI * f * dt) * Math.exp(-dt * 9.5) * 0.52
        const kClick = rand() * Math.exp(-dt * 140) * 0.18
        add(stepIdx + k, kSig + kClick)
      }
    }

    // Crisp snare / clap on backbeats (steps 4, 12)
    if (step % 8 === 4) {
      const snareLen = Math.floor(0.18 * SAMPLE_RATE)
      for (let k = 0; k < snareLen; k++) {
        const dt = k / SAMPLE_RATE
        const body = Math.sin(2 * Math.PI * 185 * dt) * Math.exp(-dt * 24) * 0.22
        const snap = rand() * Math.exp(-dt * 28) * 0.25
        add(stepIdx + k, body + snap * 1.05, body + snap * 0.95)
      }
    }

    // Precision 16th-note hi-hat
    const hatLen = Math.floor(0.055 * SAMPLE_RATE)
    const hatAmp = step % 4 === 2 ? 0.14 : 0.065
    for (let k = 0; k < hatLen; k++) {
      const dt = k / SAMPLE_RATE
      const h = rand() * Math.sin(2 * Math.PI * 7800 * dt) * Math.exp(-dt * 75) * hatAmp
      const pan = step % 2 === 0 ? 1.15 : 0.85
      add(stepIdx + k, h * pan, h * (2 - pan))
    }

    // Driving Reese / FM Synth Bass on off-beats & 8ths
    if (step % 2 === 0) {
      const bar = Math.floor(step / 16)
      const noteFreq = bassNotes[(bar * 2 + Math.floor((step % 16) / 8)) % bassNotes.length]
      const noteLen = Math.floor(stepDur * 1.85 * SAMPLE_RATE)
      // Sidechain ducking on kick beats
      const isKick = step % 4 === 0
      for (let k = 0; k < noteLen; k++) {
        const dt = k / SAMPLE_RATE
        const duck = isKick ? Math.min(1, dt / 0.09) : 1
        const env = Math.exp(-dt * 6.5) * duck
        const saw1 = Math.tanh(Math.sin(2 * Math.PI * noteFreq * dt) * 1.8)
        const saw2 = Math.sin(2 * Math.PI * noteFreq * 2.005 * dt) * 0.45
        const sub = Math.sin(2 * Math.PI * noteFreq * dt) * 0.55
        const sig = (saw1 * 0.35 + saw2 * 0.25 + sub * 0.4) * env * 0.28
        add(stepIdx + k, sig * 0.98, sig * 1.02)
      }
    }

    // Scene 3 & 4: High-tech crystalline arpeggio (15.0s - 27.2s) for momentum lift
    if (isScene3 || isScene4Spin) {
      const arpScale = [659.25, 783.99, 987.77, 1174.66, 1318.51, 987.77, 783.99, 659.25] // E5, G5, B5, D6, E6
      const f = arpScale[step % arpScale.length] * (isScene4Spin ? 1.25 : 1)
      const arpLen = Math.floor(stepDur * 0.9 * SAMPLE_RATE)
      const panL = 0.5 + 0.4 * Math.sin(step * 0.7)
      const panR = 1 - panL
      for (let k = 0; k < arpLen; k++) {
        const dt = k / SAMPLE_RATE
        const env = Math.min(1, dt / 0.004) * Math.exp(-dt * 18)
        const tone = (Math.sin(2 * Math.PI * f * dt) + 0.3 * Math.sin(2 * Math.PI * f * 2 * dt)) * env * 0.09
        add(stepIdx + k, tone * panL * 1.4, tone * panR * 1.4)
      }
    }
  }

  // 4. CHOREOGRAPHED UI & MECHANICAL SFX CUES
  const addUiClick = (timeSec, pitch = 1800) => {
    const start = Math.floor(timeSec * SAMPLE_RATE)
    const len = Math.floor(0.04 * SAMPLE_RATE)
    for (let k = 0; k < len; k++) {
      const dt = k / SAMPLE_RATE
      const s =
        Math.sin(2 * Math.PI * pitch * dt) * Math.exp(-dt * 120) * 0.28 +
        Math.sin(2 * Math.PI * pitch * 2.4 * dt) * Math.exp(-dt * 180) * 0.16
      add(start + k, s)
    }
  }

  const addLaserSliceWhoosh = (startSec, durSec) => {
    const start = Math.floor(startSec * SAMPLE_RATE)
    const len = Math.floor(durSec * SAMPLE_RATE)
    for (let k = 0; k < len; k++) {
      const p = k / len
      const dt = k / SAMPLE_RATE
      const env = Math.sin(p * Math.PI)
      const freq = 320 + Math.sin(p * Math.PI) * 1400
      const w = (Math.sin(2 * Math.PI * freq * dt) * 0.12 + rand() * 0.08) * env
      add(start + k, w * (1 - p * 0.4), w * (0.6 + p * 0.4))
    }
  }

  // Scene 2A: Cursor clicks & drags CSG section plane (5.3s -> 6.8s)
  addUiClick(5.25, 2100)
  addLaserSliceWhoosh(5.35, 1.45)
  addUiClick(6.85, 1650)
  addUiClick(8.1, 2400)

  // Scene 2B: Gearbox whip-pan + gear shift click + explode hydraulic servo sweep
  addUiClick(10.05, 1400)
  addUiClick(11.15, 2200)
  addLaserSliceWhoosh(11.2, 1.6)
  addUiClick(13.2, 1950)

  // Scene 3: Split-screen blade slice (15.0s) + caliper click (17.2s) + exam checkmark chime (20.4s)
  addLaserSliceWhoosh(14.95, 0.45)
  addUiClick(17.2, 2300)
  addUiClick(19.5, 2000)
  // Positive green checkmark double-chime at 20.5s
  addUiClick(20.5, 1318.5) // E6
  addUiClick(20.62, 1975.5) // B6

  // 5. SCENE 4 (25.0s - 27.2s): High-Speed Gear Turbine Spin-Up -> 27.2s Mechanical Thud & Chime
  const spinStart = Math.floor(25.0 * SAMPLE_RATE)
  const spinLen = Math.floor(2.2 * SAMPLE_RATE)
  let gearPhase = 0
  for (let k = 0; k < spinLen; k++) {
    const p = k / spinLen
    const f = 180 + Math.pow(p, 2) * 920
    gearPhase += (2 * Math.PI * f) / SAMPLE_RATE
    const whine = Math.sin(gearPhase) * 0.11 * p
    add(spinStart + k, whine)
  }

  // 27.2s: Massive Mechanical Lock Thud + Crystalline Solidify Chord Chime
  const lockStart = Math.floor(27.2 * SAMPLE_RATE)
  const lockLen = Math.floor(2.75 * SAMPLE_RATE)
  const chord = [659.25, 987.77, 1479.98, 1661.22] // E5, B5, F#6, G#6 (lush E major 9 shimmer)
  for (let k = 0; k < lockLen; k++) {
    const dt = k / SAMPLE_RATE
    // Mechanical brake thud
    const thudFreq = 32 + 140 * Math.exp(-dt * 26)
    const thud = Math.sin(2 * Math.PI * thudFreq * dt) * Math.exp(-dt * 6.5) * 0.68
    const clack = rand() * Math.exp(-dt * 95) * 0.42

    // Shimmering digital bell chord
    let chime = 0
    for (let c = 0; c < chord.length; c++) {
      const cf = chord[c]
      chime +=
        Math.sin(2 * Math.PI * cf * dt + Math.sin(2 * Math.PI * cf * 2 * dt) * Math.exp(-dt * 4) * 0.8) *
        Math.exp(-dt * (1.35 + c * 0.25)) *
        0.09
    }
    const fadeOut = dt > 2.2 ? Math.max(0, 1 - (dt - 2.2) / 0.55) : 1
    add(lockStart + k, (thud + clack + chime * 1.05) * fadeOut, (thud + clack * 0.9 + chime * 0.95) * fadeOut)
  }

  // Soft-clip master limiter & write 16-bit PCM WAV
  const dataSize = NUM_SAMPLES * 4 // 2 channels * 2 bytes
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16) // PCM chunk size
  buf.writeUInt16LE(1, 20) // PCM format
  buf.writeUInt16LE(2, 22) // 2 channels (Stereo)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 4, 28) // byte rate
  buf.writeUInt16LE(4, 32) // block align
  buf.writeUInt16LE(16, 34) // bits per sample
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)

  let offset = 44
  for (let i = 0; i < NUM_SAMPLES; i++) {
    const l = Math.max(-0.98, Math.min(0.98, Math.tanh(left[i] * 1.15)))
    const r = Math.max(-0.98, Math.min(0.98, Math.tanh(right[i] * 1.15)))
    buf.writeInt16LE(Math.floor(l * 32767), offset)
    buf.writeInt16LE(Math.floor(r * 32767), offset + 2)
    offset += 4
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true })
  fs.writeFileSync(outputPath, buf)
  return outputPath
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
  const out = generatePromoWav()
  console.log(`Generated mastered stereo promo audio: ${out}`)
}
