/**
 * Camera-guided spot spraying ("see and spray"). Cameras on the boom look a set distance ahead
 * of the nozzles; when one finds a weed, the controller opens the nozzle above it for just long
 * enough to wet a patch round the weed. Whether the patch lands on the weed is a timing problem:
 * processing and valve latency, timing jitter and travel speed move it along the row.
 *
 * Field frame: travel along +X, boom across Z. Units: m, s.
 */
import { rng } from './guidance'

export interface Plant {
  x: number
  z: number
  /** radius of the plant, m */
  r: number
}

export interface SpotSpec {
  /** boom spans z ∈ [−width/2, width/2] */
  width: number
  /** nozzle spacing (each nozzle wets one band this wide) */
  spacing: number
  /** camera view line ahead of the nozzles, m */
  lookAhead: number
  /** detection + valve latency, s */
  latency: number
  /** the controller fires early by the latency it expects */
  compensate: boolean
  /** timing jitter, 1σ, s */
  jitter: number
  /** spray margin each side of the plant along the travel, m */
  buffer: number
  /** valve opening/closing smear, s */
  valve: number
  /** probability a weed is detected */
  recall: number
  /** false detections per m² (soil, crop or stones mistaken for weeds) */
  falsePerM2: number
}

export const SPOT_DEFAULTS: SpotSpec = {
  width: 12,
  spacing: 0.5,
  lookAhead: 0.8,
  latency: 0.12,
  compensate: true,
  jitter: 0.015,
  buffer: 0.06,
  valve: 0.02,
  recall: 0.93,
  falsePerM2: 0.02,
}

/** Weeds scattered at `density` per m² over a strip [x0, x0+L] × [−W/2, W/2] (deterministic). */
export function scatterWeeds(seed: number, x0: number, L: number, W: number, density: number): Plant[] {
  const r = rng(seed)
  const n = Math.round(density * L * W)
  const out: Plant[] = []
  for (let i = 0; i < n; i++) out.push({ x: x0 + r.next() * L, z: -W / 2 + r.next() * W, r: 0.02 + r.next() * 0.04 })
  return out
}

export interface Fire {
  /** nozzle index */
  k: number
  /** wetted patch along the travel, [x0, x1] */
  x0: number
  x1: number
  /** the weed it was aimed at (−1 = a false detection) */
  weed: number
}

export interface SpotPlan {
  fires: Fire[]
  detected: boolean[]
  hit: boolean[]
  /** along-track error of each detected weed's patch centre, m */
  shift: number[]
}

/**
 * Where the patch lands for a weed at x: the controller aims it centred on the weed; timing
 * error moves it by v·(uncompensated latency + jitter). With too little look-ahead for the
 * latency, the nozzle cannot open until the weed has partly passed.
 */
export function patchShift(spec: SpotSpec, v: number, jitterSample: number, r: number) {
  const late = spec.compensate ? 0 : spec.latency
  // time available from first sight to the patch start reaching the nozzle
  const lead = (spec.lookAhead - spec.buffer - r) / v
  const tooLate = Math.max(0, spec.latency - lead)
  return v * (late + tooLate + jitterSample * spec.jitter)
}

export function planPass(spec: SpotSpec, weeds: Plant[], v: number, seed: number, x0: number, L: number): SpotPlan {
  const r = rng(seed)
  const fires: Fire[] = []
  const detected: boolean[] = []
  const hit: boolean[] = []
  const shift: number[] = []
  const n = Math.round(spec.width / spec.spacing)
  const nozzleOf = (z: number) => Math.max(0, Math.min(n - 1, Math.floor((z + spec.width / 2) / spec.spacing)))
  const smear = v * spec.valve
  weeds.forEach((w, i) => {
    const d = r.next() < spec.recall
    detected.push(d)
    if (!d) {
      hit.push(false)
      shift.push(NaN)
      return
    }
    const s = patchShift(spec, v, r.gauss(), w.r)
    shift.push(s)
    const half = spec.buffer + w.r
    const c = w.x + s
    fires.push({ k: nozzleOf(w.z), x0: c - half - smear / 2, x1: c + half + smear / 2, weed: i })
    // hit when the whole plant lies inside the wetted patch
    // the plant [x − r, x + r] lies inside the patch [c − half − smear/2, c + half + smear/2]
    hit.push(Math.abs(s) <= spec.buffer + smear / 2)
  })
  const falseN = Math.round(spec.falsePerM2 * spec.width * L)
  for (let j = 0; j < falseN; j++) {
    const x = x0 + r.next() * L
    const z = -spec.width / 2 + r.next() * spec.width
    fires.push({ k: nozzleOf(z), x0: x - spec.buffer - smear / 2, x1: x + spec.buffer + smear / 2, weed: -1 })
  }
  return { fires, detected, hit, shift }
}

/** Total wetted area (m²): the union of patches on each nozzle band × the band width. */
export function sprayedArea(spec: SpotSpec, fires: Fire[]) {
  const byK = new Map<number, [number, number][]>()
  for (const f of fires) {
    const a = byK.get(f.k) ?? []
    a.push([f.x0, f.x1])
    byK.set(f.k, a)
  }
  let len = 0
  for (const list of byK.values()) {
    list.sort((a, b) => a[0] - b[0])
    let [s, e] = list[0]
    for (let i = 1; i < list.length; i++) {
      const [a, b] = list[i]
      if (a <= e) e = Math.max(e, b)
      else {
        len += e - s
        ;[s, e] = [a, b]
      }
    }
    len += e - s
  }
  return len * spec.spacing
}

export interface SpotResult {
  weeds: number
  detected: number
  hit: number
  /** weeds killed ÷ weeds present */
  control: number
  sprayed: number
  blanket: number
  /** chemical saved vs blanket spraying */
  saving: number
  falseFires: number
}

export function summarise(spec: SpotSpec, plan: SpotPlan, L: number): SpotResult {
  const weeds = plan.detected.length
  const detected = plan.detected.filter(Boolean).length
  const hit = plan.hit.filter(Boolean).length
  const sprayed = plan.fires.length ? sprayedArea(spec, plan.fires) : 0
  const blanket = spec.width * L
  return {
    weeds,
    detected,
    hit,
    control: weeds ? hit / weeds : 1,
    sprayed,
    blanket,
    saving: 1 - sprayed / blanket,
    falseFires: plan.fires.filter((f) => f.weed < 0).length,
  }
}

/** Expected result for a setting (averaged over a few random fields). */
export function expected(spec: SpotSpec, density: number, vKmh: number, L = 100, runs = 4) {
  const v = vKmh / 3.6
  let c = 0
  let s = 0
  for (let k = 0; k < runs; k++) {
    const weeds = scatterWeeds(101 + k, 0, L, spec.width, density)
    const r = summarise(spec, planPass(spec, weeds, v, 7 + k, 0, L), L)
    c += r.control
    s += r.saving
  }
  return { control: c / runs, saving: s / runs }
}
