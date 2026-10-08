import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { dedupe, extrudeTwisted, finalize, gearOutline, lathe, merge, type V2 } from './index'

/**
 * Shared machine-part generators (bevel gears, splines, sprockets, belts & chains, tyres,
 * fasteners). All solids are closed and outward-facing, like everything in ./index.
 */

const { PI } = Math

function circlePts(r: number, n = 48, cw = false) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const a = ((cw ? -1 : 1) * 2 * PI * i) / n
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  return pts
}

/* ------------------------------ Loft ------------------------------ */

export interface LoftStation {
  /** position along Z */
  z: number
  /** scale applied to the outer contour */
  scale: number
  /** rotation of the outer contour about Z (rad) */
  twist?: number
}

/**
 * Loft a contour through stations along Z (scaling/twisting the outer contour). Holes are
 * NOT scaled, so a bore stays a constant size — used for bevel gears.
 */
export function loft(contour: THREE.Vector2[], holes: THREE.Vector2[][], stations: LoftStation[]): THREE.BufferGeometry {
  contour = dedupe(contour)
  holes = holes.map(dedupe)
  if (THREE.ShapeUtils.isClockWise(contour)) contour = contour.slice().reverse()
  holes = holes.map((h) => (THREE.ShapeUtils.isClockWise(h) ? h : h.slice().reverse()))
  const pos: number[] = []
  const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)
  const outerAt = (p: THREE.Vector2, s: LoftStation) => {
    const t = s.twist ?? 0
    const x = p.x * s.scale
    const y = p.y * s.scale
    return new THREE.Vector3(x * Math.cos(t) - y * Math.sin(t), x * Math.sin(t) + y * Math.cos(t), s.z)
  }
  const holeAt = (p: THREE.Vector2, s: LoftStation) => new THREE.Vector3(p.x, p.y, s.z)
  // walls
  const wall = (loop: THREE.Vector2[], at: (p: THREE.Vector2, s: LoftStation) => THREE.Vector3) => {
    for (let k = 0; k < stations.length - 1; k++) {
      for (let i = 0; i < loop.length; i++) {
        const p0 = loop[i]
        const p1 = loop[(i + 1) % loop.length]
        const a = at(p0, stations[k])
        const b = at(p1, stations[k])
        const c = at(p1, stations[k + 1])
        const d = at(p0, stations[k + 1])
        // stations may run in −Z; keep outward winding
        if (stations[k + 1].z >= stations[k].z) {
          tri(a, b, c)
          tri(a, c, d)
        } else {
          tri(a, c, b)
          tri(a, d, c)
        }
      }
    }
  }
  wall(contour, outerAt)
  holes.forEach((h) => wall(h, holeAt))
  // caps — triangulate each end with its own (scaled) contour
  for (const [s, up] of [
    [stations[0], false],
    [stations[stations.length - 1], true],
  ] as const) {
    const scaled = contour.map((p) => new THREE.Vector2(p.x * s.scale, p.y * s.scale))
    const all = [...scaled, ...holes.flat()]
    const tris = THREE.ShapeUtils.triangulateShape(scaled.slice(), holes.map((h) => h.slice()))
    const facingUp = up === stations[stations.length - 1].z >= stations[0].z
    for (let [i, j, k] of tris) {
      const A = all[i]
      const B = all[j]
      const C = all[k]
      if ((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x) < 0) [j, k] = [k, j]
      const P = (idx: number) => (idx < scaled.length ? outerAt(contour[idx], s) : holeAt(all[idx], s))
      if (facingUp) tri(P(i), P(j), P(k))
      else tri(P(i), P(k), P(j))
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  return finalize(g, PI / 7)
}

/* ------------------------------ Bevel gears ------------------------------ */

export interface BevelSpec {
  teeth: number
  /** module at the large (outer) end */
  module: number
  faceWidth: number
  /** pitch cone half-angle, degrees. For a 90° pair: tan γ1 = z1/z2 */
  pitchAngleDeg: number
  bore?: number
  /** spiral/helical twist over the face (rad) — 0 for straight bevel */
  twist?: number
}

/**
 * Straight (or skewed) bevel gear. Axis along +Z, apex on +Z. The large end sits at z = 0
 * and the teeth taper towards the apex over the face width (Tredgold approximation).
 */
export function bevelGear(spec: BevelSpec) {
  const g = (spec.pitchAngleDeg * PI) / 180
  const R = (spec.module * spec.teeth) / 2
  const A = R / Math.sin(g) // cone distance
  const outline = gearOutline(spec.teeth, spec.module, 20, { flankPoints: 5 })
  const steps = 4
  const stations: LoftStation[] = []
  for (let i = 0; i <= steps; i++) {
    const f = (spec.faceWidth * i) / steps
    stations.push({ z: f * Math.cos(g), scale: (A - f) / A, twist: ((spec.twist ?? 0) * i) / steps })
  }
  const holes = spec.bore ? [circlePts(spec.bore, 32, true)] : []
  return loft(outline, holes, stations)
}

/** Pitch-cone angles (deg) for a bevel pair on shafts at 90°. */
export function bevelPair(z1: number, z2: number) {
  const g1 = (Math.atan2(z1, z2) * 180) / PI
  return { pinion: g1, gear: 90 - g1 }
}

/* ------------------------------ Splines ------------------------------ */

/** Straight-sided splined shaft along Y (e.g. PTO stub: 6 splines Ø35, 21 splines Ø44). */
export function splineShaft(splines: number, outerR: number, rootR: number, length: number, toothFrac = 0.45) {
  const pts: THREE.Vector2[] = []
  const pitch = (2 * PI) / splines
  const half = (pitch * toothFrac) / 2
  for (let i = 0; i < splines; i++) {
    const c = i * pitch
    const arc = (r: number, a0: number, a1: number, n: number) => {
      for (let k = 0; k <= n; k++) {
        const a = a0 + ((a1 - a0) * k) / n
        pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
      }
    }
    arc(outerR, c - half, c + half, 3)
    arc(rootR, c + half + 0.0001, c + pitch - half - 0.0001, 4)
  }
  const g = extrudeTwisted(pts, [], length)
  g.rotateX(-PI / 2)
  return g
}

/* ------------------------------ Sprockets & chains ------------------------------ */

/** Roller-chain sprocket (axis along Z). Pitch p, roller diameter d. */
export function sprocket(teeth: number, pitch: number, rollerD: number, width: number, bore = 0) {
  const R = pitch / (2 * Math.sin(PI / teeth)) // pitch circle radius
  const rs = rollerD / 2 + 0.0004 // seat radius
  const tipR = R + rollerD * 0.55
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < teeth; i++) {
    const c = (2 * PI * i) / teeth
    // concave roller seat centred on the pitch circle: trace its inner half (towards the
    // sprocket centre), from the clockwise side round to the counter-clockwise side
    const cx = R * Math.cos(c)
    const cy = R * Math.sin(c)
    for (let k = 0; k <= 8; k++) {
      const phi = c - PI / 2 - (PI * k) / 8
      pts.push(new THREE.Vector2(cx + rs * Math.cos(phi), cy + rs * Math.sin(phi)))
    }
    // tooth tip between this seat and the next
    const mid = c + PI / teeth
    pts.push(new THREE.Vector2(tipR * Math.cos(mid - 0.12 / teeth), tipR * Math.sin(mid - 0.12 / teeth)))
    pts.push(new THREE.Vector2(tipR * Math.cos(mid + 0.12 / teeth), tipR * Math.sin(mid + 0.12 / teeth)))
  }
  const holes = bore ? [circlePts(bore, 32, true)] : []
  return extrudeTwisted(pts, holes, width)
}

/** Pitch radius of a sprocket. */
export const sprocketRadius = (teeth: number, pitch: number) => pitch / (2 * Math.sin(PI / teeth))

/**
 * Closed path around two pulleys/sprockets (in the XY plane). Returns the curve and wrap angles.
 * Tangent points sit at ±(90° − β) from the centre line: open belt sin β = (R − r)/C,
 * crossed belt sin β = (R + r)/C (AEE503 Module 4).
 */
export function loopPath(c1: THREE.Vector2, r1: number, c2: THREE.Vector2, r2: number, crossed = false) {
  const d = c2.clone().sub(c1)
  const L = d.length()
  const base = Math.atan2(d.y, d.x)
  const path = new THREE.CurvePath<THREE.Vector3>()
  const v3 = (p: THREE.Vector2) => new THREE.Vector3(p.x, p.y, 0)
  const at = (c: THREE.Vector2, r: number, a: number) => new THREE.Vector2(c.x + r * Math.cos(a), c.y + r * Math.sin(a))
  /** arc from a0 to a1 (either direction) */
  const arc = (c: THREE.Vector2, r: number, a0: number, a1: number) => {
    const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * 32) / PI))
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= n; i++) pts.push(v3(at(c, r, a0 + ((a1 - a0) * i) / n)))
    for (let i = 0; i < n; i++) path.add(new THREE.LineCurve3(pts[i], pts[i + 1]))
  }
  if (!crossed) {
    const beta = Math.asin((r1 - r2) / L)
    const phi = PI / 2 - beta
    const up = base + phi
    const dn = base - phi
    // far side of pulley 2, top span, far side of pulley 1, bottom span
    arc(c2, r2, dn, up)
    path.add(new THREE.LineCurve3(v3(at(c2, r2, up)), v3(at(c1, r1, up))))
    arc(c1, r1, up, dn + 2 * PI)
    path.add(new THREE.LineCurve3(v3(at(c1, r1, dn)), v3(at(c2, r2, dn))))
    return { path, wrap1: PI + 2 * beta, wrap2: PI - 2 * beta, length: path.getLength() }
  }
  // crossed belt: the spans cross between the pulleys; the pulleys turn in opposite senses
  const beta = Math.asin((r1 + r2) / L)
  const phi = PI / 2 - beta
  arc(c1, r1, base + phi, base - phi + 2 * PI) // far side of pulley 1, counter-clockwise
  path.add(new THREE.LineCurve3(v3(at(c1, r1, base - phi)), v3(at(c2, r2, base - phi + PI))))
  arc(c2, r2, base + PI / 2 + beta, base - PI / 2 - beta) // far side of pulley 2, clockwise
  path.add(new THREE.LineCurve3(v3(at(c2, r2, base + phi + PI)), v3(at(c1, r1, base + phi))))
  const wrap = PI + 2 * beta
  return { path, wrap1: wrap, wrap2: wrap, length: path.getLength() }
}

/** A flat belt (or V-belt band) swept along a closed path in the XY plane, thickness outward. */
export function beltBand(path: THREE.Curve<THREE.Vector3>, width: number, thickness: number, samples = 240) {
  const pts = path.getSpacedPoints(samples).slice(0, -1)
  const n = pts.length
  // per-point outward normal in the XY plane (perpendicular to the tangent)
  const outer: THREE.Vector2[] = []
  const inner: THREE.Vector2[] = []
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    area += a.x * b.y - b.x * a.y
  }
  const ccw = area > 0
  for (let i = 0; i < n; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % n]
    const o = pts[(i - 1 + n) % n]
    const t = new THREE.Vector2(q.x - o.x, q.y - o.y).normalize()
    const nrm = ccw ? new THREE.Vector2(t.y, -t.x) : new THREE.Vector2(-t.y, t.x)
    outer.push(new THREE.Vector2(p.x, p.y).addScaledVector(nrm, thickness / 2))
    inner.push(new THREE.Vector2(p.x, p.y).addScaledVector(nrm, -thickness / 2))
  }
  // ring cross-section: outer loop CCW, inner loop as a hole
  const outerLoop = ccw ? outer : outer.slice().reverse()
  const innerLoop = ccw ? inner.slice().reverse() : inner
  return extrudeTwisted(outerLoop, [innerLoop], width)
}

/** One roller-chain link pair (pin link + roller) of pitch p, centred on the origin along X. */
export function chainLink(pitch: number, rollerD: number, width: number) {
  const plateH = rollerD * 1.25
  const plate = new THREE.Shape()
  const r = plateH / 2
  plate.absarc(-pitch / 2, 0, r, PI / 2, (3 * PI) / 2, false)
  plate.lineTo(pitch / 2, -r * 0.8)
  plate.absarc(pitch / 2, 0, r, -PI / 2, PI / 2, false)
  plate.lineTo(-pitch / 2, r * 0.8)
  const t = width * 0.14
  const mk = (z: number) => {
    const g = new THREE.ExtrudeGeometry(plate, { depth: t, bevelEnabled: false, curveSegments: 12 })
    g.translate(0, 0, z)
    return g
  }
  const roller = new THREE.CylinderGeometry(rollerD / 2, rollerD / 2, width - 2 * t, 20)
  roller.rotateX(PI / 2)
  roller.translate(-pitch / 2, 0, 0)
  const pin = new THREE.CylinderGeometry(rollerD * 0.2, rollerD * 0.2, width + 0.002, 12)
  pin.rotateX(PI / 2)
  pin.translate(-pitch / 2, 0, 0)
  return merge(finalize(mk(-width / 2)), finalize(mk(width / 2 - t)), finalize(roller), finalize(pin))
}

/* ------------------------------ Tyres & wheels ------------------------------ */

export interface TyreSpec {
  /** overall radius */
  radius: number
  /** section width */
  width: number
  /** rim radius (bead seat) */
  rimRadius: number
  /** number of lug bars per side (0 = smooth / rib tyre) */
  lugs?: number
  /** lug angle to the axis, degrees (R-1 bar tread ≈ 45°) */
  lugAngleDeg?: number
  lugHeight?: number
  /** 'R1' agricultural drive tyre, 'F2' steering rib tyre */
  pattern?: 'R1' | 'F2' | 'smooth'
}

/**
 * Tractor tyre, axis along Y (rotate to suit). Carcass is a revolved section; R-1 tyres get
 * chevron lug bars, F-2 tyres get circumferential ribs.
 */
export function tyre(spec: TyreSpec) {
  const { radius: R, width: W, rimRadius: r0 } = spec
  const pattern = spec.pattern ?? 'R1'
  const lugH = spec.lugHeight ?? (pattern === 'R1' ? 0.06 * (R - r0) + 0.015 : 0.01)
  const Rc = R - (pattern === 'R1' ? lugH : 0) // carcass crown radius
  const h = Rc - r0
  const hw = W / 2
  // super-ellipse section, truncated at the bead seat r = r0
  const rc = r0 + 0.35 * h
  const a = 0.65 * h
  const p = 2.6
  const sp = (v: number) => Math.sign(v) * Math.pow(Math.abs(v), 2 / p)
  const rAt = (t: number) => rc + a * sp(Math.cos(t))
  let tc = PI / 2
  while (rAt(tc) > r0 && tc < PI) tc += 0.002
  const sec: V2[] = []
  const n = 40
  for (let i = 0; i <= n; i++) {
    const t = -tc + (2 * tc * i) / n
    sec.push([Math.max(r0, rAt(t)), hw * sp(Math.sin(t))])
  }
  const carcass = lathe(sec, 96)
  const parts = [carcass]
  if (pattern === 'R1' && (spec.lugs ?? 0) > 0) {
    const lugs = spec.lugs!
    const ang = ((spec.lugAngleDeg ?? 45) * PI) / 180
    const len = (hw * 0.92) / Math.cos(ang)
    const barW = ((2 * PI * Rc) / lugs) * 0.3
    const axial = new THREE.Vector3(0, 1, 0)
    for (const side of [-1, 1]) {
      for (let i = 0; i < lugs; i++) {
        const theta = (2 * PI * i) / lugs + (side > 0 ? PI / lugs : 0)
        const radial = new THREE.Vector3(Math.cos(theta), 0, Math.sin(theta))
        const tangential = new THREE.Vector3(-Math.sin(theta), 0, Math.cos(theta))
        const d = axial.clone().multiplyScalar(side * Math.cos(ang)).addScaledVector(tangential, Math.sin(ang)).normalize()
        const z = d.clone().cross(radial).normalize()
        const centre = radial.clone().multiplyScalar(Rc + lugH * 0.35).addScaledVector(axial, side * hw * 0.46).addScaledVector(tangential, (Math.sin(ang) * len) / 2 - (Math.sin(ang) * len) / 2)
        const bar = new THREE.BoxGeometry(len, lugH * 1.7, barW)
        bar.applyMatrix4(new THREE.Matrix4().makeBasis(d, radial, z).setPosition(centre))
        parts.push(finalize(bar))
      }
    }
  } else if (pattern === 'F2') {
    for (const y of [-0.22, 0, 0.22]) {
      parts.push(
        lathe(
          [
            [Rc - 0.006, y * W - 0.012],
            [Rc + lugH, y * W - 0.007],
            [Rc + lugH, y * W + 0.007],
            [Rc - 0.006, y * W + 0.012],
          ],
          96,
        ),
      )
    }
  }
  return parts.length === 1 ? carcass : merge(...parts)
}

/** Dished steel wheel rim + centre disc, axis along Y. */
export function rim(rimRadius: number, width: number, hubR = 0.08, dish = 0.04) {
  const hw = width / 2
  const ring = lathe(
    [
      [rimRadius - 0.012, -hw],
      [rimRadius + 0.012, -hw - 0.004],
      [rimRadius + 0.014, -hw + 0.008],
      [rimRadius, -hw + 0.012],
      [rimRadius - 0.004, hw - 0.012],
      [rimRadius + 0.014, hw - 0.008],
      [rimRadius + 0.012, hw + 0.004],
      [rimRadius - 0.012, hw],
      [rimRadius - 0.016, 0],
    ],
    64,
  )
  const disc = lathe(
    [
      [hubR * 0.5, dish - 0.006],
      [rimRadius - 0.014, -0.003],
      [rimRadius - 0.014, 0.005],
      [hubR * 0.5, dish + 0.004],
    ],
    48,
  )
  const hub = lathe([[hubR * 0.45, dish - 0.03], [hubR, dish - 0.03], [hubR, dish + 0.02], [hubR * 0.45, dish + 0.02]], 32)
  return merge(ring, disc, hub)
}

/* ------------------------------ Fasteners ------------------------------ */

/** Hex-head bolt along −Y from a head sitting on y = 0. */
export function hexBolt(d: number, length: number) {
  const s = d * 1.6
  const head = extrudeTwisted(circlePts(s / Math.sqrt(3), 6), [], d * 0.65)
  head.rotateX(-PI / 2)
  head.translate(0, d * 0.325, 0)
  const shank = new THREE.CylinderGeometry(d / 2, d / 2, length, 16)
  shank.translate(0, -length / 2, 0)
  return merge(head, finalize(shank))
}

/** Torus ring (e.g. O-ring, circlip) in the XY plane. */
export function torus(R: number, r: number, radial = 12, tubular = 48) {
  return finalize(new THREE.TorusGeometry(R, r, radial, tubular))
}

/** Merge geometries without re-finalising (all must share attribute sets). */
export function mergeRaw(gs: THREE.BufferGeometry[]) {
  return mergeGeometries(gs, false)!
}
