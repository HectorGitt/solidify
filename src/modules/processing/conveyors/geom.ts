import * as THREE from 'three'
import { extrude, extrudeTwisted, finalize, lathe, mat4, xform } from '@/geometry'

/**
 * Small geometry helpers shared by the processing scenes (conveyors, mills, separators, layout).
 * Everything here produces closed, outward-facing solids (see geom.test.ts).
 */

const { PI, cos, sin } = Math

/** Fast lookup of points / tangents along a curve by normalised arc length. */
export class PathTable {
  pts: THREE.Vector3[]
  tans: THREE.Vector3[]
  length: number
  constructor(curve: THREE.Curve<THREE.Vector3>, n = 600, closed = true) {
    this.pts = curve.getSpacedPoints(n)
    this.length = curve.getLength()
    const m = this.pts.length
    this.tans = this.pts.map((_, i) => {
      const a = this.pts[closed ? (i - 1 + m - 1) % (m - 1) : Math.max(0, i - 1)]
      const b = this.pts[closed ? (i + 1) % (m - 1) : Math.min(m - 1, i + 1)]
      return b.clone().sub(a).normalize()
    })
  }
  at(u: number, p: THREE.Vector3, t?: THREE.Vector3) {
    u = ((u % 1) + 1) % 1
    const f = u * (this.pts.length - 1)
    const i = Math.min(this.pts.length - 2, Math.floor(f))
    const k = f - i
    p.copy(this.pts[i]).lerp(this.pts[i + 1], k)
    if (t) t.copy(this.tans[i]).lerp(this.tans[i + 1], k).normalize()
    return p
  }
}

/** Signed volume of a triangle soup (positive when outward-facing). */
export function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : p.count
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let v = 0
  for (let i = 0; i < n; i += 3) {
    const i0 = idx ? idx.getX(i) : i
    const i1 = idx ? idx.getX(i + 1) : i + 1
    const i2 = idx ? idx.getX(i + 2) : i + 2
    a.fromBufferAttribute(p, i0)
    b.fromBufferAttribute(p, i1)
    c.fromBufferAttribute(p, i2)
    v += a.dot(b.cross(c)) / 6
  }
  return v
}

function flipIfInside(g: THREE.BufferGeometry) {
  if (signedVolume(g) >= 0) return g
  const idx = g.getIndex()!
  const arr = idx.array as Uint32Array
  for (let i = 0; i < arr.length; i += 3) {
    const t = arr[i + 1]
    arr[i + 1] = arr[i + 2]
    arr[i + 2] = t
  }
  idx.needsUpdate = true
  return g
}

/**
 * Sweep a closed cross-section round a closed planar (XY) loop. `section(i, p)` returns the same
 * number of (u, w) points every time: u across the band (world Z), w along the in-plane outward
 * normal. The section may change along the loop (e.g. a belt that troughs on the carrying run).
 * The result is a watertight torus-like ring.
 */
export function sweepRing(pts: THREE.Vector3[], section: (i: number, p: THREE.Vector3) => [number, number][]) {
  const n = pts.length
  // orientation of the loop decides which side is "outward"
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    area += a.x * b.y - b.x * a.y
  }
  const sgn = area > 0 ? 1 : -1
  const pos: number[] = []
  let k = 0
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const t = pts[(i + 1) % n].clone().sub(pts[(i - 1 + n) % n]).normalize()
    const nx = sgn * t.y
    const ny = -sgn * t.x
    const sec = section(i, p)
    k = sec.length
    for (const [u, w] of sec) pos.push(p.x + nx * w, p.y + ny * w, u)
  }
  const index: number[] = []
  for (let i = 0; i < n; i++) {
    const i2 = (i + 1) % n
    for (let j = 0; j < k; j++) {
      const j2 = (j + 1) % k
      const a = i * k + j
      const b = i2 * k + j
      const c = i2 * k + j2
      const d = i * k + j2
      index.push(a, b, c, a, c, d)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  flipIfInside(g)
  g.computeVertexNormals()
  return g
}

/** Closed outline of a polyline thickened by t (offset to one side). */
export function thickPolyline(pts: [number, number][], t: number): THREE.Vector2[] {
  const n = pts.length
  const off: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const a = new THREE.Vector2(...pts[Math.max(0, i - 1)])
    const b = new THREE.Vector2(...pts[Math.min(n - 1, i + 1)])
    const d = b.sub(a).normalize()
    off.push(new THREE.Vector2(pts[i][0] - d.y * t, pts[i][1] + d.x * t))
  }
  return [...pts.map((p) => new THREE.Vector2(...p)), ...off.reverse()]
}

/** Polygon (Vector2 list) → extruded prism of depth d along Z, centred on z = 0. */
export function prism(contour: THREE.Vector2[], depth: number) {
  return extrudeTwisted(contour, [], depth, 0, 1)
}

/** Square hopper (frustum) with a smaller outlet below: solid, use role housing. */
export function hopper(top: number, bottom: number, h: number, wall = 0.015) {
  // revolve with 4 segments → square section; 45° start so the sides face the axes
  const R = top / Math.SQRT2
  const r = bottom / Math.SQRT2
  const w = wall * Math.SQRT2
  return lathe(
    [
      [r - w, 0],
      [r, 0],
      [R, h],
      [R - w, h],
    ],
    4,
    PI / 4,
  )
}

/** Open-topped U trough (along X) of inner radius r, wall t, length L, with straight sides to height hs above the axis. */
export function uTrough(r: number, t: number, L: number, hs: number) {
  const s = new THREE.Shape()
  const N = 24
  s.moveTo(-r - t, hs)
  s.lineTo(-r - t, 0)
  for (let i = 0; i <= N; i++) {
    const a = PI + (i / N) * PI
    s.lineTo((r + t) * cos(a), (r + t) * sin(a))
  }
  s.lineTo(r + t, hs)
  s.lineTo(r, hs)
  for (let i = 0; i <= N; i++) {
    const a = 2 * PI - (i / N) * PI
    s.lineTo(r * cos(a), r * sin(a))
  }
  s.lineTo(-r, hs)
  s.closePath()
  // shape in (z, y), extruded along +Z then turned to run along X
  const g = extrude(s, L)
  return xform(g, mat4.ry(PI / 2))
}

/** Rectangular duct / casing shell (hollow box) along Y, open at both ends: w × d outer, wall t, height h. */
export function boxShell(w: number, d: number, h: number, t: number) {
  const s = new THREE.Shape()
  s.moveTo(-w / 2, -d / 2)
  s.lineTo(w / 2, -d / 2)
  s.lineTo(w / 2, d / 2)
  s.lineTo(-w / 2, d / 2)
  s.closePath()
  const hole = new THREE.Path()
  hole.moveTo(-w / 2 + t, -d / 2 + t)
  hole.lineTo(-w / 2 + t, d / 2 - t)
  hole.lineTo(w / 2 - t, d / 2 - t)
  hole.lineTo(w / 2 - t, -d / 2 + t)
  hole.closePath()
  s.holes.push(hole)
  // extrude along Z then stand it up along Y
  return xform(extrude(s, h), mat4.rx(-PI / 2))
}

/**
 * Screw-conveyor flight: a helicoid between radii rIn and rOut, axial thickness t, pitch p, length L,
 * along X centred on x = 0. Built as a twisted extrusion of an annular sector.
 */
export function screwFlight(rIn: number, rOut: number, p: number, L: number, t: number) {
  const span = (2 * PI * t) / p
  const N = 6
  const c: THREE.Vector2[] = []
  for (let i = 0; i <= N; i++) c.push(new THREE.Vector2(rOut * cos((i / N) * span), rOut * sin((i / N) * span)))
  for (let i = N; i >= 0; i--) c.push(new THREE.Vector2(rIn * cos((i / N) * span), rIn * sin((i / N) * span)))
  const turns = L / p
  const g = extrudeTwisted(c, [], L, 2 * PI * turns, Math.max(8, Math.round(turns * 48)))
  return finalize(xform(g, mat4.ry(PI / 2)), PI / 5)
}

/** Simple chevron arrow (flat prism) pointing +X, length l, width w, thickness t, lying in XZ. */
export function arrowSolid(l: number, w: number, t: number) {
  const hw = w / 2
  const head = Math.min(l * 0.45, w * 1.2)
  const c = [
    new THREE.Vector2(0, -hw * 0.4),
    new THREE.Vector2(l - head, -hw * 0.4),
    new THREE.Vector2(l - head, -hw),
    new THREE.Vector2(l, 0),
    new THREE.Vector2(l - head, hw),
    new THREE.Vector2(l - head, hw * 0.4),
    new THREE.Vector2(0, hw * 0.4),
  ]
  return xform(extrudeTwisted(c, [], t, 0, 1), mat4.rx(-PI / 2))
}
