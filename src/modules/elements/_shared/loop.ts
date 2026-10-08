import * as THREE from 'three'
import { finalize, type V2 } from '@/geometry'

/**
 * A belt (or chain pitch line) wrapped round any number of pulleys, in the XY plane.
 *
 * Each pulley has a sense s: +1 when the belt runs round it counter-clockwise with the pulley
 * inside the loop (driver, driven pulleys), −1 when the belt runs clockwise round it (the other
 * pulley of a crossed belt, or a back-side idler). The common tangent from pulley i to pulley j
 * satisfies left(t)·(c_j − c_i) = ρ_j − ρ_i with signed radii ρ = s·r, which gives the external
 * (open belt) and internal (crossed belt) tangents in one formula.
 *
 * Written here because the shared `loopPath` in src/geometry/parts.ts places its tangent points
 * at the mirror angle (±(90° + β) instead of ±(90° − β)), so its spans are not tangent.
 */

const { PI, cos, sin, acos, atan2, hypot } = Math
const TAU = 2 * PI

export interface Pulley {
  c: [number, number]
  r: number
  /** +1 belt runs CCW round it (pulley inside the loop), −1 CW */
  s: 1 | -1
}

export interface LoopSeg {
  kind: 'arc' | 'line'
  /** arc length at the start / end of the segment */
  s0: number
  s1: number
  /** arcs: pulley index, start angle, signed sweep (rad) */
  pulley?: number
  a0?: number
  sweep?: number
  /** lines: end points, index of the pulley the span leaves and arrives at */
  p0?: [number, number]
  p1?: [number, number]
  from?: number
  to?: number
  /** ±1: lines that should bow out of plane (crossed spans) */
  bow?: number
}

export interface BeltLoop {
  pulleys: Pulley[]
  segs: LoopSeg[]
  length: number
  /** angle of wrap on each pulley (rad) */
  wraps: number[]
  pointAt: (s: number, target?: THREE.Vector3) => THREE.Vector3
  tangentAt: (s: number, target?: THREE.Vector3) => THREE.Vector3
  /** segment index at arc length s */
  segAt: (s: number) => number
}

const wrapS = (s: number, L: number) => ((s % L) + L) % L

/**
 * Build the loop. The belt runs in the order of `pulleys` (pulley 0 → 1 → 2 → … → 0) and the
 * path starts at the point where it arrives on pulley 0. `bow` lifts crossing spans out of the
 * plane by ±bow (m) so a crossed belt's spans pass each other.
 */
export function beltLoop(pulleys: Pulley[], bow = 0): BeltLoop {
  const n = pulleys.length
  // tangent from i to j: angle ψ of left(t)
  const psi: number[] = []
  for (let i = 0; i < n; i++) {
    const a = pulleys[i]
    const b = pulleys[(i + 1) % n]
    const dx = b.c[0] - a.c[0]
    const dy = b.c[1] - a.c[1]
    const L = hypot(dx, dy)
    const phi = atan2(dy, dx)
    const k = Math.max(-1, Math.min(1, (b.s * b.r - a.s * a.r) / L))
    psi.push(phi + acos(k))
  }
  // contact point on pulley p for a tangent whose left normal is at angle ψ: P = c − ρ·(cos ψ, sin ψ)
  const contactAngle = (p: Pulley, ps: number) => (p.s > 0 ? ps + PI : ps)
  const pt = (p: Pulley, a: number): [number, number] => [p.c[0] + p.r * cos(a), p.c[1] + p.r * sin(a)]
  const segs: LoopSeg[] = []
  const wraps: number[] = []
  let s = 0
  for (let j = 0; j < n; j++) {
    const p = pulleys[j]
    const aIn = contactAngle(p, psi[(j - 1 + n) % n])
    const aOut = contactAngle(p, psi[j])
    let span = (p.s * (aOut - aIn)) % TAU
    if (span < 0) span += TAU
    wraps.push(span)
    const len = span * p.r
    segs.push({ kind: 'arc', s0: s, s1: s + len, pulley: j, a0: aIn, sweep: p.s * span })
    s += len
    const q = pulleys[(j + 1) % n]
    const p0 = pt(p, aOut)
    const p1 = pt(q, contactAngle(q, psi[j]))
    const ll = hypot(p1[0] - p0[0], p1[1] - p0[1])
    const crossing = p.s !== q.s
    segs.push({ kind: 'line', s0: s, s1: s + ll, p0, p1, from: j, to: (j + 1) % n, bow: crossing ? (j === 0 ? bow : -bow) : 0 })
    s += ll
  }
  const length = s
  const segAt = (x: number) => {
    const u = wrapS(x, length)
    for (let i = 0; i < segs.length; i++) if (u < segs[i].s1) return i
    return segs.length - 1
  }
  const pointAt = (x: number, target = new THREE.Vector3()) => {
    const u = wrapS(x, length)
    const g = segs[segAt(u)]
    const f = u - g.s0
    if (g.kind === 'arc') {
      const p = pulleys[g.pulley!]
      const a = g.a0! + (Math.sign(g.sweep!) * f) / p.r
      return target.set(p.c[0] + p.r * cos(a), p.c[1] + p.r * sin(a), 0)
    }
    const t = f / (g.s1 - g.s0)
    return target.set(g.p0![0] + (g.p1![0] - g.p0![0]) * t, g.p0![1] + (g.p1![1] - g.p0![1]) * t, (g.bow ?? 0) * sin(PI * t))
  }
  const tangentAt = (x: number, target = new THREE.Vector3()) => {
    const u = wrapS(x, length)
    const g = segs[segAt(u)]
    const f = u - g.s0
    if (g.kind === 'arc') {
      const p = pulleys[g.pulley!]
      const sg = Math.sign(g.sweep!)
      const a = g.a0! + (sg * f) / p.r
      return target.set(-sin(a) * sg, cos(a) * sg, 0)
    }
    const len = g.s1 - g.s0
    const t = f / len
    return target.set((g.p1![0] - g.p0![0]) / len, (g.p1![1] - g.p0![1]) / len, ((g.bow ?? 0) * PI * cos(PI * t)) / len).normalize()
  }
  return { pulleys, segs, length, wraps, pointAt, tangentAt, segAt }
}

/** Open belt: pulley 0 at c1 (radius r1), pulley 1 at c2. */
export const openLoop = (c1: [number, number], r1: number, c2: [number, number], r2: number) =>
  beltLoop([
    { c: c1, r: r1, s: 1 },
    { c: c2, r: r2, s: 1 },
  ])

/** Crossed belt: pulley 1 turns the other way. */
export const crossedLoop = (c1: [number, number], r1: number, c2: [number, number], r2: number, bow = 0) =>
  beltLoop(
    [
      { c: c1, r: r1, s: 1 },
      { c: c2, r: r2, s: -1 },
    ],
    bow,
  )

/**
 * Sweep a closed cross-section round the loop. The section is given in (outward, z) coordinates
 * — outward is away from the pulley the belt wraps (the left-hand normal of travel, sign-adjusted).
 * The loop is closed, so the result is a closed solid with no end caps.
 */
export function sweepLoop(loop: BeltLoop, section: V2[], samples = 360, normalSide: (s: number) => number = () => 1) {
  const n = samples
  const m = section.length
  const pos: number[] = []
  const rings: THREE.Vector3[][] = []
  const p = new THREE.Vector3()
  const t = new THREE.Vector3()
  const z = new THREE.Vector3(0, 0, 1)
  for (let i = 0; i < n; i++) {
    const s = (loop.length * i) / n
    loop.pointAt(s, p)
    loop.tangentAt(s, t)
    // in-plane normal pointing to the right of travel (away from a CCW pulley's centre)
    const nrm = new THREE.Vector3(t.y, -t.x, 0).normalize().multiplyScalar(normalSide(s))
    const bz = z.clone().sub(t.clone().multiplyScalar(t.dot(z))).normalize()
    rings.push(section.map(([u, w]) => p.clone().addScaledVector(nrm, u).addScaledVector(bz, w)))
  }
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (let i = 0; i < n; i++) {
    const A = rings[i]
    const B = rings[(i + 1) % n]
    for (let k = 0; k < m; k++) {
      const k1 = (k + 1) % m
      tri(A[k], B[k], B[k1])
      tri(A[k], B[k1], A[k1])
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  // make it outward-facing whatever the loop and section orientation
  if (signedVolume(g) < 0) flip(g)
  return finalize(g, PI / 6)
}

export function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  let v = 0
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    v += a.dot(b.clone().cross(c)) / 6
  }
  return v
}

function flip(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < p.count; i += 3) {
    const x = p.getX(i + 1)
    const y = p.getY(i + 1)
    const z = p.getZ(i + 1)
    p.setXYZ(i + 1, p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2))
    p.setXYZ(i + 2, x, y, z)
  }
  p.needsUpdate = true
}

/** Rectangle section (flat belt) of width w (along z) and thickness t, inner face on the pitch line. */
export const flatSection = (w: number, t: number): V2[] => [
  [0, -w / 2],
  [t, -w / 2],
  [t, w / 2],
  [0, w / 2],
]

/**
 * Trapezoidal V-belt section: top width `top`, depth `h`, included angle θ (rad). The pitch line
 * sits at `pitchFromTop` below the top face; the section is placed so u = 0 is the pitch line.
 */
export function vSection(top: number, h: number, theta: number, pitchFromTop: number): V2[] {
  const bottom = top - 2 * h * Math.tan(theta / 2)
  const u1 = pitchFromTop
  const u0 = pitchFromTop - h
  return [
    [u0, -bottom / 2],
    [u1, -top / 2],
    [u1, top / 2],
    [u0, bottom / 2],
  ]
}

/** Gear meshing phase: gear 2 at angle γ from gear 1 turns at −(z1/z2)θ1 + φ0 with this φ0. */
export const meshPhase = (gamma: number, z1: number, z2: number) => gamma * (1 + z1 / z2) + PI - PI / z2
