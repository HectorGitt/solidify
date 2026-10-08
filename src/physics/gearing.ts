/**
 * Gear trains, gearbox speeds and planetary (epicyclic) sets — AEE510 Power Transmission
 * (Culpin App. 2 "Transmission of Power", Bell Ch. 5) with the AEE503 Module 5 idler train.
 * SI units: rad/s or rpm as named, m, N·m, W, kg·m².
 */

const TWO_PI = 2 * Math.PI

export const rpmToRad = (rpm: number) => (rpm * TWO_PI) / 60
export const radToRpm = (w: number) => (w * 60) / TWO_PI

/* ------------------------------ Gear pairs and trains ------------------------------ */

/** Pitch diameter d = m·z (module m in metres). */
export const pitchDiameter = (m: number, z: number) => m * z

/** Centre distance of an external pair a = m(z₁ + z₂)/2. */
export const centreDistance = (m: number, z1: number, z2: number) => (m * (z1 + z2)) / 2

/**
 * Follower speed from D·N = d·n (Culpin p3–4): the pitch-line speed is shared, so speeds are
 * inversely proportional to diameter (or tooth number).
 */
export function followerSpeed(driverSize: number, driverSpeed: number, followerSize: number) {
  return (driverSize * driverSpeed) / followerSize
}

/**
 * Speed ratio of a simple or compound train: N_out/N_in = Π(driver teeth)/Π(follower teeth)
 * (Culpin p4). An idler appears as both driver and follower and so cancels.
 */
export function trainSpeedRatio(drivers: number[], followers: number[]) {
  const p = (a: number[]) => a.reduce((x, y) => x * y, 1)
  return p(drivers) / p(followers)
}

/** Sense of rotation after n external meshes: +1 same as input, −1 reversed. */
export const meshSense = (externalMeshes: number) => (externalMeshes % 2 === 0 ? 1 : -1)

/** Reduction ratio i = N_in / N_out (e.g. engine 2000 rpm → wheel 20 rpm gives 100 : 1). */
export const reductionRatio = (nIn: number, nOut: number) => nIn / nOut

/** Torque on a shaft carrying power P at N rpm: T = 60P/(2πN). */
export const torqueFromPower = (P: number, rpm: number) => (60 * P) / (TWO_PI * rpm)

/** Ideal (loss-free) output torque of a train: T_out = T_in / (N_out/N_in). */
export const outputTorque = (Tin: number, speedRatio: number) => Tin / speedRatio

/** Number of distinct ratios from stacked sections in series (MF: 4 × 2 × 2 = 16). */
export const ratioCount = (...sections: number[]) => sections.reduce((a, b) => a * b, 1)

/* ------------------------------ Ground speed ------------------------------ */

/** Wheel rim speed v = 2πrN/60 (m/s) for a rolling radius r and N rpm (no slip). */
export const wheelSpeed = (rpm: number, rollingRadius: number) => (TWO_PI * rollingRadius * rpm) / 60

export const toKmh = (v: number) => v * 3.6

/** Ground speed (km/h) from engine speed and the overall speed ratio N_wheel/N_engine. */
export function groundSpeedKmh(engineRpm: number, overallSpeedRatio: number, rollingRadius: number) {
  return toKmh(wheelSpeed(engineRpm * overallSpeedRatio, rollingRadius))
}

/* ------------------------------ Planetary (epicyclic) sets ------------------------------ */

export type Member = 'sun' | 'carrier' | 'ring'
export const MEMBERS: Member[] = ['sun', 'carrier', 'ring']

/** Ring teeth that fit sun and planets of the same module: z_r = z_s + 2z_p. */
export const ringTeeth = (zs: number, zp: number) => zs + 2 * zp

/** Equally spaced planets assemble only when (z_s + z_r)/n is a whole number. */
export const planetsFit = (zs: number, zr: number, n: number) => (zs + zr) % n === 0

/**
 * Willis equation for a simple planetary set (standard texts — not in the notes):
 *   (ω_s − ω_c)/(ω_r − ω_c) = −z_r/z_s   ⇔   z_s·ω_s + z_r·ω_r = (z_s + z_r)·ω_c
 * Give any two speeds; the third is returned.
 */
export function willis(zs: number, zr: number, w: Partial<Record<Member, number>>): Record<Member, number> {
  const { sun, carrier, ring } = w
  if (sun !== undefined && ring !== undefined) return { sun, ring, carrier: (zs * sun + zr * ring) / (zs + zr) }
  if (sun !== undefined && carrier !== undefined) return { sun, carrier, ring: ((zs + zr) * carrier - zs * sun) / zr }
  if (ring !== undefined && carrier !== undefined) return { ring, carrier, sun: ((zs + zr) * carrier - zr * ring) / zs }
  throw new Error('willis: give two of sun, carrier, ring')
}

/** The member that is neither a nor b. */
export const thirdMember = (a: Member, b: Member): Member => MEMBERS.find((m) => m !== a && m !== b)!

export type PlanetaryCondition = 'held' | 'locked' | 'free'

/**
 * Speed ratio ω_out/ω_in of a planetary set.
 * - 'held': the third member is braked (ω = 0) — Willis;
 * - 'locked': any two members clutched together, so the set turns as one: 1 (PT p6);
 * - 'free': nothing held — neutral, no drive (NaN).
 */
export function planetaryRatio(zs: number, zr: number, input: Member, output: Member, condition: PlanetaryCondition) {
  if (input === output) throw new Error('planetaryRatio: input and output must differ')
  if (condition === 'locked') return 1
  if (condition === 'free') return NaN
  const held = thirdMember(input, output)
  const w = willis(zs, zr, { [input]: 1, [held]: 0 } as Partial<Record<Member, number>>)
  return w[output]
}

/** Absolute planet spin (rad/s) from sun and carrier speeds: ω_p = ω_c − (z_s/z_p)(ω_s − ω_c). */
export const planetSpeed = (wSun: number, wCarrier: number, zs: number, zp: number) => wCarrier - (zs / zp) * (wSun - wCarrier)

/** Plain-language description of a ratio, as the notes describe the planetary states. */
export function describeRatio(r: number) {
  if (!Number.isFinite(r)) return 'neutral — no drive'
  if (Math.abs(r - 1) < 1e-9) return 'direct drive 1 : 1'
  const dir = r < 0 ? 'reverse' : 'same direction'
  const kind = Math.abs(r) < 1 ? 'reduction (underdrive)' : 'overdrive'
  return `${kind}, ${dir}`
}

/* ------------------------------ Synchroniser ------------------------------ */

/**
 * Time for a cone synchroniser of torque capacity T to bring a free gear (with the inertia
 * J reflected to it) through a speed difference Δω: t = J·|Δω|/T (standard texts).
 */
export const syncTime = (J: number, dOmega: number, T: number) => (J * Math.abs(dOmega)) / T

/** Pitch-line (sliding) speed between two gear faces that are about to engage, m/s. */
export const pitchLineMismatch = (pitchRadius: number, dOmega: number) => Math.abs(pitchRadius * dOmega)

/** Speed difference left after a cone synchroniser has acted for t seconds: |Δω| − T·t/J (≥ 0). */
export function synchroRemaining(dOmega0: number, J: number, T: number, t: number) {
  const left = Math.max(0, Math.abs(dOmega0) - (T * t) / J)
  return Math.sign(dOmega0) * left
}

/* ------------------------------ Gear tables ------------------------------ */

export interface RatioOption {
  label: string
  /** speed ratio ω_out/ω_in of this stage (negative = reverses) */
  ratio: number
}

export interface TableRow {
  labels: string[]
  /** overall gearbox speed ratio ω_out/ω_in (product of the stages) */
  ratio: number
  /** overall reduction engine : wheel, including the fixed reductions */
  reduction: number
  wheelRpm: number
  kmh: number
}

/**
 * Every combination of the stages in series (e.g. speed-shift × shuttle × 4 gears × range
 * = 16 forward, TOP p3), sorted by ground speed. `fixedReduction` = crown wheel × final drive.
 */
export function gearTable(engineRpm: number, stages: RatioOption[][], fixedReduction: number, rollingRadius: number): TableRow[] {
  let rows: { labels: string[]; ratio: number }[] = [{ labels: [], ratio: 1 }]
  for (const st of stages) rows = rows.flatMap((r) => st.map((o) => ({ labels: [...r.labels, o.label], ratio: r.ratio * o.ratio })))
  return rows
    .map((r) => {
      const reduction = fixedReduction / Math.abs(r.ratio)
      const wheelRpm = engineRpm / reduction
      return { ...r, reduction, wheelRpm, kmh: toKmh(wheelSpeed(wheelRpm, rollingRadius)) }
    })
    .sort((a, b) => a.kmh - b.kmh)
}

/* ------------------------------ Clutch pedal ------------------------------ */

export interface PedalSpec {
  /** pedal free play before the release bearing touches the levers, mm (TTS p3–4: 18 mm typical) */
  freePlay: number
  /** pedal travel over which the clamp load falls from full to zero (cushion of the facings), mm */
  bite: number
  /** total pedal travel, mm */
  travel: number
  /** pressure-plate lift per mm of pedal once the disc is free, mm/mm */
  liftPerMm: number
  /** lift needed for a clean release (no drag), mm */
  cleanLift: number
  /** free play below which the bearing rides on the levers, mm */
  minFreePlay: number
}

/** Typical single dry plate tractor clutch linkage (beyond notes except the 18 mm free play). */
export const TYPICAL_PEDAL: PedalSpec = { freePlay: 18, bite: 30, travel: 150, liftPerMm: 0.016, cleanLift: 1.2, minFreePlay: 6 }

export interface PedalState {
  /** fraction of the full spring clamp load still on the disc, 0…1 */
  clamp: number
  /** pressure-plate lift off the disc, mm */
  lift: number
  /** residual drag (fraction of capacity) when the plate does not lift clear, 0…0.15 */
  drag: number
  /** release bearing touching the levers */
  bearingContact: boolean
}

/**
 * Pedal travel → clamp load. The first `freePlay` mm do nothing (TTS p3). With too little free
 * play the bearing rides on the levers and takes load off the plate — wear and slip; with too
 * much the plate never lifts clear at full travel — drag, so gears are hard to engage (TTS p4).
 */
export function clutchPedal(pedalMm: number, s: PedalSpec = TYPICAL_PEDAL): PedalState {
  const preload = Math.max(0, s.minFreePlay - s.freePlay) * 4
  const x = pedalMm - s.freePlay + preload
  const clamp = Math.min(1, Math.max(0, 1 - x / s.bite))
  const lift = Math.max(0, (x - s.bite) * s.liftPerMm)
  const atFull = Math.max(0, (s.travel - s.freePlay + preload - s.bite) * s.liftPerMm)
  const drag = clamp === 0 && lift < s.cleanLift ? 0.15 * (1 - lift / s.cleanLift) : 0
  void atFull
  return { clamp, lift, drag, bearingContact: x >= 0 }
}

/* ------------------------------ Powershift (overlapping clutches) ------------------------------ */

export interface ShiftSpec {
  /** engine torque into the unit, N·m */
  Te: number
  /** inertia of engine + input side, kg·m² */
  J: number
  /** output shaft speed, rad/s (held by the tractor's mass during the shift) */
  wOut: number
  /** speed reductions ω_in/ω_out of the off-going and on-coming paths */
  iOff: number
  iOn: number
  /** full-pressure torque capacity of each clutch, N·m (input side) */
  Cmax: number
  /** pressure rise time of the on-coming clutch, s */
  fill: number
  /** pressure dump time of the off-going clutch, s (default fill/4) */
  release?: number
  /** delay from the start of the on-coming fill to the start of the off-going release, s (< 0: released first) */
  overlap: number
  duration?: number
  dt?: number
}

export interface ShiftTrace {
  t: number[]
  /** torque at the output shaft, N·m */
  Tout: number[]
  /** input-side torques carried by the on-coming and off-going clutches, N·m */
  Ton: number[]
  Toff: number[]
  /** capacities, N·m */
  Con: number[]
  Coff: number[]
  /** input (engine) speed, rad/s */
  wIn: number[]
  /** heat dissipated in the clutches, J */
  heat: number
  /** time the on-coming clutch locks up, s (NaN if it never does) */
  tLock: number
}

const ramp = (x: number) => Math.min(1, Math.max(0, x))

/**
 * A shift between two constant-mesh paths by overlapping hydraulic clutches (PT p4: shifted
 * "without interrupting the flow of power"). Each clutch couples ω_in to i·ω_out; a slipping
 * clutch carries its capacity C (sign of its slip), a locked one whatever torque balances the
 * input, up to C. Torque phase: both clutches share the load; inertia phase: the on-coming
 * clutch pulls the engine to the new speed. Released too early → engine flare and a torque
 * hole; too late → tie-up (the clutches fight). BEYOND NOTES (standard shift dynamics).
 */
export function simulateShift(s: ShiftSpec): ShiftTrace {
  const dt = s.dt ?? 0.001
  const T = s.duration ?? 1.2
  const out: ShiftTrace = { t: [], Tout: [], Ton: [], Toff: [], Con: [], Coff: [], wIn: [], heat: 0, tLock: NaN }
  let w = s.iOff * s.wOut
  let locked: 'on' | 'off' | null = 'off'
  const tOn0 = Math.max(0, -s.overlap)
  const tOff0 = Math.max(0, s.overlap)
  const sgn = (x: number) => (x > 0 ? 1 : x < 0 ? -1 : 0)
  const steps = Math.round(T / dt)
  for (let k = 0; k <= steps; k++) {
    const t = k * dt
    const Con = s.Cmax * ramp((t - tOn0) / s.fill)
    const Coff = s.Cmax * (1 - ramp((t - tOff0) / (s.release ?? s.fill / 4)))
    const sOn = w - s.iOn * s.wOut
    const sOff = w - s.iOff * s.wOut
    let Ton = Con * sgn(sOn)
    let Toff = Coff * sgn(sOff)
    if (locked === 'off') {
      const need = s.Te - Ton
      if (Math.abs(need) <= Coff) Toff = need
      else {
        Toff = Coff * sgn(need)
        locked = null
      }
    } else if (locked === 'on') {
      const need = s.Te - Toff
      if (Math.abs(need) <= Con) Ton = need
      else {
        Ton = Con * sgn(need)
        locked = null
      }
    }
    out.t.push(t)
    out.Ton.push(Ton)
    out.Toff.push(Toff)
    out.Con.push(Con)
    out.Coff.push(Coff)
    out.wIn.push(w)
    out.Tout.push(s.iOn * Ton + s.iOff * Toff)
    out.heat += (Math.abs(Ton * sOn) + Math.abs(Toff * sOff)) * dt
    if (locked) continue
    const wNext = w + ((s.Te - Ton - Toff) / s.J) * dt
    const wOnSync = s.iOn * s.wOut
    const wOffSync = s.iOff * s.wOut
    if (sgn(wNext - wOnSync) !== sgn(sOn) && Math.abs(s.Te - Coff * sgn(sOff)) <= Con) {
      w = wOnSync
      locked = 'on'
      if (Number.isNaN(out.tLock)) out.tLock = t
    } else if (sgn(wNext - wOffSync) !== sgn(sOff) && Coff > 0 && Math.abs(s.Te - Con * sgn(sOn)) <= Coff) {
      w = wOffSync
      locked = 'off'
    } else w = wNext
  }
  return out
}
