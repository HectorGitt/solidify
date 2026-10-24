import { create } from 'zustand'
import { SRC } from '@/content/citations'
import { FARMLAND, hitchLoads } from '@/physics/chassis'
import { bisect, draftAboutV, generalisedForce, hitchToWorld, linkageWith, liftRodTension, ploughDraft, soilDir, topLinkForce, type LoadOnImplement } from '@/physics/linkageControl'
import { linkageRange, phiForHitchHeight, solveLinkage, type LinkageGeom, type LinkagePose, type P2 } from '@/tractor/linkage'
import { PLOUGH, PLOUGH_WIDTH, ploughDepth, resistanceLocal } from './plough'

export const C = {
  fig65: [SRC.hitch502('Fig 6.5 virtual hitch point'), SRC.mac502('Ch. 6 §fully mounted, Figs 6.4–6.5')],
  fig64: [SRC.hitch502('Figs 6.3–6.4 four-bar chain'), SRC.mac502('Ch. 6 Fig 6.4')],
  linkage: [SRC.hy510('p6–7 Fig 42 linkage')],
  coupler: [SRC.hy510('p7–8 Fig 43 automatic coupler')],
  care: [SRC.hy510('p8 care of the linkage')],
  mounted: [SRC.hitch502('Eqs 6.15–6.16 fully mounted'), SRC.mac502('Ch. 6 eqs 6.15–6.16')],
  plough: [SRC.am502('§12 primary tillage: mouldboard plough')],
}

/** ISO 730 category dimensions (beyond notes: the notes name Cat I/II/III only). */
export const CATS = {
  I: { spread: 0.683, lowerPin: 0.022, topPin: 0.019, mast: 0.46, label: 'Cat I' },
  II: { spread: 0.825, lowerPin: 0.028, topPin: 0.025, mast: 0.61, label: 'Cat II' },
  III: { spread: 0.965, lowerPin: 0.037, topPin: 0.032, mast: 0.685, label: 'Cat III' },
} as const
export type Cat = keyof typeof CATS

export type HoldMode = 'hold' | 'float'

export interface ThreePointParams {
  /** top-link (turnbuckle) length, m */
  top: number
  /** lower hitch height set by the lift arms (hold mode), m */
  h: number
  /** hydraulics holding the arms, or free-link "float" */
  mode: HoldMode
  /** soil force angle below horizontal, degrees */
  theta: number
  /** specific soil resistance, kN/m² */
  k: number
  cat: Cat
  coupler: boolean
  construct: boolean
  /** bump to make the scene jump to `h` (presets, tours) instead of floating from where it is */
  jump: number
}

export const DEFAULTS: ThreePointParams = { top: 0.55, h: 0.4, mode: 'hold', theta: 10, k: 50, cat: 'II', coupler: false, construct: true, jump: 0 }

interface Store extends ThreePointParams {
  set: (p: Partial<ThreePointParams>) => void
  reset: () => void
}
export const useThreePoint = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

export const geomFor = (top: number, cat: Cat): LinkageGeom => linkageWith(top, CATS[cat].mast)
export const rad = (d: number) => (d * Math.PI) / 180
export const deg = (r: number) => (r * 180) / Math.PI

/** Hitch-height limits for which the chain closes (with a margin). */
export function hRange(g: LinkageGeom) {
  const r = linkageRange(g)
  const hAt = (phi: number) => g.A.y - g.lower * Math.sin(phi)
  return { lo: Math.max(0.12, hAt(r.hi) + 0.01), hi: Math.min(0.85, hAt(r.lo) - 0.01) }
}

export type Stage = 'raised' | 'penetration' | 'equilibrium' | 'restrained' | 'lifting' | 'parallel'

export interface Analysis {
  pose: LinkagePose
  phi: number
  depth: number
  /** centre of soil resistance (side view) */
  P: P2
  S: number
  /** draft line offset above V at V.x (m) */
  e: number | null
  pullIn: boolean
  /** moment of S about V, N·m (+ = turns the implement into the soil) */
  MV: number
  /** generalised force on φ, N·m/rad (+ = hitch driven down) */
  Q: number
  /** lift-rod tension (both rods), N — needed to hold the arms locked */
  T: number
  /** top-link force, N (+ = compression) */
  Ctop: number
  stage: Stage
  /** Eq 6.15: rear-axle load with this mounted soil force, N */
  Vr: number
  Vf: number
  weight: number
}

/** Loads on the plough: soil force S at P and the implement weight at its CG. */
export function loadsFor(depth: number, S: number, theta: number): LoadOnImplement[] {
  const u = soilDir(theta)
  const W = PLOUGH.mass * 9.81
  return [
    { at: resistanceLocal(depth), F: { x: S * u.x, y: S * u.y } },
    { at: PLOUGH.cg, F: { x: 0, y: -W } },
  ]
}

export function analyse(p: Pick<ThreePointParams, 'top' | 'theta' | 'k' | 'cat'>, h: number, mode: HoldMode): Analysis {
  const g = geomFor(p.top, p.cat)
  const phi = phiForHitchHeight(h, g)
  const pose = solveLinkage(phi, g)
  const depth = ploughDepth(pose)
  const th = rad(p.theta)
  const P = hitchToWorld(pose, resistanceLocal(depth))
  const S = ploughDraft(p.k * 1000, PLOUGH_WIDTH, depth) / Math.cos(th)
  const chk = draftAboutV(pose.V, P, th)
  const loads = loadsFor(depth, S, th)
  const Q = generalisedForce(phi, g, loads)
  const T = liftRodTension(phi, g, loads)
  const Ctop = topLinkForce(pose, g, loads)
  let stage: Stage
  if (depth <= 0.005) stage = 'raised'
  else if (!chk) stage = 'parallel'
  else if (Math.abs(chk.e) < 0.02) stage = 'equilibrium'
  else if (!chk.pullIn) stage = 'lifting'
  else stage = depth < 0.06 ? 'penetration' : mode === 'float' ? 'penetration' : 'restrained'
  const b = pose.L.x - P.x
  const z = pose.L.y - P.y
  const hl = hitchLoads({ ...FARMLAND, xd: -pose.L.x }, { S, theta: th, b, z, a: 1 }, 'mounted')
  return {
    pose,
    phi,
    depth,
    P,
    S,
    e: chk ? chk.e : null,
    pullIn: chk ? chk.pullIn : false,
    MV: chk ? S * Math.abs(chk.arm) * (chk.pullIn ? 1 : -1) : 0,
    Q,
    T,
    Ctop,
    stage,
    Vr: hl.Vr,
    Vf: hl.Vf,
    weight: PLOUGH.mass * 9.81,
  }
}

/** Hitch height at which the plough just touches the surface. */
export function surfaceHeight(p: Pick<ThreePointParams, 'top' | 'cat'>) {
  const g = geomFor(p.top, p.cat)
  const r = hRange(g)
  return bisect((h) => ploughDepth(solveLinkage(phiForHitchHeight(h, g), g)), r.lo, r.hi) ?? r.hi
}

/** Free-link equilibrium (Fig 6.5b): hitch height where the draft line passes through V. */
export function equilibriumHeight(p: Pick<ThreePointParams, 'top' | 'theta' | 'cat'>) {
  const g = geomFor(p.top, p.cat)
  const r = hRange(g)
  const hs = surfaceHeight(p)
  const f = (h: number) => {
    const pose = solveLinkage(phiForHitchHeight(h, g), g)
    const d = ploughDepth(pose)
    const c = draftAboutV(pose.V, hitchToWorld(pose, resistanceLocal(d)), rad(p.theta))
    return c ? c.e : 1
  }
  return bisect(f, r.lo, hs - 0.005)
}

export interface LiveThreePoint {
  h: number
  depth: number
  beta: number
  tilt: number
  V: P2 | null
  e: number | null
  stage: Stage
  S: number
  T: number
  Ctop: number
}
export const live: LiveThreePoint = { h: DEFAULTS.h, depth: 0, beta: 0, tilt: 0, V: null, e: null, stage: 'raised', S: 0, T: 0, Ctop: 0 }

/** Float (free-link) motion: the plough is drawn in or out until the draft line passes through V. */
export function floatStep(p: ThreePointParams, h: number, dt: number) {
  const a = analyse(p, h, 'float')
  const g = geomFor(p.top, p.cat)
  const r = hRange(g)
  let rate: number
  if (a.depth <= 0.002) rate = -0.12 // drops under its own weight onto the soil
  else if (a.e === null) rate = 0
  else rate = Math.max(-0.08, Math.min(0.08, (a.pullIn ? -1 : 1) * 0.6 * Math.abs(a.e)))
  return { h: Math.max(r.lo, Math.min(r.hi, h + rate * dt)), a }
}

