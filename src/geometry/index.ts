import * as THREE from 'three'
import { mergeGeometries, mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { ADDITION, Brush, Evaluator, INTERSECTION, SUBTRACTION } from 'three-bvh-csg'

/**
 * Procedural, parametric geometry. Everything here produces CLOSED (watertight) solids
 * so that section caps render correctly when a part is cut.
 */

export type V2 = [number, number]

/** Normalise attributes so geometries can be merged / used in CSG. */
export function finalize(g: THREE.BufferGeometry, crease = Math.PI / 5): THREE.BufferGeometry {
  let out = g.index ? g.toNonIndexed() : g
  out.deleteAttribute('uv')
  out.deleteAttribute('normal')
  out = toCreasedNormals(out, crease)
  const n = out.getAttribute('position').count
  out.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n * 2), 2))
  out.computeBoundingBox()
  out.computeBoundingSphere()
  return out
}

/* ------------------------------ Lathe (revolved) ------------------------------ */

/**
 * Revolve a closed (r, y) profile around the Y axis. Points with r = 0 sit on the axis.
 * The profile is closed automatically. Use CCW order in the (r, y) half-plane.
 */
export function lathe(profile: V2[], segments = 48, phiStart = 0, phiLength = Math.PI * 2): THREE.BufferGeometry {
  const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0, r), y))
  const first = pts[0]
  const last = pts[pts.length - 1]
  if (first.distanceTo(last) > 1e-9) pts.push(first.clone())
  const g = new THREE.LatheGeometry(pts, segments, phiStart, phiLength)
  return finalize(mergeVertices(g, 1e-7), Math.PI / 4)
}

/** Solid cylinder along Y, centred on the origin. */
export function cylinder(radius: number, height: number, segments = 40) {
  return finalize(new THREE.CylinderGeometry(radius, radius, height, segments, 1, false), Math.PI / 4)
}

/** Hollow cylinder (tube) along Y, centred on the origin. */
export function tube(outer: number, inner: number, height: number, segments = 48) {
  const h = height / 2
  return lathe(
    [
      [inner, -h],
      [outer, -h],
      [outer, h],
      [inner, h],
    ],
    segments,
  )
}

export function box(w: number, h: number, d: number) {
  return finalize(new THREE.BoxGeometry(w, h, d), Math.PI / 4)
}

/** Rounded box via extruded rounded rectangle (along Z). */
export function roundedBox(w: number, h: number, d: number, r: number) {
  const s = roundedRect(w, h, r)
  return extrude(s, d)
}

export function roundedRect(w: number, h: number, r: number, cx = 0, cy = 0) {
  const s = new THREE.Shape()
  const x0 = cx - w / 2
  const y0 = cy - h / 2
  r = Math.min(r, w / 2, h / 2)
  s.moveTo(x0 + r, y0)
  s.lineTo(x0 + w - r, y0)
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r)
  s.lineTo(x0 + w, y0 + h - r)
  s.quadraticCurveTo(x0 + w, y0 + h, x0 + w - r, y0 + h)
  s.lineTo(x0 + r, y0 + h)
  s.quadraticCurveTo(x0, y0 + h, x0, y0 + h - r)
  s.lineTo(x0, y0 + r)
  s.quadraticCurveTo(x0, y0, x0 + r, y0)
  return s
}

export function circlePath(r: number, cx = 0, cy = 0, clockwise = false, segments = 48) {
  const p = new THREE.Path()
  p.absarc(cx, cy, r, 0, Math.PI * 2, clockwise)
  void segments
  return p
}

/** Extrude a 2D shape (XY) along Z, centred on z = 0. */
export function extrude(shape: THREE.Shape | THREE.Shape[], depth: number, opts: { bevel?: number; curveSegments?: number } = {}) {
  const b = opts.bevel ?? 0
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: depth - 2 * b,
    bevelEnabled: b > 0,
    bevelThickness: b,
    bevelSize: b,
    bevelSegments: 2,
    curveSegments: opts.curveSegments ?? 24,
  })
  g.translate(0, 0, -depth / 2 + b)
  return finalize(g)
}

/* ------------------------------ Twisted extrusion ------------------------------ */

/**
 * Extrude a polygon with holes along Z with an optional twist (radians over the full depth)
 * — used for spur (twist 0) and helical gears.
 */
export function extrudeTwisted(contour: THREE.Vector2[], holes: THREE.Vector2[][], depth: number, twist = 0, steps = 1): THREE.BufferGeometry {
  contour = dedupe(contour)
  holes = holes.map(dedupe)
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse()
  holes = holes.map((h) => (THREE.ShapeUtils.isClockWise(h) ? h : h.slice().reverse()))
  const positions: number[] = []
  const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  const at = (p: THREE.Vector2, k: number) => {
    const t = k / steps
    const ang = twist * (t - 0.5)
    const c = Math.cos(ang)
    const s = Math.sin(ang)
    return new THREE.Vector3(p.x * c - p.y * s, p.x * s + p.y * c, -depth / 2 + depth * t)
  }
  const wall = (loop: THREE.Vector2[], outward: boolean) => {
    const n = loop.length
    for (let k = 0; k < steps; k++) {
      for (let i = 0; i < n; i++) {
        const p0 = loop[i]
        const p1 = loop[(i + 1) % n]
        const a = at(p0, k)
        const b = at(p1, k)
        const c = at(p1, k + 1)
        const d = at(p0, k + 1)
        if (outward) {
          pushTri(a, b, c)
          pushTri(a, c, d)
        } else {
          pushTri(a, c, b)
          pushTri(a, d, c)
        }
      }
    }
  }
  wall(contour, true)
  holes.forEach((h) => wall(h, true))
  const all = [...contour, ...holes.flat()]
  const tris = THREE.ShapeUtils.triangulateShape(contour.slice(), holes.map((h) => h.slice()))
  for (let [i, j, k] of tris) {
    // force CCW (seen from +z) so the top cap faces +z and the bottom cap faces −z
    const A = all[i]
    const B = all[j]
    const C = all[k]
    if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0) [j, k] = [k, j]
    pushTri(at(all[i], 0), at(all[k], 0), at(all[j], 0))
    pushTri(at(all[i], steps), at(all[j], steps), at(all[k], steps))
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return finalize(g, Math.PI / 7)
}

/** Remove consecutive (and wrap-around) duplicate points. */
export function dedupe(pts: THREE.Vector2[], eps = 1e-9) {
  const out: THREE.Vector2[] = []
  for (const p of pts) if (!out.length || out[out.length - 1].distanceTo(p) > eps) out.push(p)
  while (out.length > 2 && out[0].distanceTo(out[out.length - 1]) <= eps) out.pop()
  return out
}

/* ------------------------------ Gears ------------------------------ */

export interface GearSpec {
  teeth: number
  /** module, m (pitch diameter / teeth) */
  module: number
  /** face width */
  width: number
  pressureAngleDeg?: number
  /** bore radius (0 = solid) */
  bore?: number
  /** helix angle (deg); positive = right hand */
  helixDeg?: number
  /** points per involute flank */
  flankPoints?: number
}

const inv = (a: number) => Math.tan(a) - a

/** Involute external gear outline (CCW), tooth 0 centred on +X. */
export function gearOutline(teeth: number, m: number, pressureAngleDeg = 20, opts: { ra?: number; rf?: number; flankPoints?: number } = {}) {
  const phi = (pressureAngleDeg * Math.PI) / 180
  const r = (m * teeth) / 2
  const rb = r * Math.cos(phi)
  let ra = opts.ra ?? r + m
  const rf = opts.rf ?? r - 1.25 * m
  const nF = opts.flankPoints ?? 8
  const halfPitch = Math.PI / (2 * teeth) + inv(phi)
  const psi = (rr: number) => {
    const rEff = Math.max(rr, rb)
    return halfPitch - inv(Math.acos(rb / rEff))
  }
  const pts: THREE.Vector2[] = []
  const polar = (rad: number, ang: number) => new THREE.Vector2(rad * Math.cos(ang), rad * Math.sin(ang))
  const rStart = Math.max(rf, rb)
  // a tooth that would come to a point before the tip circle is truncated where its flanks meet
  let raEff = ra
  while (psi(raEff) < 0 && raEff > rStart) raEff -= (ra - rStart) / 200
  ra = raEff
  for (let i = 0; i < teeth; i++) {
    const a = (2 * Math.PI * i) / teeth
    // root fillet approx: start at rf on the lower flank line
    pts.push(polar(rf, a - psi(rStart)))
    // lower flank (rising)
    for (let k = 0; k <= nF; k++) {
      const rr = rStart + ((ra - rStart) * k) / nF
      pts.push(polar(rr, a - psi(rr)))
    }
    // tip
    const tipHalf = psi(ra)
    if (tipHalf > 0) pts.push(polar(ra, a))
    // upper flank (descending)
    for (let k = nF; k >= 0; k--) {
      const rr = rStart + ((ra - rStart) * k) / nF
      pts.push(polar(rr, a + psi(rr)))
    }
    pts.push(polar(rf, a + psi(rStart)))
    // root arc to the next tooth
    const aNext = (2 * Math.PI * (i + 1)) / teeth - psi(rStart)
    const aFrom = a + psi(rStart)
    const nRoot = 3
    for (let k = 1; k < nRoot; k++) pts.push(polar(rf, aFrom + ((aNext - aFrom) * k) / nRoot))
  }
  return pts
}

function circlePoints(r: number, n = 48, cw = false) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const a = ((cw ? -1 : 1) * 2 * Math.PI * i) / n
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/** External spur/helical gear, axis along Z. */
export function gear(spec: GearSpec) {
  const outline = gearOutline(spec.teeth, spec.module, spec.pressureAngleDeg, { flankPoints: spec.flankPoints })
  const holes = spec.bore ? [circlePoints(spec.bore, 40, true)] : []
  const r = (spec.module * spec.teeth) / 2
  const twist = spec.helixDeg ? (spec.width * Math.tan((spec.helixDeg * Math.PI) / 180)) / r : 0
  return extrudeTwisted(outline, holes, spec.width, twist, twist ? 8 : 1)
}

/** Internal (ring/annulus) gear: teeth point inward. Axis along Z. */
export function ringGear(spec: GearSpec & { rimOuter: number }) {
  const r = (spec.module * spec.teeth) / 2
  // tooth spaces of an internal gear have the shape of external gear teeth
  const space = gearOutline(spec.teeth, spec.module, spec.pressureAngleDeg, { ra: r + 1.25 * spec.module, rf: r - spec.module, flankPoints: spec.flankPoints })
  const outer = circlePoints(spec.rimOuter, 96)
  const twist = spec.helixDeg ? (spec.width * Math.tan((spec.helixDeg * Math.PI) / 180)) / r : 0
  return extrudeTwisted(outer, [space.slice().reverse()], spec.width, -twist, twist ? 8 : 1)
}

export const pitchRadius = (teeth: number, module: number) => (teeth * module) / 2

/* ------------------------------ Pipes, springs ------------------------------ */

/** Hollow (or solid when inner = 0) pipe along a curve, with end faces built from the tube's own end rings (watertight). */
export function pipe(curve: THREE.Curve<THREE.Vector3>, outer: number, inner: number, tubular = 48, radial = 20) {
  const o = new THREE.TubeGeometry(curve, tubular, outer, radial, false)
  orientTube(o, curve, true)
  const parts: THREE.BufferGeometry[] = [stripToPosition(o)]
  const ring = (g: THREE.BufferGeometry, ringIndex: number) => {
    const pos = g.getAttribute('position')
    const pts: THREE.Vector3[] = []
    for (let j = 0; j < radial; j++) pts.push(new THREE.Vector3().fromBufferAttribute(pos, ringIndex * (radial + 1) + j))
    return pts
  }
  let innerTube: THREE.TubeGeometry | null = null
  if (inner > 0) {
    innerTube = new THREE.TubeGeometry(curve, tubular, inner, radial, false)
    orientTube(innerTube, curve, false)
    parts.push(stripToPosition(innerTube))
  }
  const capPositions: number[] = []
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => capPositions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  for (const end of [0, tubular]) {
    const outerRing = ring(o, end)
    const tangent = curve.getTangentAt(end === 0 ? 0 : 1)
    const facing = end === 0 ? tangent.clone().negate() : tangent
    const centre = curve.getPointAt(end === 0 ? 0 : 1)
    const emit = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const n = b.clone().sub(a).cross(c.clone().sub(a))
      if (n.dot(facing) >= 0) tri(a, b, c)
      else tri(a, c, b)
    }
    for (let j = 0; j < radial; j++) {
      const a = outerRing[j]
      const b = outerRing[(j + 1) % radial]
      if (innerTube) {
        const innerRing = ring(innerTube, end)
        const c = innerRing[(j + 1) % radial]
        const d = innerRing[j]
        emit(a, b, c)
        emit(a, c, d)
      } else {
        emit(centre, a, b)
      }
    }
  }
  const caps = new THREE.BufferGeometry()
  caps.setAttribute('position', new THREE.Float32BufferAttribute(capPositions, 3))
  parts.push(caps)
  return finalize(mergeGeometries(parts, false)!, Math.PI / 4)
}

/**
 * TubeGeometry's winding follows its Frenet frames, which can be left-handed for some curves.
 * Make the faces point away from the curve (outward) or towards it (inward, for the bore).
 */
function orientTube(g: THREE.BufferGeometry, curve: THREE.Curve<THREE.Vector3>, outward: boolean) {
  const idx = g.index!
  const pos = g.getAttribute('position')
  const a = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(0))
  const b = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(1))
  const c = new THREE.Vector3().fromBufferAttribute(pos, idx.getX(2))
  const n = b.clone().sub(a).cross(c.clone().sub(a))
  const centroid = a.clone().add(b).add(c).multiplyScalar(1 / 3)
  // nearest curve point to the first triangle (it lies on the first segment)
  let best = curve.getPointAt(0)
  let bestD = Infinity
  for (let i = 0; i <= 8; i++) {
    const p = curve.getPointAt(i / 400)
    const d = p.distanceToSquared(centroid)
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  const pointsOut = n.dot(centroid.clone().sub(best)) > 0
  if (pointsOut !== outward) flipFaces(g)
}

function stripToPosition(g: THREE.BufferGeometry) {
  const ng = g.index ? g.toNonIndexed() : g.clone()
  for (const name of Object.keys(ng.attributes)) if (name !== 'position') ng.deleteAttribute(name)
  return ng
}

function flipFaces(g: THREE.BufferGeometry) {
  const idx = g.index
  if (idx) {
    const a = idx.array as Uint16Array | Uint32Array
    for (let i = 0; i < a.length; i += 3) {
      const t = a[i + 1]
      a[i + 1] = a[i + 2]
      a[i + 2] = t
    }
    idx.needsUpdate = true
  }
}

/** Closed-coil helical spring along Y from y=0 to y=length. Ends are capped. */
export function helixSpring(coilRadius: number, wireRadius: number, length: number, turns: number) {
  class Helix extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super()
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = t * turns * Math.PI * 2
      return target.set(coilRadius * Math.cos(a), t * length, coilRadius * Math.sin(a))
    }
  }
  return pipe(new Helix(), wireRadius, 0, Math.max(64, Math.round(turns * 32)), 10)
}

/* ------------------------------ Cams ------------------------------ */

/**
 * Cam outline for a flat-faced follower from its lift function. h(φ) = base + lift(φ) is the
 * support function; the contact point is (h cosφ − h′ sinφ, h sinφ + h′ cosφ).
 * φ is measured from the follower axis (+Y) in the cam's rotation sense.
 */
export function camOutline(base: number, lift: (phi: number) => number, n = 180) {
  const pts: THREE.Vector2[] = []
  const d = 1e-4
  for (let i = 0; i < n; i++) {
    const phi = (2 * Math.PI * i) / n
    const h = base + lift(phi)
    const hp = (lift(phi + d) - lift(phi - d)) / (2 * d)
    // follower axis is +Y at φ=0; rotate frame so φ=0 → +Y
    const x = h * Math.cos(phi) - hp * Math.sin(phi)
    const y = h * Math.sin(phi) + hp * Math.cos(phi)
    pts.push(new THREE.Vector2(-y, x))
  }
  return pts
}

export function cam(base: number, lift: (phi: number) => number, width: number, bore = 0) {
  const outline = camOutline(base, lift)
  return extrudeTwisted(outline, bore ? [circlePoints(bore, 32, true)] : [], width)
}

/* ------------------------------ CSG ------------------------------ */

const evaluator = new Evaluator()
evaluator.attributes = ['position', 'normal', 'uv']
evaluator.useGroups = false

function brush(g: THREE.BufferGeometry, m?: THREE.Matrix4) {
  const b = new Brush(g)
  if (m) {
    b.applyMatrix4(m)
  }
  b.updateMatrixWorld()
  return b
}

export type CsgOp = { op: 'add' | 'sub' | 'and'; geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4 }

/** Apply a sequence of boolean operations to a base solid. */
export function csg(base: THREE.BufferGeometry, ops: CsgOp[]) {
  let acc = brush(base)
  for (const o of ops) {
    const b = brush(o.geometry, o.matrix)
    const op = o.op === 'add' ? ADDITION : o.op === 'sub' ? SUBTRACTION : INTERSECTION
    acc = evaluator.evaluate(acc, b, op) as Brush
  }
  return finalize(acc.geometry, Math.PI / 5)
}

export const mat4 = {
  t: (x: number, y: number, z: number) => new THREE.Matrix4().makeTranslation(x, y, z),
  rx: (a: number) => new THREE.Matrix4().makeRotationX(a),
  ry: (a: number) => new THREE.Matrix4().makeRotationY(a),
  rz: (a: number) => new THREE.Matrix4().makeRotationZ(a),
  /** compose: applies right-most first */
  c: (...ms: THREE.Matrix4[]) => ms.reduce((acc, m) => acc.multiply(m), new THREE.Matrix4()),
}

/** Transform a geometry (returns a clone). */
export function xform(g: THREE.BufferGeometry, m: THREE.Matrix4) {
  const c = g.clone()
  c.applyMatrix4(m)
  return c
}

/** Merge solids that never overlap into one geometry (one draw call). */
export function merge(...gs: THREE.BufferGeometry[]) {
  return finalize(mergeGeometries(gs.map(stripToPosition), false)!, Math.PI / 5)
}
