import { create } from 'zustand'
import { DriveGraph, brake, coupling, planetary } from '@/core/drive'
import { MEMBERS, planetSpeed, planetaryRatio, radToRpm, ringTeeth, rpmToRad, thirdMember, type Member } from '@/physics/gearing'

/**
 * Simple planetary set as drawn in PT p5: sun, four planets on a carrier, ring (annulus).
 * Tooth numbers are typical (the notes give none): z_s 30, z_p 24, z_r = z_s + 2z_p = 78,
 * module 3 mm, so (z_s + z_r)/4 = 27 and four equally spaced planets assemble.
 * Frame: metres, shafts along Z. Carrier shaft to −Z; ring shaft (hollow) and sun shaft to +Z.
 */
export const PG = {
  zs: 30,
  zp: 24,
  zr: ringTeeth(30, 24),
  m: 0.003,
  n: 4,
  width: 0.03,
}
export const RS = (PG.m * PG.zs) / 2
export const RP = (PG.m * PG.zp) / 2
export const RR = (PG.m * PG.zr) / 2
/** carrier pin circle radius */
export const RC = RS + RP
/** axial offset of the second set of the compound train */
export const SET2_Z = -0.26

export const MEMBER_LABEL: Record<Member, string> = { sun: 'Sun', carrier: 'Carrier', ring: 'Ring' }

export type Mode2 = 'direct' | 'under' | 'reverse'

export interface PlanetaryParams {
  input: Member
  /** member that drives the load ('none' = nothing connected) */
  output: Member | 'none'
  /** member held by its brake */
  held: Member | 'none'
  /** members joined by the lock-up clutch (two are needed) */
  lock: Member[]
  /** input speed, rpm */
  rpm: number
  /** input torque, N·m */
  torque: number
  compound: boolean
  /** set 1 in the compound train: direct (locked) or underdrive (ring held) */
  mode1: 'direct' | 'under'
  mode2: Mode2
  powerFlow: boolean
}

export const DEFAULTS: PlanetaryParams = {
  input: 'sun',
  output: 'carrier',
  held: 'ring',
  lock: [],
  rpm: 240,
  torque: 100,
  compound: false,
  mode1: 'under',
  mode2: 'reverse',
  powerFlow: true,
}

interface Store extends PlanetaryParams {
  set: (p: Partial<PlanetaryParams>) => void
  reset: () => void
}

/**
 * Keep the settings physically possible: the input is never braked or the output; brake and
 * lock-up clutch are never applied together (that would lock the input solid).
 */
export function sanitize(s: PlanetaryParams, p: Partial<PlanetaryParams>): PlanetaryParams {
  const n: PlanetaryParams = { ...s, ...p, lock: [...(p.lock ?? s.lock)] }
  // choosing an input that was the output swaps the two
  if (n.output === n.input) n.output = p.input !== undefined && s.input !== n.input ? s.input : 'none'
  if (n.held === n.input) n.held = 'none'
  if (p.held !== undefined && p.held !== 'none') n.lock = []
  if (p.lock !== undefined && n.lock.length >= 2) n.held = 'none'
  if (n.lock.length > 2) n.lock = n.lock.slice(-2)
  if (n.held !== 'none' && n.lock.length >= 2) n.lock = []
  return n
}

export const usePlanetary = create<Store>((set, get) => ({
  ...DEFAULTS,
  set: (p) => set(sanitize(get(), p)),
  reset: () => set({ ...DEFAULTS, lock: [] }),
}))

export const isLocked = (p: Pick<PlanetaryParams, 'lock'>) => p.lock.length >= 2

/** Speed ratio ω_out/ω_in of the simple set for the current settings (NaN = neutral). */
export function simpleRatio(p: Pick<PlanetaryParams, 'input' | 'output' | 'held' | 'lock'>) {
  if (p.output === 'none') return NaN
  if (isLocked(p)) return 1
  if (p.held === p.output) return 0
  if (p.held === 'none') return NaN
  return planetaryRatio(PG.zs, PG.zr, p.input, p.output, 'held')
}

/** Ratio of each stage of the compound train (sun in; set 2 sun driven by set 1 carrier, PT p6). */
export function stageRatio(mode: Mode2) {
  if (mode === 'direct') return 1
  if (mode === 'under') return planetaryRatio(PG.zs, PG.zr, 'sun', 'carrier', 'held')
  return planetaryRatio(PG.zs, PG.zr, 'sun', 'ring', 'held')
}

export function overallRatio(p: PlanetaryParams) {
  if (!p.compound) return simpleRatio(p)
  return stageRatio(p.mode1) * stageRatio(p.mode2)
}

/** Tooth number "seen" by each member in the torque balance T_s : T_r : T_c = z_s : z_r : −(z_s + z_r). */
const zOf = (m: Member) => (m === 'sun' ? PG.zs : m === 'ring' ? PG.zr : PG.zs + PG.zr)

/**
 * Ideal (loss-free) torques for the simple set: |T_out| = T_in·z_out/z_in and the brake
 * reaction |T_held| = T_in·z_held/z_in (beyond notes — follows from the Willis relation).
 */
export function simpleTorques(p: PlanetaryParams) {
  if (isLocked(p)) return { out: p.output === 'none' ? 0 : p.torque, held: 0 }
  if (p.output === 'none' || p.held === 'none') return { out: 0, held: 0 }
  if (p.held === p.output) return { out: 0, held: 0 }
  return { out: (p.torque * zOf(p.output)) / zOf(p.input), held: (p.torque * zOf(p.held)) / zOf(p.input) }
}

/* ------------------------------ Drive graph ------------------------------ */

export function makeGraph() {
  const g = new DriveGraph()
  for (const id of ['sun', 'carrier', 'ring', 'sun2', 'carrier2', 'ring2']) g.body(id, 0.5)
  g.add(planetary('set', 'sun', PG.zs, 'ring', PG.zr, 'carrier'))
  g.add(planetary('set2', 'sun2', PG.zs, 'ring2', PG.zr, 'carrier2'))
  const st = () => usePlanetary.getState()
  for (const m of MEMBERS) {
    g.add(
      brake(`brake-${m}`, m, () => {
        const s = st()
        if (s.compound) return m === 'ring' && s.mode1 === 'under'
        return s.held === m
      }),
    )
  }
  // lock-up clutch: by "lock any two", one equation joining the two chosen members suffices
  g.add({
    id: 'lock',
    rows: () => {
      const s = st()
      if (s.compound) return s.mode1 === 'direct' ? [{ c: { sun: 1, carrier: -1 }, rhs: 0 }] : []
      return isLocked(s) ? [{ c: { [s.lock[0]]: 1, [s.lock[1]]: -1 }, rhs: 0 }] : []
    },
  })
  // compound: set 1 carrier drives set 2 sun (output of the first → input of the second, PT p6)
  g.add(coupling('link', 'carrier', 'sun2', () => st().compound))
  g.add(brake('brake-ring2', 'ring2', () => st().compound && st().mode2 === 'under'))
  g.add(brake('brake-carrier2', 'carrier2', () => st().compound && st().mode2 === 'reverse'))
  g.add(coupling('lock2', 'sun2', 'carrier2', () => st().compound && st().mode2 === 'direct'))
  return g
}

export interface PlanetState {
  theta: number
  omega: number
}

/** Step the train: drive the input member and integrate the planets' own spin. */
export function stepGraph(g: DriveGraph, dt: number, p1: PlanetState, p2: PlanetState) {
  const s = usePlanetary.getState()
  g.drivers.clear()
  g.drive(s.compound ? 'sun' : s.input, rpmToRad(s.rpm))
  // the second set idles (no constraint ties it) unless compounded
  if (!s.compound) {
    g.drive('sun2', 0)
    g.drive('carrier2', 0)
  }
  g.step(dt)
  const w = (id: string) => g.get(id).omega
  p1.omega = planetSpeed(w('sun'), w('carrier'), PG.zs, PG.zp)
  p1.theta += p1.omega * dt
  p2.omega = planetSpeed(w('sun2'), w('carrier2'), PG.zs, PG.zp)
  p2.theta += p2.omega * dt
  live.sun = radToRpm(w('sun'))
  live.carrier = radToRpm(w('carrier'))
  live.ring = radToRpm(w('ring'))
  live.planet = radToRpm(p1.omega)
  live.planetRel = radToRpm(p1.omega - w('carrier'))
  live.sun2 = radToRpm(w('sun2'))
  live.carrier2 = radToRpm(w('carrier2'))
  live.ring2 = radToRpm(w('ring2'))
  live.out = s.compound ? radToRpm(w(s.mode2 === 'reverse' ? 'ring2' : 'carrier2')) : s.output === 'none' ? 0 : radToRpm(w(s.output))
}

/* ------------------------------ Phases so the teeth interlock ------------------------------ */

/** Planet i sits at angle γ_i = 2πi/n on the carrier; its static phase meshes it with the sun (sun tooth 0 on +X). */
export const planetAngle = (i: number) => (2 * Math.PI * i) / PG.n
export const planetPhase = (i: number) => {
  const g = planetAngle(i)
  return g + Math.PI + Math.PI / PG.zp + g * (PG.zs / PG.zp)
}
/** Ring phase: a planet with an even tooth count shows a gap outward, so the ring needs a tooth there. */
export const RING_PHASE = PG.zp % 2 === 0 ? Math.PI / PG.zr : 0

/**
 * Mesh residuals (rad, ≡ 0 mod 2π when the teeth interlock) for planet i, given member angles.
 * External sun–planet: (φ_s − γ)z_s + (φ_p − γ − π)z_p − π; internal planet–ring: (φ_r − γ)z_r − (φ_p − γ)z_p.
 */
export function meshResiduals(i: number, sun: number, carrier: number, ring: number, planetAbs: number) {
  const gma = planetAngle(i) + carrier
  const phiP = planetAbs + planetPhase(i)
  const phiR = ring + RING_PHASE
  return {
    sunPlanet: (sun - gma) * PG.zs + (phiP - gma - Math.PI) * PG.zp - Math.PI,
    planetRing: (phiR - gma) * PG.zr - (phiP - gma) * PG.zp,
  }
}

/** Distance of an angle from the nearest multiple of 2π. */
export const offMultiple = (a: number) => Math.abs(a - 2 * Math.PI * Math.round(a / (2 * Math.PI)))

/* ------------------------------ Live values ------------------------------ */

export const live = { sun: 0, carrier: 0, ring: 0, planet: 0, planetRel: 0, sun2: 0, carrier2: 0, ring2: 0, out: 0 }

export { thirdMember }
