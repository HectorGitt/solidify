import { create } from 'zustand'
import { bevelForces, bevelMeanRadius, helicalForces, idlerTrain, pinionConeAngle, spurCircles, spurForces, torqueFromPower } from '@/physics/elements'

const { PI } = Math
export const rad = (d: number) => (d * PI) / 180
export const deg = (r: number) => (r * 180) / PI

export type Mode = 'spur' | 'helical' | 'bevel' | 'idler'

export interface GearParams {
  mode: Mode
  rpm: number
  /* spur / helical: torque on the gear whose diameter is D */
  Mt: number
  D: number
  phi: number
  helix: number
  plane: 'transverse' | 'normal'
  /* bevel */
  P: number
  bRpm: number
  /** velocity ratio gear : pinion */
  ratio: number
  Dp: number
  face: number
  phiB: number
  /* idler train */
  iP: number
  iRpm: number
  zA: number
  zB: number
  zC: number
  m: number
  phiI: number
  /** angle ABC at the idler centre */
  psi: number
}

export const DEFAULTS: GearParams = {
  mode: 'spur',
  rpm: 30,
  Mt: 200,
  D: 0.1,
  phi: rad(20),
  helix: rad(30),
  plane: 'transverse',
  P: 6000,
  bRpm: 240,
  ratio: 4 / 3,
  Dp: 0.15,
  face: 0.05,
  phiB: rad(14.5),
  iP: 3000,
  iRpm: 600,
  zA: 35,
  zB: 65,
  zC: 45,
  m: 0.006,
  phiI: rad(20),
  psi: PI,
}

interface Store extends GearParams {
  set: (p: Partial<GearParams>) => void
  reset: () => void
}
export const useGears = create<Store>((set) => ({ ...DEFAULTS, set: (p) => set(p), reset: () => set(DEFAULTS) }))

/** Drawn pairs (fixed, from the worked examples): module 5 mm, Ø100 pinion with a Ø250 gear. */
export const SPUR = { m: 0.005, z1: 20, z2: 50, width: 0.03 }
/** Bevel pair of MG15 Q3c: pinion Ø150 (30 T), gear Ø200 (40 T), face 50 mm. */
export const BEVEL = { m: 0.005, z1: 30, z2: 40, face: 0.05 }

export function spurResult(p: GearParams) {
  const f = spurForces(p.Mt, p.D / 2, p.phi)
  return { ...f, circles: spurCircles(SPUR.z1, SPUR.m, p.phi) }
}
export const helicalResult = (p: GearParams) => helicalForces(p.Mt, p.D / 2, p.phi, p.helix, p.plane)

export function bevelResult(p: GearParams) {
  const R = p.Dp / 2
  const beta = pinionConeAngle(R, R * p.ratio)
  const rm = bevelMeanRadius(R, p.face, beta)
  const Mt = torqueFromPower(p.P, p.bRpm)
  return { beta, rm, Mt, ...bevelForces(Mt, rm, p.phiB, beta) }
}

/**
 * Idler train A–B–C: the same tooth force acts at both meshes of the idler. The idler shaft load
 * is the vector sum of the two tooth forces on B; with A and C on opposite sides (ABC = 180°) the
 * radial parts cancel and the tangential parts add: 2F_t.
 */
export function idlerResult(p: GearParams) {
  const t = idlerTrain(p.iP, p.iRpm, p.zA, p.zB, p.zC)
  const rA = (p.m * p.zA) / 2
  const f = spurForces(t.TA, rA, p.phiI)
  // forces on B, contact AB on −x side of B, contact CB at angle ψ measured from BA
  const u1 = [-1, 0]
  const u2 = [-Math.cos(p.psi), Math.sin(p.psi)]
  // radial: toward B's centre (−u); tangential: equal and opposite torques on B
  const t1 = [-u1[1], u1[0]]
  const t2 = [u2[1], -u2[0]]
  const Fx = f.Fr * (-u1[0] - u2[0]) + f.Ft * (t1[0] + t2[0])
  const Fy = f.Fr * (-u1[1] - u2[1]) + f.Ft * (t1[1] + t2[1])
  return { ...t, rA, rB: (p.m * p.zB) / 2, rC: (p.m * p.zC) / 2, Ft: f.Ft, Fr: f.Fr, F: f.F, load: Math.hypot(Fx, Fy), loadDir: Math.atan2(Fy, Fx), D: [p.zA, p.zB, p.zC].map((z) => z * p.m) }
}

export const live = { theta: 0 }
