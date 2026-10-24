import * as THREE from 'three'
import { box, cylinder, extrude, extrudeTwisted, finalize, gear, helixSpring, lathe, mat4, merge, roundedBox, tube, xform, type V2 } from '@/geometry'
import { beltBand, loopPath } from '@/geometry/parts'

/**
 * Shared parts library — crop-processing machinery: hoppers, trays, ducts, troughs, augers,
 * conveyor pulleys, idlers and belts, elevator buckets and casings, cyclones, rotary airlocks,
 * centrifugal fans, electric motors, gearboxes, leg stands, test sieves, screen-cleaner drives,
 * mills, drums, presses, vessels, and the palm-oil mill and preservation plant. Moved from the
 * processing scenes, which now call these. Worker-safe, no CSG; every solid is closed and
 * outward-facing.
 *
 * Common frames, unless a builder says otherwise:
 *   - "axis Z": a rotating part turns about local Z and is centred on the origin.
 *   - "axis Y": a vessel or hopper stands on local Y.
 *   - "axis X": a horizontal drum or trough runs along local X, centred on x = 0.
 */

const { PI, cos, sin } = Math
const ALONG_Z = mat4.rx(PI / 2) // Y-axis primitive → Z axis
const ALONG_X = mat4.rz(-PI / 2) // Y-axis primitive → X axis
const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const bxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => xform(box(w, h, d), at(x, y, z))

/* ============================== sweep / outline helpers ============================== */

function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position')
  const idx = g.getIndex()
  const n = idx ? idx.count : p.count
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  let v = 0
  for (let i = 0; i < n; i += 3) {
    a.fromBufferAttribute(p, idx ? idx.getX(i) : i)
    b.fromBufferAttribute(p, idx ? idx.getX(i + 1) : i + 1)
    c.fromBufferAttribute(p, idx ? idx.getX(i + 2) : i + 2)
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
 * normal. The section may change along the loop (a belt that troughs on the carrying run).
 * The result is a watertight torus-like ring.
 */
export function sweepRing(pts: THREE.Vector3[], section: (i: number, p: THREE.Vector3) => [number, number][]) {
  const n = pts.length
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
      index.push(i * k + j, i2 * k + j, i2 * k + j2, i * k + j, i2 * k + j2, i * k + j2)
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(index)
  flipIfInside(g)
  g.computeVertexNormals()
  return g
}

/** Closed outline of a polyline thickened by t (offset to its left). */
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

/** Polygon (Vector2 list) → prism of depth d along Z, centred on z = 0. */
export function prism(contour: THREE.Vector2[], depth: number) {
  return extrudeTwisted(contour, [], depth, 0, 1)
}

/* ============================== bulk handling: hoppers, trays, ducts ============================== */

export interface HopperSpec {
  /** side of the square mouth */
  top: number
  /** side of the square outlet */
  bottom: number
  h: number
  wall?: number
}

/** Square pyramidal hopper, open top and outlet. Axis Y: outlet at y = 0, mouth at y = h; sides face ±X, ±Z. */
export function hopper({ top, bottom, h, wall = 0.012 }: HopperSpec) {
  // a 4-segment lathe with a 45° start gives a square section whose sides face the axes
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

/** Open-topped rectangular tray (sieve box, wash trough, sump). Axis Y: floor on y = 0, w along X, d along Z. */
export function tray({ w, d, h, wall = 0.01, floor = wall }: { w: number; d: number; h: number; wall?: number; floor?: number }) {
  const parts = [bxAt(w, floor, d, 0, floor / 2, 0)]
  if (h > floor) {
    const hh = h - floor
    const y = floor + hh / 2
    parts.push(bxAt(w, hh, wall, 0, y, d / 2 - wall / 2), bxAt(w, hh, wall, 0, y, -d / 2 + wall / 2))
    parts.push(bxAt(wall, hh, d - 2 * wall, w / 2 - wall / 2, y, 0), bxAt(wall, hh, d - 2 * wall, -w / 2 + wall / 2, y, 0))
  }
  return merge(...parts)
}

/** Rectangular duct / casing shell (hollow box), open at both ends. Axis Y, centred: w × d outer, wall t, height h. */
export function boxShell({ w, d, h, t }: { w: number; d: number; h: number; t: number }) {
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
  return xform(extrude(s, h), mat4.rx(-PI / 2))
}

/** Open-topped U trough, axis X centred: inner radius r, wall t, length L, straight sides up to hs above the axis. */
export function uTrough({ r, t, L, hs }: { r: number; t: number; L: number; hs: number }) {
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
  return xform(extrude(s, L), mat4.ry(PI / 2))
}

/* ============================== augers ============================== */

/**
 * Screw-conveyor flight: a helicoid between radii rIn and rOut, axial thickness t, pitch p,
 * length L. Axis X, centred on x = 0. Built as a twisted extrusion of an annular sector.
 */
export function screwFlight({ rIn, rOut, pitch, L, t }: { rIn: number; rOut: number; pitch: number; L: number; t: number }) {
  const span = (2 * PI * t) / pitch
  const N = 6
  const c: THREE.Vector2[] = []
  for (let i = 0; i <= N; i++) c.push(new THREE.Vector2(rOut * cos((i / N) * span), rOut * sin((i / N) * span)))
  for (let i = N; i >= 0; i--) c.push(new THREE.Vector2(rIn * cos((i / N) * span), rIn * sin((i / N) * span)))
  const turns = L / pitch
  const g = extrudeTwisted(c, [], L, 2 * PI * turns, Math.max(8, Math.round(turns * 48)))
  return finalize(xform(g, mat4.ry(PI / 2)), PI / 5)
}

/**
 * Auger: flight, shaft and (for a ribbon flight) the arms that hold the ribbon off the shaft.
 * Axis X, centred. D flight diameter, d shaft diameter; the shaft is `shaftExtra` longer than L.
 */
export function auger({ D, d, pitch, L, t = 0.008, ribbon = false, shaftExtra = 0.4 }: { D: number; d: number; pitch: number; L: number; t?: number; ribbon?: boolean; shaftExtra?: number }) {
  const rIn = ribbon ? d / 2 + 0.35 * (D / 2 - d / 2) : d / 2
  const flight = screwFlight({ rIn, rOut: D / 2, pitch, L, t })
  const arms = ribbon
    ? merge(
        ...Array.from({ length: Math.floor(L / (pitch / 2)) }, (_, i) => {
          const x = -L / 2 + (i + 0.5) * (pitch / 2)
          const ang = (2 * PI * x) / pitch - PI / 2
          return xform(box(0.012, rIn - d / 2 + 0.01, 0.02), mat4.c(mat4.rx(ang), at(x, d / 2 + (rIn - d / 2) / 2, 0)))
        }),
      )
    : null
  const shaft = xform(cylinder(d / 2, L + shaftExtra, 24), mat4.rz(PI / 2))
  return { flight, arms, shaft }
}

/* ============================== belt conveyors ============================== */

/**
 * Crowned conveyor drum pulley (or belt roller) with its shaft. Axis Z, centred. `width` is the
 * crowned face; the rims chamfer down by `chamfer` over `edge` either side.
 */
export function conveyorPulley({ r, width, chamfer = 0.02, edge = 0.02, bore = 0.02, shaftR = 0.025, shaftLength = width + 0.5 }: { r: number; width: number; chamfer?: number; edge?: number; bore?: number; shaftR?: number; shaftLength?: number }) {
  const hw = width / 2
  const drum = xform(
    lathe(
      [
        [bore, -hw - edge],
        [r - chamfer, -hw - edge],
        [r, -hw],
        [r, hw],
        [r - chamfer, hw + edge],
        [bore, hw + edge],
      ],
      48,
    ),
    ALONG_Z,
  )
  const shaft = xform(cylinder(shaftR, shaftLength, 20), ALONG_Z)
  return { drum, shaft }
}

/**
 * Troughed belt round a head and a tail pulley at (∓c, 0), radius r, in the XY plane, width B
 * along Z, thickness t outward. Flat at the pulleys, troughed at angle `trough` (rad) by
 * three-roll idlers on the carrying (upper) run; the trough fades in over 0.45 m.
 */
export function troughedBelt({ c, r, B, t, trough, samples = 480 }: { c: number; r: number; B: number; t: number; trough: number; samples?: number }) {
  const lp = loopPath(new THREE.Vector2(-c, 0), r, new THREE.Vector2(c, 0), r)
  const pts = lp.path.getSpacedPoints(samples).slice(0, -1)
  const section = (_: number, q: THREE.Vector3): [number, number][] => {
    const k = q.y > 0 ? Math.max(0, Math.min(1, (c - Math.abs(q.x) - 0.08) / 0.45)) : 0
    const be = trough * k
    const ue = B / 6 + (B / 3) * cos(be)
    const we = (B / 3) * sin(be)
    return [
      [-ue, we + t],
      [-B / 6, t],
      [B / 6, t],
      [ue, we + t],
      [ue, we],
      [B / 6, 0],
      [-B / 6, 0],
      [-ue, we],
    ]
  }
  return sweepRing(pts, section)
}

/**
 * Idlers for a troughed belt of width B: three-roll carrying sets at stations `xs` (the set's
 * datum y = 0 is the belt's flat underside; the centre roll sits just below it) and flat return
 * rolls at `returnXs` (centred on y = 0). Rolls of radius ri, axis Z.
 */
export function troughingIdlers({ B, trough, xs, returnXs, ri = 0.045 }: { B: number; trough: number; xs: number[]; returnXs: number[]; ri?: number }) {
  const roll = cylinder(ri, B / 3 - 0.01, 20)
  const rollReturn = cylinder(ri, B * 1.05, 20)
  const sets: THREE.BufferGeometry[] = []
  for (const x of xs) {
    sets.push(xform(roll, mat4.c(at(x, -ri, 0), ALONG_Z)))
    for (const s of [-1, 1]) {
      const um = B / 6 + (B / 6) * cos(trough)
      const wm = (B / 6) * sin(trough)
      const cu = um + sin(trough) * ri + 0.005
      const cw = wm - cos(trough) * ri
      sets.push(xform(roll, mat4.c(at(x, cw, s * cu), mat4.rx(s * (PI / 2 - trough)))))
    }
  }
  return { carry: merge(...sets), ret: merge(...returnXs.map((x) => xform(rollReturn, mat4.c(at(x, 0, 0), ALONG_Z)))), ri }
}

/** Flat belt round two pulleys of radius r at a and b (XY plane), width along Z, thickness t centred on the path. */
export function flatBelt({ a, b, r, width, t, samples = 900 }: { a: [number, number]; b: [number, number]; r: number; width: number; t: number; samples?: number }) {
  const lp = loopPath(new THREE.Vector2(...a), r, new THREE.Vector2(...b), r)
  return beltBand(lp.path, width, t, samples)
}

/**
 * Elevator bucket of width w (along Z). Local: back on the belt at y ≈ 0, the bucket reaching
 * out along +Y (the belt's outward normal) with its lip towards −X.
 */
export function elevatorBucket({ w }: { w: number }) {
  const prof: [number, number][] = [
    [0.02, 0.004],
    [-0.12, 0.004],
    [-0.125, 0.06],
    [-0.095, 0.115],
    [-0.03, 0.15],
    [0.03, 0.16],
  ]
  const shell = prism(thickPolyline(prof, 0.006), w)
  const side = prism(
    prof.map(([x, y]) => new THREE.Vector2(x, y)),
    0.006,
  )
  return merge(shell, xform(side, at(0, 0, w / 2)), xform(side, at(0, 0, -w / 2)))
}

/**
 * Bucket-elevator casing as closed boxes: boot, two trunk legs and the head. Local: boot centred
 * on the origin, legs at x = ±legSpacing/2 rising from the boot top, head on the legs.
 */
export function elevatorCasing({ bootW, bootD, bootH, legW, legD, legH, legSpacing }: { bootW: number; bootD: number; bootH: number; legW: number; legD: number; legH: number; legSpacing: number }) {
  return {
    boot: box(bootW, bootH, bootD),
    leg1: bxAt(legW, legH, legD, -legSpacing / 2, bootH / 2 + legH / 2, 0),
    leg2: bxAt(legW, legH, legD, legSpacing / 2, bootH / 2 + legH / 2, 0),
    head: bxAt(bootW * 0.9, bootH * 0.8, bootD * 0.95, 0, bootH / 2 + legH + (bootH * 0.8) / 2, 0),
  }
}

/* ============================== drives ============================== */

/**
 * Totally enclosed fan-cooled electric motor. Axis Z, frame centred on the origin, the drive
 * shaft sticking out along +Z; cooling fins round the frame and the terminal box on top (+Y).
 * `feet` adds the foot plate under the frame.
 */
export function electricMotor({ r, length, feet = false }: { r: number; length: number; feet?: boolean }) {
  const L = length
  const rf = r * 0.92
  const body = xform(
    lathe(
      [
        [0, -L / 2],
        [r * 0.8, -L / 2],
        [rf, -L / 2 + 0.05 * L],
        [rf, L / 2 - 0.05 * L],
        [r * 0.85, L / 2],
        [r * 0.25, L / 2],
        [r * 0.25, L / 2 + 0.05 * L],
        [0, L / 2 + 0.05 * L],
      ],
      32,
    ),
    ALONG_Z,
  )
  const fins: THREE.BufferGeometry[] = []
  const nf = 12
  for (let i = 0; i < nf; i++) {
    const a = ((i + 0.5) / nf) * 2 * PI
    if (Math.abs(a - PI / 2) < 0.4) continue // under the terminal box
    fins.push(xform(box(r * 0.16, r * 0.06, L * 0.82), mat4.c(mat4.rz(a), at(rf, 0, 0))))
  }
  const terminal = bxAt(r * 0.6, r * 0.32, L * 0.32, 0, rf + r * 0.14, 0)
  const shaft = xform(cylinder(r * 0.14, L * 0.3, 16), mat4.c(at(0, 0, L / 2 + 0.05 * L + L * 0.15), ALONG_Z))
  const parts = [body, ...fins, terminal, shaft]
  if (feet) parts.push(bxAt(r * 1.6, r * 0.12, L * 0.7, 0, -rf - r * 0.06, 0), bxAt(r * 0.3, r * 0.3, L * 0.6, 0, -rf + r * 0.1, 0))
  return merge(...parts)
}

/** Reduction gearbox: a ribbed box w × h × d, centred, with shaft bosses on both Z faces. */
export function gearbox({ w, h, d, bossR = Math.min(w, h) * 0.22 }: { w: number; h: number; d: number; bossR?: number }) {
  const boss = (s: number) => xform(cylinder(bossR, d * 0.12, 24), mat4.c(at(0, 0, s * (d / 2 + d * 0.06)), ALONG_Z))
  const rib = (s: number) => bxAt(w * 1.04, h * 0.08, d * 0.9, 0, s * h * 0.3, 0)
  return merge(box(w, h, d), boss(1), boss(-1), rib(1), rib(-1))
}

/**
 * Leg stand: square legs of section `leg` at (±x, ±z), from y = y0 to y0 + h, with optional tie
 * rails at height `tieY` (above y0) round the four sides. `positions` overrides the leg spots.
 */
export function legStand({ x, z, h, leg = 0.05, y0 = 0, tieY, tie = leg * 0.8, positions }: { x: number; z: number; h: number; leg?: number; y0?: number; tieY?: number; tie?: number; positions?: [number, number][] }) {
  const pts = positions ?? [-1, 1].flatMap((sx) => [-1, 1].map((sz) => [sx * x, sz * z] as [number, number]))
  const parts = pts.map(([px, pz]) => bxAt(leg, h, leg, px, y0 + h / 2, pz))
  if (tieY !== undefined && !positions) {
    const y = y0 + tieY
    parts.push(bxAt(2 * x - leg, tie, tie, 0, y, z), bxAt(2 * x - leg, tie, tie, 0, y, -z))
    parts.push(bxAt(tie, tie, 2 * z - leg, x, y, 0), bxAt(tie, tie, 2 * z - leg, -x, y, 0))
  }
  return merge(...parts)
}

/* ============================== air handling ============================== */

/**
 * Centrifugal fan: spiral volute (scroll) with its outlet duct up +Y on the +X side, back plate,
 * front plate (+Z) with the inlet eye, and a radial-blade impeller. Axis Z, centred; the scroll
 * grows from r at the tongue to 1.3 r and the outlet mouth is at y = 1.3 r (`outletY`). The
 * impeller turns about Z.
 */
export function centrifugalFan({ r, width, blades = 8, wall = Math.max(0.006, r * 0.05), eyeR = r * 0.5, impellerR = (r - wall) * 0.9 }: { r: number; width: number; blades?: number; wall?: number; eyeR?: number; impellerR?: number }) {
  const N = 48
  const R = (th: number) => r * (1 + (0.3 * th) / (2 * PI))
  const spiral: [number, number][] = []
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * 2 * PI
    spiral.push([R(th) * cos(th), R(th) * sin(th)])
  }
  const top = R(2 * PI)
  // scroll and tongue sink half a wall into the side plates (overlap, never coincident faces)
  const inner = width - 2 * wall
  const scroll = prism(thickPolyline([...spiral, [top, top]], wall), inner + wall)
  const tongue = bxAt(wall, top - wall * 0.5, inner + wall, r + wall * 0.4, top / 2 + wall * 0.25, 0)
  // side plates: the spiral plus the outlet duct footprint
  const plate = (eye: boolean) => {
    const s = new THREE.Shape()
    spiral.forEach(([px, py], i) => (i ? s.lineTo(px, py) : s.moveTo(px, py)))
    s.lineTo(top, top)
    s.lineTo(r, top)
    s.closePath()
    if (eye) {
      const h = new THREE.Path()
      h.absarc(0, 0, eyeR, 0, 2 * PI, true)
      s.holes.push(h)
    }
    return extrude(s, wall, { curveSegments: 32 })
  }
  const housing = merge(scroll, tongue, xform(plate(false), at(0, 0, -width / 2 + wall / 2)), xform(plate(true), at(0, 0, width / 2 - wall / 2)))
  const bw = inner * 0.85
  const imp: THREE.BufferGeometry[] = [xform(cylinder(Math.max(0.02, impellerR * 0.2), bw, 20), ALONG_Z), xform(cylinder(impellerR, 0.006, 32), mat4.c(at(0, 0, -bw / 2 + 0.003), ALONG_Z))]
  for (let i = 0; i < blades; i++) imp.push(xform(box(impellerR * 0.78, Math.max(0.004, impellerR * 0.03), bw), mat4.c(mat4.rz((i * 2 * PI) / blades), at(impellerR * 0.6, 0, 0))))
  return { housing, impeller: merge(...imp), outletY: top }
}

/**
 * Cyclone collector. Axis Y: dust outlet (apex, radius rApex) at y = 0, cone up to hCone, barrel
 * (rBarrel) up to yTop = hCone + hBarrel; roof plate on top and the vortex finder (rFinder)
 * reaching `depth` down into the barrel and `above` up out of the roof.
 */
export function cyclone({ rBarrel, rApex, hBarrel, hCone, wall = 0.01, rFinder = rBarrel * 0.4, depth = hBarrel * 0.5, above = rFinder * 2.5 }: { rBarrel: number; rApex: number; hBarrel: number; hCone: number; wall?: number; rFinder?: number; depth?: number; above?: number }) {
  const yTop = hCone + hBarrel
  const body = lathe(
    [
      [rApex - wall, 0],
      [rApex, 0],
      [rBarrel, hCone],
      [rBarrel, yTop],
      [rBarrel - wall, yTop],
      [rBarrel - wall, hCone],
    ],
    36,
  )
  const roof = lathe(
    [
      [rFinder, yTop],
      [rBarrel, yTop],
      [rBarrel, yTop + wall],
      [rFinder, yTop + wall],
    ],
    36,
  )
  const finder = xform(vortexFinder({ r: rFinder, wall, length: depth + above }), at(0, yTop + (above - depth) / 2, 0))
  return { body, roof, finder, yTop }
}

/** Vortex-finder (gas outlet) tube, axis Y, centred. */
export function vortexFinder({ r, wall = 0.008, length }: { r: number; wall?: number; length: number }) {
  return tube(r, r - wall, length, 32)
}

/** Dust bin / drum under a cyclone: open-topped can, axis Y, base at y = 0. */
export function dustBin({ r, h, wall = 0.01 }: { r: number; h: number; wall?: number }) {
  return lathe(
    [
      [0.01, 0],
      [r, 0],
      [r, h],
      [r - wall, h],
      [r - wall, wall],
      [0.01, wall],
    ],
    32,
  )
}

/**
 * Rotary airlock (star) valve. Axis Z, centred: ring casing with inlet and outlet necks (up and
 * down along Y) and a rotor of `vanes` vanes on its shaft. The rotor turns about Z.
 */
export function rotaryValve({ r, width, vanes = 6 }: { r: number; width: number; vanes?: number }) {
  const neck = () => boxShell({ w: r * 1.3, d: width, h: r * 0.5, t: r * 0.1 })
  const casing = merge(xform(tube(r * 1.15, r * 1.04, width, 32), ALONG_Z), xform(neck(), at(0, r * 1.36, 0)), xform(neck(), at(0, -r * 1.36, 0)))
  const rotor: THREE.BufferGeometry[] = [xform(cylinder(Math.max(0.012, r * 0.18), width * 1.3, 16), ALONG_Z)]
  for (let i = 0; i < vanes; i++) rotor.push(xform(box(r * 2, Math.max(0.006, r * 0.06), width * 0.9), mat4.rz((i * PI) / vanes)))
  return { casing, rotor: merge(...rotor) }
}

/** Fluted feed roller, axis Z, centred: core of 0.9 r with `flutes` ribs out to r. */
export function feedRoller({ r, length, flutes = 12 }: { r: number; length: number; flutes?: number }) {
  const parts: THREE.BufferGeometry[] = [xform(cylinder(r * 0.9, length, 24), ALONG_Z)]
  for (let i = 0; i < flutes; i++) parts.push(xform(box(0.005, r * 0.2, length), mat4.c(mat4.rz((i * 2 * PI) / flutes), at(0, r * 0.9, 0))))
  return merge(...parts)
}

/* ============================== screens and sieves ============================== */

/**
 * Laboratory test sieve (IS / Tyler) of radius r: rim with a nesting lip, the wire-mesh floor,
 * and the blind pan floor for the bottom of the stack. Axis Y, all based on y = 0.
 */
export function testSieve({ r, h, wall = 0.005, lip = 0.004, mesh = 0.003, pan = 0.006 }: { r: number; h: number; wall?: number; lip?: number; mesh?: number; pan?: number }) {
  const rIn = r - wall
  const rim = lathe(
    [
      [rIn, 0],
      [r, 0],
      [r, h],
      [r + lip, h],
      [r + lip, h + 0.012],
      [r, h + 0.012],
      [rIn, h + 0.012],
    ],
    36,
  )
  return { rim, mesh: xform(cylinder(rIn, mesh, 36), at(0, mesh / 2, 0)), pan: xform(cylinder(rIn, pan, 36), at(0, pan / 2, 0)) }
}

/** Sieve-shaker motor base (pedestal). Axis Y, base at y = 0, table seat at y = h. */
export function shakerBase({ rBase, rTop, h }: { rBase: number; rTop: number; h: number }) {
  return lathe(
    [
      [0.01, 0],
      [rBase, 0],
      [rBase, 0.03],
      [rBase * 0.9, 0.06],
      [rTop * 1.1, h * 0.7],
      [rTop, h],
      [0.01, h],
    ],
    36,
  )
}

/** Sieve-stack clamping lid with centre knob, for sieves of radius r. Axis Y, base at y = 0. */
export function shakerLid({ r, h = 0.025 }: { r: number; h?: number }) {
  return lathe(
    [
      [0.01, 0],
      [r + 0.006, 0],
      [r + 0.006, 0.012],
      [r * 0.8, 0.016],
      [0.04, h],
      [0.01, h],
    ],
    36,
  )
}

/** Screen-cleaner box: side cheeks, head end and a tie. Centred; length along X, width along Z. */
export function screenBox({ len, width, height, wall = 0.02 }: { len: number; width: number; height: number; wall?: number }) {
  return merge(bxAt(len, height, wall, 0, 0, width / 2), bxAt(len, height, wall, 0, 0, -width / 2), bxAt(wall, height * 0.7, width, -len / 2 + wall / 2, height * 0.15, 0), bxAt(0.04, 0.04, width, 0, -height * 0.35, 0))
}

/** Flat screen deck / perforated plate, centred: len along X, width along Z. */
export function screenDeck({ len, width, t = 0.008 }: { len: number; width: number; t?: number }) {
  return box(len, t, width)
}

export { leafSpring } from './elements'

export { eccentricCrank } from './elements'

export { pitmanRod } from './elements'

/* ============================== mills ============================== */

/**
 * Hammer mill of chamber radius R. Axis Z, chamber centred: casing ring and back side plate, rotor
 * disc and shaft, one swinging hammer (pivot at x = 0, reaching +X) and the screen as bars round
 * the lower 270°, spaced by the screen hole size.
 */
export function hammerMill({ R = 0.32, screenHoleMm = 1.5 }: { R?: number; screenHoleMm?: number } = {}) {
  const gap = Math.min(0.02, Math.max(0.004, screenHoleMm * 0.004))
  const bars: THREE.BufferGeometry[] = []
  const nb = Math.round((1.5 * PI * R) / (0.008 + gap))
  for (let i = 0; i <= nb; i++) {
    const a = -PI / 4 - (i / nb) * 1.5 * PI
    bars.push(xform(box(0.006, 0.008, 0.28), mat4.c(at(R * cos(a), R * sin(a), 0), mat4.rz(a))))
  }
  return {
    casing: xform(tube(R + 0.06, R + 0.04, 0.32, 56), ALONG_Z),
    side: xform(cylinder(R + 0.06, 0.012, 56), ALONG_Z),
    disc: xform(cylinder(0.17, 0.012, 40), ALONG_Z),
    shaft: xform(cylinder(0.025, 0.7, 20), ALONG_Z),
    hammer: bxAt(0.12, 0.035, 0.012, 0.06, 0, 0),
    screen: merge(...bars),
  }
}

/** Spoked handwheel of rim radius r (rim 0.02 wide); axis X or Z, centred. */
export function handwheel({ r, axis = 'z' }: { r: number; axis?: 'x' | 'z' }) {
  const w = merge(xform(tube(r, r - 0.02, 0.02, 40), mat4.rz(PI / 2)), ...[0, 1, 2].map((i) => xform(box(0.01, 2 * r - 0.04, 0.012), mat4.rx((i * PI) / 3))))
  return axis === 'x' ? w : xform(w, mat4.ry(PI / 2))
}

/**
 * Burr (plate) mill. Axis X, the plates face each other across x = 0: the rotating grooved plate
 * (`rotPlate`, grooves facing +X), the stationary plate with the feed eye (`eye`), plate housing,
 * rotor shaft, feed auger, gap screw, gap spring and handwheel.
 */
export function burrMill() {
  const plate = merge(xform(cylinder(0.2, 0.03, 48), mat4.rz(PI / 2)), ...Array.from({ length: 24 }, (_, i) => xform(box(0.006, 0.14, 0.012), mat4.c(mat4.rx((i * 2 * PI) / 24), at(0.018, 0.12, 0)))))
  return {
    rotPlate: xform(plate, mat4.rz(PI)),
    eye: xform(tube(0.2, 0.05, 0.03, 48), mat4.rz(PI / 2)),
    housing: xform(tube(0.27, 0.24, 0.3, 48), mat4.rz(PI / 2)),
    shaft: xform(cylinder(0.022, 1.0, 20), mat4.rz(PI / 2)),
    auger: merge(...Array.from({ length: 12 }, (_, i) => xform(box(0.02, 0.06, 0.006), mat4.c(mat4.rx(i * 0.9), at(-0.05 - i * 0.02, 0.03, 0))))),
    screw: xform(cylinder(0.012, 0.3, 16), mat4.rz(PI / 2)),
    wheel: handwheel({ r: 0.12, axis: 'x' }),
    spring: xform(helixSpring(0.03, 0.005, 0.12, 6), mat4.rz(-PI / 2)),
  }
}

/** Roller-mill roll of radius r and face width; fluted rolls carry a 40-flute profile. Axis Z, centred. */
export function millRoll({ r, width, fluted }: { r: number; width: number; fluted: boolean }) {
  return fluted ? gear({ teeth: 40, module: (2 * r) / 40, width }) : xform(cylinder(r, width, 64), ALONG_Z)
}

/** Rasp (grater) drum: core with rasp bars round it. Axis Z, centred. */
export function raspDrum({ r = 0.14, length = 0.4, bars = 12 }: { r?: number; length?: number; bars?: number } = {}) {
  const g = merge(cylinder(r, length, 32), ...Array.from({ length: bars }, (_, i) => xform(box(0.02, length + 0.02, 0.03), mat4.c(mat4.ry((i / bars) * 2 * PI), at(r + 0.005, 0, 0)))))
  return xform(g, ALONG_Z)
}

/**
 * Rotating drum (peeler, washer, trieur, polishing drum): shell tube of radius r, wall t, length L,
 * axis X centred, and `ribs` lifter bars just inside the wall (null when ribs = 0).
 */
export function rotaryDrum({ r, t, L, ribs = 0, segments = 40 }: { r: number; t: number; L: number; ribs?: number; segments?: number }) {
  const shell = xform(tube(r, r - t, L, segments), mat4.rz(PI / 2))
  const bars = ribs ? merge(...Array.from({ length: ribs }, (_, i) => xform(box(L - 0.04, 0.025, 0.025), mat4.c(mat4.rx((i / ribs) * 2 * PI), at(0, r - t - 0.0125, 0))))) : null
  return { shell, ribs: bars }
}

/** Hexagonal screen cage of a rice whitener, inscribed radius r. Axis Y, centred. */
export function hexScreenCage({ r, height, wall = 0.006 }: { r: number; height: number; wall?: number }) {
  const R = r / cos(PI / 6)
  const w = wall / cos(PI / 6)
  return lathe(
    [
      [R - w, -height / 2],
      [R, -height / 2],
      [R, height / 2],
      [R - w, height / 2],
    ],
    6,
    PI / 6,
  )
}

/** Rubber roll sleeve of a paddy huller. Axis Z, centred. */
export function rubberRollSleeve({ outerR, innerR, length }: { outerR: number; innerR: number; length: number }) {
  return xform(tube(outerR, innerR, length, 32), ALONG_Z)
}

/* ============================== presses ============================== */

/**
 * Manual screw press (cassava dewatering): posts, crosshead and base (`frame`, base at y = 0,
 * posts at x = ±0.4), the screw (helix up +Y from y = 0) and the platen (centred).
 */
export function manualScrewPress() {
  return {
    frame: merge(bxAt(0.08, 1.5, 0.08, -0.4, 0.75, 0), bxAt(0.08, 1.5, 0.08, 0.4, 0.75, 0), bxAt(0.9, 0.1, 0.25, 0, 1.5, 0), bxAt(0.9, 0.12, 0.6, 0, 0.06, 0)),
    screw: helixSpring(0.035, 0.012, 0.7, 7),
    platen: box(0.7, 0.05, 0.5),
  }
}

/** Perforated strainer cage (barrel) of a screw press with feed hopper, flanges and oil sump. Axis X, centred. */
export function pressStrainerCage(length = 1.8, outerR = 0.28, innerR = 0.2) {
  const barrel = xform(tube(outerR, innerR, length, 36), ALONG_X)
  const feed = xform(hopper({ top: 0.45, bottom: 0.3, h: 0.45, wall: 0.02 }), at(-length / 2 + 0.28, outerR - 0.02, 0))
  const flange = (x: number) => xform(tube(outerR + 0.08, innerR, 0.08, 32), mat4.c(at(x, 0, 0), ALONG_X))
  const sumpH = 0.18
  const sump = xform(tray({ w: length * 0.95, d: outerR * 2.4, h: sumpH, wall: 0.02 }), at(0, -outerR - sumpH - 0.04, 0))
  return merge(barrel, feed, flange(-length / 2 + 0.04), flange(length / 2 - 0.04), sump, xform(cylinder(0.06, 0.25, 16), at(0.2, -outerR - sumpH - 0.16, 0)))
}

/** Tapered press screw with decreasing-pitch flights. Axis X, centred. */
export function pressScrewShaft(length = 1.8, dCage = 0.38) {
  const rIn = 0.05
  const rOut = 0.09
  const shaft = xform(
    lathe(
      [
        [0, -length / 2 - 0.3],
        [rIn, -length / 2 - 0.3],
        [rIn, -length / 2],
        [rOut, length / 2],
        [rOut, length / 2 + 0.25],
        [0, length / 2 + 0.25],
      ],
      30,
    ),
    ALONG_X,
  )
  const flights: THREE.BufferGeometry[] = []
  const nTurns = 7
  const flightR = dCage / 2 - 0.008
  for (let t = 0; t < nTurns; t++) {
    const frac = t / nTurns
    const x = -length / 2 + 0.12 + frac * (length - 0.28)
    const coreR = rIn + frac * (rOut - rIn)
    flights.push(xform(tube(flightR, coreR, 0.016, 32), mat4.c(at(x, 0, 0), mat4.ry(0.18 - frac * 0.06), ALONG_X)))
  }
  return merge(shaft, ...flights)
}

/**
 * Hydraulic choke cone with its ram cylinder, and the press's drive gearbox and motor behind it.
 * Axis X: cone base at x = 0, tip towards +X.
 */
export function pressHydraulicCone(coneR = 0.19, length = 0.35) {
  const cone = xform(
    lathe(
      [
        [0, length],
        [coneR * 0.5, length * 0.6],
        [coneR, 0],
        [coneR, -0.06],
        [coneR * 0.5, -0.06],
        [coneR * 0.5, -length * 1.5],
        [0, -length * 1.5],
      ],
      28,
    ),
    ALONG_X,
  )
  const ram = xform(tube(coneR * 0.85, coneR * 0.55, length * 1.6, 24), mat4.c(at(length * 1.6, 0, 0), ALONG_X))
  const gb = xform(gearbox({ w: 0.55, h: 0.65, d: 0.55 }), mat4.c(at(-1.3, 0, 0), mat4.ry(PI / 2)))
  const motor = xform(electricMotor({ r: 0.24, length: 0.6 }), mat4.c(at(-1.88, 0, 0), mat4.ry(PI / 2)))
  return merge(cone, ram, gb, motor)
}

/* ============================== vessels ============================== */

export interface PressureVesselSpec {
  r: number
  /** barrel length */
  length: number
  wall?: number
  /** depth of the dished heads */
  headDepth?: number
  rearHead?: boolean
  frontHead?: boolean
  /** flange round an open front end: radial width and axial thickness */
  flange?: { width: number; t: number }
  segments?: number
}

/**
 * Horizontal pressure vessel (autoclave, steriliser, retort): cylindrical barrel with elliptical
 * dished heads. Axis Z, barrel centred on the origin; rear head on −Z, front on +Z. An open
 * front end can carry the door flange.
 */
export function pressureVessel({ r, length, wall = 0.02, headDepth = r * 0.25, rearHead = true, frontHead = true, flange, segments = 32 }: PressureVesselSpec) {
  const N = 8
  const hl = length / 2
  const ri = Math.max(0.01, r - wall)
  const hi = Math.max(0.01, headDepth - wall)
  const pts: V2[] = []
  const quarter = (rad: number, depth: number, y: number, from: number, to: number) => {
    const out: V2[] = []
    for (let i = 0; i <= N; i++) {
      const a = from + ((to - from) * i) / N
      out.push([Math.max(0, cos(a) * rad), y + sin(a) * depth])
    }
    return out
  }
  if (rearHead) pts.push(...quarter(r, headDepth, -hl, -PI / 2, 0))
  else pts.push([r, -hl])
  if (frontHead) pts.push(...quarter(r, headDepth, hl, 0, PI / 2), ...quarter(ri, hi, hl, PI / 2, 0))
  else if (flange) pts.push([r, hl - flange.t], [r + flange.width, hl - flange.t], [r + flange.width, hl], [ri, hl])
  else pts.push([r, hl], [ri, hl])
  if (rearHead) pts.push(...quarter(ri, hi, -hl, 0, -PI / 2))
  else pts.push([ri, -hl])
  return xform(lathe(pts, segments), ALONG_Z)
}

/** Dished (elliptical) head or door dome on its own: axis Z, rim on z = 0, bulging towards −Z. */
export function dishedHead({ r, depth, wall = 0.03, segments = 48 }: { r: number; depth: number; wall?: number; segments?: number }) {
  const N = 8
  const pts: V2[] = []
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (PI / 2)
    pts.push([cos(a) * r, sin(a) * depth])
  }
  for (let i = N; i >= 0; i--) {
    const a = (i / N) * (PI / 2)
    pts.push([cos(a) * (r - wall), sin(a) * (depth - wall)])
  }
  // dome revolves about +Y; rx(−90°) lays it on Z bulging towards −Z
  return xform(lathe(pts, segments), mat4.rx(-PI / 2))
}

export interface ConeVesselSpec {
  r: number
  /** height of the cylindrical part, from y = 0 up */
  hCyl: number
  /** depth of the cone below y = 0 */
  hCone: number
  wall?: number
  /** outlet bore and outlet flange radius, and the outlet neck length */
  outletR: number
  outletFlangeR: number
  neck?: number
  /** top flange: radial width and thickness */
  flange?: number
  flangeT?: number
}

/**
 * Vertical vessel with a conical bottom (digester, clarifier, settling tank). Axis Y: cylinder
 * from y = 0 to hCyl, cone below to the outlet neck ending at y = −hCone − neck, top flange on hCyl.
 */
export function coneBottomVessel({ r, hCyl, hCone, wall = 0.04, outletR, outletFlangeR, neck = 0.1, flange = 0.08, flangeT = 0.06 }: ConeVesselSpec) {
  const rI = r - wall
  return lathe(
    [
      [outletR, -hCone - neck],
      [outletFlangeR, -hCone - neck],
      [outletFlangeR, -hCone],
      [r, 0],
      [r, hCyl],
      [r + flange, hCyl],
      [r + flange, hCyl + flangeT],
      [rI, hCyl + flangeT],
      [rI, hCyl],
      [rI, 0],
      [outletR, -hCone],
    ],
    36,
  )
}

/* ============================== palm-oil mill ============================== */

/** Horizontal steriliser: dished rear head, barrel and front door flange. Axis X, the door end on +X. */
export function steriliserVessel(length = 3.8, radius = 0.9, wall = 0.05) {
  return xform(pressureVessel({ r: radius, length, wall, headDepth: 0.22, frontHead: false, flange: { width: 0.08, t: 0.06 }, segments: 40 }), mat4.ry(PI / 2))
}

/** Stiffener rings round the steriliser barrel. Axis X. */
export function steriliserRings(_length = 3.8, radius = 0.9) {
  const ring = xform(tube(radius + 0.06, radius, 0.07, 32), ALONG_X)
  return merge(...[-1.3, -0.65, 0, 0.65, 1.3].map((x) => xform(ring, at(x, 0, 0))))
}

/** Hinged steriliser door: dished door with its hinge arm. Axis X, door face on x = 0 bulging +X. */
export function steriliserDoor(radius = 0.9) {
  const rO = radius + 0.09
  const dish = lathe(
    [
      [0, 0.18],
      [rO * 0.7, 0.12],
      [rO, 0.05],
      [rO, -0.04],
      [0, -0.04],
    ],
    36,
  )
  return xform(merge(dish, bxAt(0.18, 0.9, 0.08, 0, radius * 0.5, 0.08)), ALONG_X)
}

/** Rail track for the bunch cages: two rails on sleepers, along X, rail foot at y = 0. */
export function railTracks(length = 6.0, gauge = 0.8) {
  const railH = 0.08
  const rails = [bxAt(length, railH, 0.05, 0, railH / 2, -gauge / 2), bxAt(length, railH, 0.05, 0, railH / 2, gauge / 2)]
  const n = 15
  const sleepers = Array.from({ length: n }, (_, i) => bxAt(0.12, 0.04, gauge + 0.25, -length / 2 + 0.2 + (i * (length - 0.4)) / (n - 1), 0.02, 0))
  return merge(...rails, ...sleepers)
}

/** Wheeled bunch cage (perforated steel basket on flanged wheels). Floor centred on y = 0, wheels below. */
export function bunchCage(w = 1.4, h = 1.0, d = 0.75, gauge = 0.8) {
  const posts = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => bxAt(0.05, h, 0.05, sx * (w / 2 - 0.03), h / 2, sz * (d / 2 - 0.03))))
  const panels = [bxAt(w - 0.06, h - 0.1, 0.02, 0, h / 2, -d / 2 + 0.02), bxAt(w - 0.06, h - 0.1, 0.02, 0, h / 2, d / 2 - 0.02), bxAt(0.02, h - 0.1, d - 0.06, -w / 2 + 0.02, h / 2, 0), bxAt(0.02, h - 0.1, d - 0.06, w / 2 - 0.02, h / 2, 0)]
  const wheelR = 0.09
  const wheels = [-1, 1].flatMap((sx) => [-1, 1].map((sz) => xform(cylinder(wheelR, 0.05, 16), mat4.c(at(sx * w * 0.35, -wheelR + 0.02, (sz * gauge) / 2), ALONG_Z))))
  return merge(box(w, 0.08, d), ...posts, ...panels, ...wheels)
}

/** Fresh fruit bunches stacked in a cage (rounded blocks). */
export function ffbClusters(w = 1.3, _h = 0.8, d = 0.65) {
  const parts: THREE.BufferGeometry[] = []
  const cr = 0.16
  for (let ix = 0; ix < 4; ix++)
    for (let iz = 0; iz < 2; iz++)
      for (let iy = 0; iy < 2; iy++) {
        const x = -w / 2 + 0.2 + (ix * (w - 0.4)) / 3 + (iy % 2) * 0.05
        const z = -d / 2 + 0.18 + iz * (d - 0.36)
        parts.push(xform(roundedBox(cr * 1.8, cr * 1.5, cr * 1.6, 0.06), at(x, 0.16 + iy * 0.28, z)))
      }
  return merge(...parts)
}

/** Rotary drum thresher: squirrel cage of slats on three rings, lifting beaters, shaft. Axis X, centred. */
export function thresherDrum(length = 2.4, radius = 0.75, numBars = 16) {
  const ring = (x: number) => xform(tube(radius, radius - 0.08, 0.08, 32), mat4.c(at(x, 0, 0), ALONG_X))
  const bars = Array.from({ length: numBars }, (_, i) => {
    const a = (2 * PI * i) / numBars
    return xform(box(length, 0.06, 0.04), mat4.c(at(0, (radius - 0.03) * cos(a), (radius - 0.03) * sin(a)), mat4.rx(-a)))
  })
  const beaters = Array.from({ length: 6 }, (_, i) => {
    const x = -length / 2 + 0.35 + (i * (length - 0.7)) / 5
    const a = i * 1.1
    return xform(box(0.08, radius * 0.65, 0.04), mat4.c(at(x, radius * 0.35 * cos(a), radius * 0.35 * sin(a)), mat4.rx(-a)))
  })
  return merge(xform(cylinder(0.08, length + 0.6, 24), ALONG_X), ring(-length / 2 + 0.06), ring(length / 2 - 0.06), ring(0), ...bars, ...beaters)
}

/** Thresher support: collecting trough, four legs, drive gearbox and motor, EFB chute. Drum axis on y = 0. */
export function thresherCasing(length = 2.6, radius = 0.8) {
  const trough = bxAt(length, 0.9, radius * 2.3, 0, -radius * 0.8, 0)
  const legs = legStand({ x: length / 2 - 0.1, z: radius + 0.15, h: 1.4, leg: 0.12, y0: -1.4 })
  const gb = xform(gearbox({ w: 0.4, h: 0.45, d: 0.35 }), mat4.c(at(length / 2 + 0.2, 0, 0), mat4.ry(PI / 2)))
  const motor = xform(electricMotor({ r: 0.22, length: 0.5 }), mat4.c(at(length / 2 + 0.72, 0, 0), mat4.ry(-PI / 2)))
  const chute = xform(box(0.6, 0.12, radius * 1.6), mat4.c(at(-length / 2 - 0.25, -0.3, 0), mat4.rz(0.4)))
  return merge(trough, legs, gb, motor, chute)
}

/** Steam-jacketed digester: cone-bottom vessel, jacket, four legs and the top drive (gearbox + motor). Axis Y, cone joint at y = 0. */
export function digesterVessel(height = 2.4, radius = 0.65, wall = 0.04) {
  const hCyl = height * 0.75
  const vessel = coneBottomVessel({ r: radius, hCyl, hCone: height * 0.25, wall, outletR: 0.18, outletFlangeR: 0.26 })
  const jacket = xform(tube(radius + 0.09, radius + 0.06, hCyl * 0.75, 32), at(0, hCyl * 0.42, 0))
  const legs = legStand({ x: radius * 0.8, z: radius * 0.8, h: 1.8, leg: 0.1, y0: -1.8 })
  const gb = xform(gearbox({ w: 0.38, h: 0.38, d: 0.32 }), mat4.c(at(0, hCyl + 0.24, 0), ALONG_Z))
  const motor = xform(electricMotor({ r: 0.18, length: 0.45 }), mat4.c(at(0, hCyl + 0.68, 0), ALONG_Z))
  return merge(vessel, jacket, legs, gb, motor)
}

/** Digester beater shaft with four tiers of crossed arms (expeller paddle at the bottom). Axis Y. */
export function digesterBeaterShaft(height = 2.2, armRadius = 0.52) {
  const tiers: THREE.BufferGeometry[] = []
  for (let i = 0; i < 4; i++) {
    const y = 0.15 + (i * (height * 0.65)) / 3
    const rot = i * (PI / 4)
    tiers.push(xform(box(armRadius * 2, 0.08, 0.035), mat4.c(at(0, y, 0), mat4.ry(rot))))
    if (i === 0) tiers.push(xform(box(armRadius * 1.8, 0.12, 0.04), mat4.c(at(0, y - 0.08, 0), mat4.ry(rot + PI / 2))))
    else tiers.push(xform(box(armRadius * 2, 0.08, 0.035), mat4.c(at(0, y, 0), mat4.ry(rot + PI / 2))))
  }
  return merge(xform(cylinder(0.07, height + 0.4, 24), at(0, height * 0.4, 0)), ...tiers)
}

/** Clarification (settling) tank with feed well, oil skimmer and legs. Axis Y, cone joint at y = 0. */
export function clarifierTank(height = 2.6, radius = 0.95, wall = 0.04) {
  const hCyl = height * 0.7
  const tank = coneBottomVessel({ r: radius, hCyl, hCone: height * 0.3, wall, outletR: 0.12, outletFlangeR: 0.22, neck: 0.12 })
  const feedWell = xform(tube(radius * 0.35, radius * 0.35 - 0.02, hCyl * 0.65, 24), at(0, hCyl * 0.5, 0))
  const funnel = xform(
    lathe(
      [
        [0.08, 0],
        [0.24, 0.15],
        [0.26, 0.15],
        [0.1, 0],
      ],
      20,
    ),
    at(radius * 0.45, hCyl - 0.18, 0),
  )
  return merge(tank, feedWell, funnel, legStand({ x: radius * 0.8, z: radius * 0.8, h: 1.6, leg: 0.12, y0: -1.6 }))
}

/** Oil, emulsion and sludge layers in the clarifier (cylinders, axis Y). */
export function clarifierLiquidLayers(radius = 0.9, height = 1.6) {
  return {
    oil: xform(cylinder(radius * 0.96, height * 0.28, 28), at(0, height * 0.65, 0)),
    emulsion: xform(cylinder(radius * 0.96, height * 0.32, 28), at(0, height * 0.35, 0)),
    sludge: cylinder(radius * 0.96, height * 0.38, 28),
  }
}

/** Disc-bowl centrifugal purifier: casing, bowl, drive motor below (shaft up), oil discharge. Axis Y, base at y = 0. */
export function centrifugePurifier(baseRadius = 0.45, height = 0.9) {
  const casing = lathe(
    [
      [0, 0],
      [baseRadius, 0],
      [baseRadius, height * 0.5],
      [baseRadius * 0.5, height * 0.85],
      [0.1, height * 0.85],
      [0.1, height],
      [0, height],
    ],
    28,
  )
  const bowl = xform(cylinder(baseRadius * 0.72, height * 0.45, 24), at(0, height * 0.4, 0))
  const motor = xform(electricMotor({ r: 0.22, length: 0.5 }), mat4.c(at(0, -0.36, 0), mat4.rx(-PI / 2)))
  return merge(casing, bowl, motor, bxAt(0.35, 0.06, 0.06, baseRadius * 0.7, height * 0.7, 0))
}

/** Vacuum dryer chamber with spray ring on three legs. Axis Y, cylinder from y = 0. */
export function vacuumDryer(radius = 0.55, height = 1.6) {
  const chamber = lathe(
    [
      [0.12, -0.2],
      [0.2, -0.2],
      [radius, 0],
      [radius, height * 0.8],
      [radius * 0.5, height],
      [0.14, height],
      [0, height],
    ],
    28,
  )
  const ring = xform(tube(radius * 0.7, radius * 0.65, 0.05, 20), at(0, height * 0.65, 0))
  const legs = legStand({ x: 0, z: 0, h: 0.9, leg: 0.08, y0: -0.9, positions: [[-radius * 0.8, -radius * 0.8], [radius * 0.8, -radius * 0.8], [0, radius * 0.8]] })
  return merge(chamber, ring, legs)
}

/** Depericarper: winnowing column, fibre cyclone, induced-draught fan, feed chute and fibre duct. Base at y = 0. */
export function depericarperColumn(height = 3.6, colW = 0.55, colD = 0.45) {
  const duct = bxAt(colW, height * 0.65, colD, 0, height * 0.38, 0)
  const cyc = cyclone({ rBarrel: 0.65, rApex: 0.18, hBarrel: 0.7, hCone: 0.7, wall: 0.03, rFinder: 0.25, depth: 0.35, above: 0.1 })
  const cycG = xform(merge(cyc.body, cyc.roof, cyc.finder), at(0, height * 0.85 - 0.7, 0))
  const fan = centrifugalFan({ r: 0.28, width: 0.35 })
  const fanG = xform(merge(fan.housing, fan.impeller), at(0, height + 0.3, 0))
  const feed = xform(box(0.65, 0.18, colD * 0.85), mat4.c(at(-colW * 0.6, height * 0.25, 0), mat4.rz(-0.4)))
  const fibre = xform(box(1.8, 0.16, 0.16), mat4.c(at(0.9, height * 0.68, 0), mat4.rz(0.15)))
  return merge(duct, cycG, fanG, feed, fibre)
}

/** Nut polishing drum on two pedestals. Axis X, centred. */
export function nutPolishingDrum(length = 2.0, radius = 0.42) {
  return merge(rotaryDrum({ r: radius, t: 0.04, L: length, segments: 28 }).shell, xform(cylinder(0.05, length + 0.4, 20), ALONG_X), bxAt(0.12, 0.6, 0.3, -length / 2, -0.3, 0), bxAt(0.12, 0.6, 0.3, length / 2, -0.3, 0))
}

/** Biomass water-tube boiler block with chimney and steam drum. Centred block. */
export function biomassBoiler(w = 1.8, h = 2.4, d = 1.6) {
  return merge(box(w, h, d), xform(cylinder(0.24, 2.2, 24), at(-w * 0.3, h / 2 + 1.1, 0)), xform(cylinder(0.3, w * 0.85, 20), mat4.c(at(0, h / 2 + 0.3, 0), mat4.rz(PI / 2))))
}

/* ============================== preservation plant ============================== */

/**
 * Blancher: steam hood, hot-water bath, legs, wire-mesh belt with its end rollers, exhaust stacks
 * and steam manifolds. Floor at y = 0, tunnel along Z. (`beltMesh` is centred; the scene lifts it
 * to the belt line y = 0.95.)
 */
export function blancher() {
  const L = 2.4
  const W = 0.8
  const H = 0.55
  const t = 0.03
  const roller = conveyorPulley({ r: 0.06, width: 0.6, chamfer: 0.01, edge: 0.02, bore: 0.012, shaftR: 0.015, shaftLength: 0.75 })
  const rollerX = xform(merge(roller.drum, roller.shaft), mat4.ry(PI / 2))
  const manifolds: THREE.BufferGeometry[] = []
  for (let z = -0.8; z <= 0.8; z += 0.4) {
    manifolds.push(xform(cylinder(0.015, 0.6), mat4.c(at(0, 1.3, z), mat4.rz(PI / 2))))
    for (const x of [-0.18, 0, 0.18]) manifolds.push(xform(cylinder(0.008, 0.04), at(x, 1.27, z)))
  }
  return {
    hood: merge(bxAt(W, t, L, 0, 1.1 + H / 2, 0), bxAt(t, H, L, -W / 2, 1.1, 0), bxAt(t, H, L, W / 2, 1.1, 0)),
    tank: xform(tray({ w: W - 0.04 + t, d: L - 0.2 + t, h: 0.35 + t / 2, wall: t }), at(0, 0.65 - t / 2, 0)),
    waterVolume: box(W - 0.1, 0.22, L - 0.26),
    frameLegs: legStand({ x: 0.35, z: 1.0, h: 0.8, leg: 0.06 }),
    beltMesh: box(0.6, 0.015, 3.2),
    endRollers: merge(xform(rollerX, at(0, 0.95, 1.6)), xform(rollerX, at(0, 0.95, -1.6))),
    stacks: merge(xform(tube(0.08, 0.07, 0.45), at(0, 1.6, 0.6)), xform(tube(0.08, 0.07, 0.45), at(0, 1.6, -0.6))),
    steamManifolds: merge(...manifolds),
  }
}

/**
 * Canning retort: horizontal vessel (axis Z at y = 1.0) with a dished rear head, front door
 * (flange and dome), swing-bolt lugs, handwheel, saddles, crate basket and top fittings.
 */
export function retort({ r = 0.55, length = 1.6 }: { r?: number; length?: number } = {}) {
  const y = 1.0
  const front = length / 2 + 0.04
  const lugs = Array.from({ length: 12 }, (_, i) => {
    const a = (i * PI * 2) / 12
    return xform(cylinder(0.02, 0.12), mat4.c(at((r + 0.04) * cos(a), y + (r + 0.04) * sin(a), front), mat4.rz(a)))
  })
  const saddle = merge(bxAt(1.3, 0.08, 0.25, 0, 0.04, 0), bxAt(0.1, 0.5, 0.25, -0.55, 0.35, 0), bxAt(0.1, 0.5, 0.25, 0.55, 0.35, 0))
  return {
    shell: xform(pressureVessel({ r, length, wall: 0.03, rearHead: false, frontHead: false }), at(0, y, 0)),
    rearDome: xform(dishedHead({ r, depth: 0.2, wall: 0.03 }), at(0, y, -length / 2)),
    doorAssembly: merge(xform(cylinder(r + 0.06, 0.06, 48), mat4.c(at(0, y, front), ALONG_Z)), xform(dishedHead({ r, depth: 0.2, wall: 0.03 }), mat4.c(at(0, y, front + 0.03), mat4.ry(PI)))),
    lockingLugs: merge(...lugs),
    handwheel: xform(merge(xform(cylinder(0.04, 0.08), ALONG_Z), xform(tube(0.18, 0.15, 0.04), ALONG_Z)), at(0, y, length / 2 + 0.22)),
    saddles: merge(xform(saddle, at(0, 0, -0.5)), xform(saddle, at(0, 0, 0.5))),
    basketFrame: merge(bxAt(0.65, 0.02, 1.2, 0, 0.68, 0), bxAt(0.02, 0.5, 1.2, -0.32, 0.93, 0), bxAt(0.02, 0.5, 1.2, 0.32, 0.93, 0), bxAt(0.65, 0.5, 0.02, 0, 0.93, -0.59), bxAt(0.65, 0.5, 0.02, 0, 0.93, 0.59)),
    fittings: merge(xform(tube(0.04, 0.03, 0.35), at(0, y + r + 0.17, -0.3)), xform(cylinder(0.035, 0.18), at(-0.25, y + r + 0.1, 0.2)), xform(cylinder(0.015, 0.15), at(0.25, y + r + 0.08, 0.3)), xform(cylinder(0.07, 0.03), mat4.c(at(0.25, y + r + 0.18, 0.3), ALONG_Z))),
  }
}

/**
 * Cold store: insulated room envelope (open front), door leaf, ceiling evaporator with two
 * fans, blast-freezer tunnel and the outside condensing unit. Floor at y = 0.
 */
export function coldStore({ w = 2.6, h = 2.0, d = 2.2, t = 0.08 }: { w?: number; h?: number; d?: number; t?: number } = {}) {
  const fan = merge(xform(tube(0.14, 0.12, 0.08), ALONG_Z), centrifugalFan({ r: 0.12, width: 0.08 }).impeller)
  return {
    roomEnvelope: merge(bxAt(w, t, d, 0, t / 2, 0), bxAt(w, t, d, 0, h - t / 2, 0), bxAt(w, h - 2 * t, t, 0, h / 2, -d / 2 + t / 2), bxAt(t, h - 2 * t, d - t, -w / 2 + t / 2, h / 2, t / 2), bxAt(t, h - 2 * t, d - t, w / 2 - t / 2, h / 2, t / 2)),
    coldDoor: box(0.85, 1.6, 0.08),
    evapAssembly: merge(bxAt(0.9, 0.35, 0.4, 0, h - 0.28, -0.6), xform(fan, at(-0.25, h - 0.28, -0.36)), xform(fan, at(0.25, h - 0.28, -0.36))),
    blastDuct: xform(tube(0.42, 0.38, 1.2), mat4.c(at(0.6, 0.7, 0.2), ALONG_Z)),
    condUnit: merge(xform(cylinder(0.14, 0.35), at(1.6, 0.22, 0.4)), bxAt(0.45, 0.45, 0.12, 1.6, 0.3, -0.2)),
  }
}

/** Packaging line table (top at y = 0.805) with filler nozzle, can seamer and date-coder heads. */
export function packagingLine() {
  return {
    table: merge(bxAt(0.7, 0.05, 2.6, 0, 0.78, 0), legStand({ x: 0.3, z: 1.1, h: 0.755, leg: 0.06 })),
    fillingNozzle: merge(xform(cylinder(0.03, 0.25), at(0, 1.25, 0.6)), xform(cylinder(0.012, 0.15), at(0, 1.05, 0.6))),
    seamerHead: merge(xform(cylinder(0.06, 0.18), at(0, 1.25, 0)), xform(cylinder(0.02, 0.06), at(-0.08, 1.15, 0)), xform(cylinder(0.02, 0.06), at(0.08, 1.15, 0))),
    coderHead: merge(bxAt(0.15, 0.12, 0.1, 0.2, 1.05, -0.6), xform(cylinder(0.01, 0.15), mat4.c(at(0.1, 0.98, -0.6), mat4.rz(PI / 2)))),
  }
}

/** Food containers: double-seamed can, glass jar with lug cap, retort pouch. Each centred, axis Y. */
export function foodContainers() {
  const chime = tube(0.047, 0.043, 0.01)
  return {
    metalCan: merge(cylinder(0.045, 0.12, 32), xform(chime, at(0, 0.06, 0)), xform(chime, at(0, -0.06, 0))),
    glassJar: merge(cylinder(0.048, 0.11, 32), xform(tube(0.038, 0.034, 0.03), at(0, 0.065, 0)), xform(cylinder(0.04, 0.015, 32), at(0, 0.08, 0))),
    retortPouch: merge(box(0.12, 0.16, 0.02), bxAt(0.14, 0.012, 0.005, 0, 0.08, 0), bxAt(0.01, 0.16, 0.005, -0.06, 0, 0), bxAt(0.01, 0.16, 0.005, 0.06, 0, 0)),
  }
}
