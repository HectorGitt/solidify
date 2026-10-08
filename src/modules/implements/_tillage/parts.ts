import * as THREE from 'three'
import { cylinder, lathe, merge, type V2 } from '@/geometry'
import { rim, torus, tyre } from '@/geometry/parts'
import { sweepRings, thickSurface, type P3 } from '../_shared/geom'

/**
 * Geometry generators for the tillage and planting scenes. Every generator returns a closed,
 * outward-facing solid (see parts.test.ts).
 */

const { PI, sqrt, cos, sin } = Math

/**
 * Concave (spherical-cap) disc, axis along +Y with the CONCAVE face towards +Y. The rim sits on
 * y = 0 and the centre of the concave face at y = −c (c = concavity). Thickness t.
 */
export function concaveDisc(R: number, c: number, t: number, seg = 72, hubR = 0) {
  const rho = (R * R + c * c) / (2 * c)
  const yin = (r: number) => -(sqrt(rho * rho - r * r) - sqrt(rho * rho - R * R))
  const n = 18
  const prof: V2[] = []
  const r0 = hubR
  for (let i = 0; i <= n; i++) {
    const r = r0 + ((R - r0) * i) / n
    // back (convex) face, thinning to a sharpened edge
    const tt = t * (1 - 0.7 * Math.pow(i / n, 6))
    prof.push([r, yin(r) - tt])
  }
  for (let i = n; i >= 0; i--) {
    const r = r0 + ((R - r0) * i) / n
    prof.push([r, yin(r)])
  }
  if (r0 === 0) {
    // close on the axis
    prof[0] = [0, prof[0][1]]
    prof[prof.length - 1] = [0, prof[prof.length - 1][1]]
  }
  return lathe(prof, seg)
}

/** Depth of the concave face below the rim plane at radius r. */
export function discDish(R: number, c: number, r: number) {
  const rho = (R * R + c * c) / (2 * c)
  return sqrt(rho * rho - r * r) - sqrt(rho * rho - R * R)
}

/**
 * Rectangular bar (w across `side`, h in the other direction) swept along a smooth curve through
 * the points. `side` should be roughly perpendicular to the curve everywhere (default +Z, so curves
 * drawn in the XY plane).
 */
export function pathBar(points: P3[], w: number, h: number, samples = 24, side: P3 = [0, 0, 1]) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  )
  const S0 = new THREE.Vector3(...side).normalize()
  const rings: THREE.Vector3[][] = []
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const c = curve.getPointAt(u)
    const T = curve.getTangentAt(u).normalize()
    const S = S0.clone().addScaledVector(T, -T.dot(S0)).normalize()
    const N = new THREE.Vector3().crossVectors(T, S).normalize()
    const a = S.clone().multiplyScalar(w / 2)
    const b = N.clone().multiplyScalar(h / 2)
    rings.push([c.clone().add(a).add(b), c.clone().sub(a).add(b), c.clone().sub(a).sub(b), c.clone().add(a).sub(b)])
  }
  return sweepRings(rings, PI / 4)
}

/** Round rod swept along a smooth curve (ring of `seg` points). */
export function pathRod(points: P3[], r: number, samples = 24, seg = 10, side: P3 = [0, 0, 1]) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  )
  const S0 = new THREE.Vector3(...side).normalize()
  const rings: THREE.Vector3[][] = []
  for (let i = 0; i <= samples; i++) {
    const u = i / samples
    const c = curve.getPointAt(u)
    const T = curve.getTangentAt(u).normalize()
    let S = S0.clone().addScaledVector(T, -T.dot(S0))
    if (S.lengthSq() < 1e-8) S = new THREE.Vector3(1, 0, 0).addScaledVector(T, -T.x)
    S.normalize()
    const N = new THREE.Vector3().crossVectors(T, S).normalize()
    const ring: THREE.Vector3[] = []
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * PI * 2
      ring.push(c.clone().addScaledVector(S, cos(a) * r).addScaledVector(N, sin(a) * r))
    }
    rings.push(ring)
  }
  return sweepRings(rings, PI / 3)
}

/**
 * Cultivator shovel: a curved, pointed spade. Built point-down: the tip at the origin, the blade
 * rising up and back (−X) by `length`, width `width`, curved forward across its width.
 */
export function shovel(width: number, length: number, t = 0.006, pitch = 0.5) {
  const S = (u: number, v: number) => {
    // u from tip (0) to top (1); v across −1…1
    const half = (width / 2) * Math.min(1, 0.12 + u * 2.2) * (1 - 0.15 * u)
    const z = (v * 2 - 1) * half
    const along = u * length
    const curl = -0.18 * (z * z) / (width / 2) // edges curl forward
    return new THREE.Vector3(-along * sin(pitch) + curl, along * cos(pitch), z)
  }
  return thickSurface(S, 10, 8, t)
}

/** Duck-foot sweep: a flat V blade (top view), point forward at the origin. */
export function sweepBlade(span: number, sweepBack: number, chord: number, t = 0.006) {
  const S = (u: number, v: number) => {
    // u across −1…1 (left wing to right wing), v front edge (0) to back edge (1)
    const s = u * 2 - 1
    const x = -Math.abs(s) * sweepBack - v * chord
    return new THREE.Vector3(x, v * chord * 0.25, s * (span / 2))
  }
  return thickSurface(S, 16, 3, t)
}

/** Rotavator L-blade on a flange of radius r0: radial shank to R, then bent sideways by `bend` (along +Z). */
export function lBlade(r0: number, R: number, bend: number, w = 0.05, t = 0.008) {
  const pts: P3[] = [
    [0, -r0, 0],
    [0, -(R - 0.05), 0],
    [0.005, -(R - 0.012), bend * 0.25],
    [0.012, -(R - 0.004), bend * 0.65],
    [0.02, -R + 0.01, bend],
  ]
  // thickness t along X (the direction of motion at the bottom), width w along the rotor axis
  return pathBar(pts, t, w, 16, [1, 0, 0])
}

/** Spike-tooth harrow tine: a square-section tapered spike pointing down (−Y) from the origin. */
export function spike(len: number, a = 0.016) {
  return lathe(
    [
      [0, -len],
      [a * 0.25, -len + 0.01],
      [a * 0.7, -0.01],
      [a * 0.7, 0.02],
      [0, 0.02],
    ],
    4,
    PI / 4,
  )
}

/**
 * Chain-harrow mat: rows of interlocking rings lying (roughly) flat on the ground, nx along X by
 * nz across. Origin at the front-centre; extends towards −X.
 */
export function chainMat(nx: number, nz: number, pitch: number, wire: number) {
  const parts: THREE.BufferGeometry[] = []
  const R = pitch * 0.42
  for (let i = 0; i < nx; i++)
    for (let k = 0; k < nz; k++) {
      const g = torus(R, wire, 6, 14)
      // alternate rings stand at 60° so neighbours interlock
      const up = (i + k) % 2 === 0
      g.rotateX(up ? PI / 3 : PI / 2)
      if (!up) g.rotateY(PI / 2)
      g.translate(-i * pitch * 0.8 - pitch / 2, wire + (up ? R * 0.85 : wire), (k - (nz - 1) / 2) * pitch * 0.8)
      parts.push(g)
    }
  return merge(...parts)
}

/** Land / drive wheel with a tyre, axis along Z, centred at the origin. */
export function landWheel(radius: number, width: number, pattern: 'R1' | 'F2' | 'smooth' = 'F2') {
  const rr = radius * 0.62
  const t = tyre({ radius, width, rimRadius: rr, pattern, lugs: pattern === 'R1' ? 16 : 0 })
  const r = rim(rr, width * 0.9, 0.05, 0.02)
  t.rotateX(PI / 2)
  r.rotateX(PI / 2)
  return { tyre: t, rim: r }
}

/** Steel wheel with spokes (seed drill / planter drive wheel), axis along Z, optional cross lugs. */
export function steelWheel(radius: number, width: number, spokes = 8, lugs = 0) {
  const rimG = lathe(
    [
      [radius - 0.014, -width / 2],
      [radius, -width / 2],
      [radius, width / 2],
      [radius - 0.014, width / 2],
    ],
    64,
  )
  const hub = cylinder(0.045, width * 0.9, 20)
  const parts = [rimG, hub]
  const len = radius - 0.05
  for (let i = 0; i < spokes; i++) {
    const s = cylinder(0.009, len, 8)
    s.rotateZ(-PI / 2)
    s.translate(0.035 + len / 2, 0, 0)
    s.rotateY((i / spokes) * PI * 2)
    parts.push(s)
  }
  for (let i = 0; i < lugs; i++) {
    const l = cylinder(0.008, width * 0.85, 6)
    l.translate(radius + 0.004, 0, 0)
    l.rotateY(((i + 0.5) / lugs) * PI * 2)
    parts.push(l)
  }
  const g = merge(...parts)
  g.rotateX(PI / 2)
  return g
}
