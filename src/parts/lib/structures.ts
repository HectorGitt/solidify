import * as THREE from 'three'
import { box, cylinder, extrude, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { legStand } from './processing'

/**
 * Shared parts library — farm buildings and structures: walls with openings, gable roof shells,
 * king-post trusses, columns, ground slabs, the greenhouse frame and cladding, grain silos and
 * the traditional yam barn. Moved from the structures scenes (structures/_shared/build.ts, the
 * greenhouse and machinery-storage scenes) and the preservation scene, which now call these.
 * Worker-safe, no CSG; every piece is a closed solid.
 *
 * Building frame: local X across the span (width), Z along the length, ground (or wall base) at
 * y = 0, centred on the footprint.
 */

const { PI } = Math
const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const bxAt = (w: number, h: number, d: number, x: number, y: number, z: number) => xform(box(w, h, d), at(x, y, z))

function poly(pts: [number, number][]) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

/* ============================== walls and roofs ============================== */

export type Side = '+x' | '-x' | '+z' | '-z'
export interface Opening {
  side: Side
  /** centre offset along the wall from its midpoint (m) */
  at: number
  width: number
  height: number
  /** sill height (0 for doors) */
  sill?: number
}

/**
 * Four walls of a w × d building (X across w, Z along d), base at y = 0, wall thickness t.
 * The ±z walls run the full width; the ±x walls fit between them. Openings (doors, windows)
 * leave gaps with a lintel above and, for windows, a sill wall below. Every piece is a closed box.
 */
export function walls({ w, d, h, t, openings = [] }: { w: number; d: number; h: number; t: number; openings?: Opening[] }) {
  const parts: THREE.BufferGeometry[] = []
  const run = (side: Side) => {
    const alongX = side === '+z' || side === '-z'
    const len = alongX ? w : d - 2 * t
    const ops = openings.filter((o) => o.side === side).sort((a, b) => a.at - b.at)
    const place = (a: number, b: number, y0: number, y1: number) => {
      if (b - a < 1e-3 || y1 - y0 < 1e-3) return
      const c = (a + b) / 2
      const g = alongX ? box(b - a, y1 - y0, t) : box(t, y1 - y0, b - a)
      const sgn = side[0] === '+' ? 1 : -1
      const pos = alongX ? at(c, (y0 + y1) / 2, sgn * (d / 2 - t / 2)) : at(sgn * (w / 2 - t / 2), (y0 + y1) / 2, c)
      parts.push(xform(g, pos))
    }
    let cur = -len / 2
    for (const o of ops) {
      const a = Math.max(-len / 2, o.at - o.width / 2)
      const b = Math.min(len / 2, o.at + o.width / 2)
      place(cur, a, 0, h)
      place(a, b, Math.min(h, o.height), h)
      if (o.sill) place(a, b, 0, o.sill)
      cur = b
    }
    place(cur, len / 2, 0, h)
  }
  ;(['+z', '-z', '+x', '-x'] as Side[]).forEach(run)
  return merge(...parts)
}

/**
 * Gable roof shell spanning `span` (across X) with the ridge along Z, eaves line (wall plate) at
 * y = 0: an inverted V of thickness t overhanging the walls by `overhang`. `rise` is the ridge
 * height above the wall plate.
 */
export function gableRoof({ span, length, pitchDeg, overhang = 0.4, t = 0.08 }: { span: number; length: number; pitchDeg: number; overhang?: number; t?: number }) {
  const th = (pitchDeg * PI) / 180
  const a = span / 2 + overhang
  const h = a * Math.tan(th)
  const dx = t / Math.sin(th)
  const dy = t / Math.cos(th)
  const drop = overhang * Math.tan(th)
  const s = poly([
    [-a, -drop],
    [-a + dx, -drop],
    [0, h - dy - drop],
    [a - dx, -drop],
    [a, -drop],
    [0, h - drop],
  ])
  return { geometry: extrude(s, length + 2 * overhang), rise: h - drop }
}

/**
 * King-post truss spanning `span` along X in the XY plane, member section w (along Z) × depth
 * (in-plane). Tie beam on y = 0…depth, rafters up to the ridge, king post in the middle. Give
 * either the roof pitch or the rise. `rafters: false` leaves just the tie and king post.
 */
export function kingPostTruss({ span, pitchDeg, rise: riseIn, w = 0.08, depth = 0.12, rafters = true }: { span: number; pitchDeg?: number; rise?: number; w?: number; depth?: number; rafters?: boolean }) {
  const rise = riseIn ?? (span / 2) * Math.tan(((pitchDeg ?? 15) * PI) / 180)
  const raf = Math.hypot(span / 2, rise)
  const a = Math.atan2(rise, span / 2)
  const parts = [bxAt(span, depth, w, 0, depth / 2, 0), bxAt(depth * 0.8, rise, w, 0, rise / 2 + depth / 2, 0)]
  if (rafters) parts.push(xform(box(raf, depth, w), mat4.c(at(-span / 4, rise / 2 + depth / 2, 0), mat4.rz(a))), xform(box(raf, depth, w), mat4.c(at(span / 4, rise / 2 + depth / 2, 0), mat4.rz(-a))))
  return merge(...parts)
}

/** Column (post) of height h on y = 0…h: square of side `size`, or round of diameter `size`. */
export function column({ h, size, round = false, segments = 12 }: { h: number; size: number; round?: boolean; segments?: number }) {
  return round ? xform(cylinder(size / 2, h, segments), at(0, h / 2, 0)) : bxAt(size, h, size, 0, h / 2, 0)
}

/** Flat ring slab (turning circle, hazard ring) in the XZ plane, thickness h, base at y = 0. */
export function ringSlab({ rOuter, rInner, h, segments = 96 }: { rOuter: number; rInner: number; h: number; segments?: number }) {
  const s = new THREE.Shape()
  s.absarc(0, 0, rOuter, 0, PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, rInner, 0, PI * 2, true)
  s.holes.push(hole)
  return xform(extrude(s, h, { curveSegments: segments }), mat4.c(at(0, h / 2, 0), mat4.rx(-PI / 2)))
}

/** Flat disc slab (pad, zone) in the XZ plane, thickness h, base at y = 0. */
export function discSlab({ r, h, segments = 96 }: { r: number; h: number; segments?: number }) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, PI * 2, false)
  return xform(extrude(s, h, { curveSegments: segments }), mat4.c(at(0, h / 2, 0), mat4.rx(-PI / 2)))
}

/* ============================== greenhouse ============================== */

/**
 * Multi-span (ridge-and-furrow) greenhouse: `bays` bays of width bayW along X, length L along Z.
 * Returns the galvanised frame (posts on a ≈ 4 m grid and a king-post truss with rafters per bay
 * and post line), the roof and side cladding, and the two end walls (doors). Ground at y = 0.
 */
export function greenhouse({ bays, bayW, L, gutterH = 2.9, ridgeH = 3.6, post = 0.1, cladT = 0.02 }: { bays: number; bayW: number; L: number; gutterH?: number; ridgeH?: number; post?: number; cladT?: number }) {
  const W = bays * bayW
  const zSteps = Math.ceil(L / 4) + 1
  const zs = Array.from({ length: zSteps }, (_, i) => -L / 2 + (i * L) / (zSteps - 1))
  const postG = column({ h: gutterH, size: post })
  const frame: THREE.BufferGeometry[] = []
  for (let b = 0; b <= bays; b++) for (const z of zs) frame.push(xform(postG, at(-W / 2 + b * bayW, 0, z)))
  const rise = ridgeH - gutterH
  const truss = kingPostTruss({ span: bayW, rise, w: 0.05, depth: 0.05 })
  const clads: THREE.BufferGeometry[] = []
  const slope = Math.hypot(bayW / 2, rise)
  const ang = Math.atan2(rise, bayW / 2)
  for (let b = 0; b < bays; b++) {
    const xC = -W / 2 + b * bayW + bayW / 2
    for (const z of zs) frame.push(xform(truss, at(xC, gutterH - 0.025, z)))
    // glazing sits just above the rafters
    clads.push(xform(box(slope, cladT, L), mat4.c(at(xC - bayW / 4, gutterH + rise / 2 + 0.06, 0), mat4.rz(ang))))
    clads.push(xform(box(slope, cladT, L), mat4.c(at(xC + bayW / 4, gutterH + rise / 2 + 0.06, 0), mat4.rz(-ang))))
  }
  clads.push(bxAt(cladT, gutterH, L, -W / 2 - post / 2 - cladT / 2, gutterH / 2, 0), bxAt(cladT, gutterH, L, W / 2 + post / 2 + cladT / 2, gutterH / 2, 0))
  const doors = merge(bxAt(W, gutterH, cladT, 0, gutterH / 2, -L / 2 - post / 2 - cladT / 2), bxAt(W, gutterH, cladT, 0, gutterH / 2, L / 2 + post / 2 + cladT / 2))
  return { frame: merge(...frame), cladding: merge(...clads), doors, width: W }
}

/* ============================== silos and stores ============================== */

export interface SiloSpec {
  r: number
  /** height of the cylindrical wall */
  h: number
  /** cone roof rise (0.3 r by default) */
  roofRise?: number
  /** leg height for an elevated hopper-bottom silo (0: flat-bottom silo on the ground) */
  legH?: number
  /** hopper (cone) depth under the barrel, for an elevated silo */
  hopperH?: number
  legSize?: number
  /** corrugation stiffener rings every ≈ 0.2 m */
  corrugated?: boolean
  wall?: number
}

/**
 * Grain silo: cylindrical wall, cone roof with a vent cap, and either a flat bottom on the ground
 * or a hopper bottom on four legs. Axis Y, ground at y = 0; the barrel starts at y = legH.
 */
export function grainSilo({ r, h, roofRise = 0.3 * r, legH = 0, hopperH = legH ? Math.min(legH, 0.6 * r) : 0, legSize = Math.max(0.06, r * 0.1), corrugated = false, wall = Math.max(0.01, r * 0.025) }: SiloSpec) {
  const y0 = legH
  const barrel = xform(tube(r, r - wall, h, 48), at(0, y0 + h / 2, 0))
  const roofProfile: V2[] = [
    [0, roofRise - 0.03],
    [r + 0.04, -0.02],
    [r + 0.06, 0],
    [0, roofRise],
  ]
  const roof = xform(lathe(roofProfile, 48), at(0, y0 + h, 0))
  const vent = xform(cylinder(Math.max(0.05, r * 0.1), Math.max(0.1, r * 0.19), 16), at(0, y0 + h + roofRise, 0))
  const out: { barrel: THREE.BufferGeometry; roof: THREE.BufferGeometry; vent: THREE.BufferGeometry; hopper?: THREE.BufferGeometry; legs?: THREE.BufferGeometry; rings?: THREE.BufferGeometry } = { barrel, roof, vent }
  if (hopperH > 0) {
    const outlet = Math.max(0.1, r * 0.15)
    out.hopper = xform(
      lathe(
        [
          [outlet, 0],
          [r, hopperH],
          [r - wall, hopperH],
          [outlet - wall, 0],
        ],
        48,
      ),
      at(0, y0 - hopperH, 0),
    )
  }
  if (legH > 0) out.legs = legStand({ x: r * 0.75, z: r * 0.75, h: legH, leg: legSize })
  if (corrugated) {
    const rings: THREE.BufferGeometry[] = []
    for (let y = 0.15; y < h; y += 0.2) rings.push(xform(tube(r + 0.015, r, 0.04, 48), at(0, y0 + y, 0)))
    out.rings = merge(...rings)
  }
  return out
}

/**
 * Traditional yam barn: two rows of poles (x = ±0.35) with yam tubers tied on in tiers, bracing
 * rails and a palm-frond shade roof. Ground at y = 0, rows along Z.
 */
export function yamBarn({ poleH = 2.8, poles = 6, spacing = 0.45, tiers = 5 }: { poleH?: number; poles?: number; spacing?: number; tiers?: number } = {}) {
  const poleR = 0.035
  const poleGs: THREE.BufferGeometry[] = []
  const tubers: THREE.BufferGeometry[] = []
  const ties: THREE.BufferGeometry[] = []
  const yam = lathe(
    [
      [0, 0.18],
      [0.045, 0.14],
      [0.055, 0],
      [0.048, -0.14],
      [0, -0.18],
    ],
    16,
  )
  const tie = tube(poleR + 0.015, poleR, 0.02)
  for (let p = 0; p < poles; p++) {
    const pz = -1.1 + p * spacing
    for (const x of [-0.35, 0.35]) {
      poleGs.push(xform(column({ h: poleH, size: 2 * poleR, round: true, segments: 32 }), at(x, 0, pz)))
      for (let t = 0; t < tiers; t++) {
        const y = 0.5 + t * 0.45
        tubers.push(xform(yam, mat4.c(at(x, y, pz + 0.08), mat4.rx(PI / 2))))
        ties.push(xform(tie, at(x, y, pz)))
      }
    }
  }
  const rails: THREE.BufferGeometry[] = []
  for (let y = 0.6; y <= 2.6; y += 0.8) for (const x of [-0.35, 0.35]) rails.push(xform(cylinder(0.02, 2.6), mat4.c(at(x, y, 0), mat4.rx(PI / 2))))
  const thatchRoof = merge(xform(box(1.2, 0.05, 2.8), mat4.c(at(0, poleH + 0.1, 0), mat4.rz(0.1))), xform(box(1.2, 0.05, 2.8), mat4.c(at(0, poleH + 0.1, 0), mat4.rz(-0.1))))
  return { poles: merge(...poleGs), tubers: merge(...tubers), ties: merge(...ties), braceRails: merge(...rails), thatchRoof }
}
