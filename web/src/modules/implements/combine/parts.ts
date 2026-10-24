import * as THREE from 'three'
import { cylinder, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'
import { loopPath } from '@/geometry/parts'
import { auger, augerFlight, bar, bladedRotor, concave, cutterBar, cylZ, elevatorSlat, headerAuger, louvreSieve, plateXY, reelBat, reelSpider, rod, sickle, slab as libSlab, strawWalker, threshingDrum, walkerCrank, wheelParts } from '@/parts/lib/implements'
import { D, WALKER_PHASE } from './model'

/**
 * Combine geometry, built on the main thread (no CSG). Every piece is a closed solid.
 * Axes: see model.ts (side view in XY, +X forward, width along Z).
 */
const { PI } = Math
const alongX = mat4.rz(PI / 2)
/** height of the ledger plates on the cutter bar */
const CUT_Y = 0.09

/** Box between two corners in side view, spanning z0…z1. */
export function slab(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) {
  return libSlab(x0, y0, x1, y1, z0, z1)
}

/** Solid or hollow cylinder along Z from z0 to z1, centred at (x, y). */
export function shaftZ(x: number, y: number, r: number, z0: number, z1: number, seg = 24) {
  return cylZ(x, y, r, z0, z1, seg)
}

/** Helical auger flight (round-section flight approximation) along Z. */
export function flight(x: number, y: number, R: number, z0: number, z1: number, turns: number, wire = 0.03) {
  return augerFlight({ x, y, R, z0, z1, turns, wire })
}

/** Wheel: tyre + rim, axle along Z, centred on the origin. */
export function wheel(radius: number, width: number, lugs: number, pattern: 'R1' | 'F2') {
  return wheelParts({ radius, width, pattern, lugs, rimRadius: radius * 0.6, hubR: 0.12, dish: 0.05 })
}

/* ------------------------------ Header ------------------------------ */

export function headerGeometry() {
  const H = D.header
  const hw = H.width / 2
  const throatHW = D.feeder.halfWidth + 0.02
  const parts = [
    // sloping floor (cutter bar to the auger trough)
    bar([H.cutterX - 0.02, 0.09, 0], [H.backX + 0.25, 0.14, 0], H.width, 0.02),
    // trough under the auger
    bar([H.backX + 0.27, 0.14, 0], [H.backX + 0.02, 0.3, 0], H.width, 0.02),
    // back wall each side of the throat, and above it
    slab(H.backX - 0.03, 0.14, H.backX, H.topY, throatHW, hw),
    slab(H.backX - 0.03, 0.14, H.backX, H.topY, -hw, -throatHW),
    slab(H.backX - 0.03, 0.78, H.backX, H.topY, -throatHW, throatHW),
    // top rail
    slab(H.backX - 0.05, H.topY, H.backX + 0.18, H.topY + 0.05, -hw, hw),
  ]
  for (const s of [1, -1]) {
    const z = s > 0 ? hw : -hw - 0.012
    parts.push(plateXY([[H.backX, 0.08], [H.cutterX + 0.05, 0.08], [H.cutterX + 0.05, 0.3], [H.backX + 0.35, H.topY], [H.backX, H.topY]], 0.012, z))
    // crop divider point
    parts.push(plateXY([[H.cutterX - 0.1, 0.06], [H.cutterX + 0.55, 0.12], [H.cutterX - 0.1, 0.42]], 0.05, s > 0 ? hw - 0.02 : -hw - 0.03))
  }
  return merge(...parts)
}

/** Cutter bar: guards (fingers) and ledger plates on the bar, fixed. */
export function cutterBarGeometry() {
  const H = D.header
  const hw = H.width / 2 - 0.02
  const c = cutterBar({ from: -hw, to: hw, y: CUT_Y })
  return xform(merge(c.guards, c.ledgers, ...(c.clips ? [c.clips] : [])), mat4.t(H.cutterX + 0.005, 0, 0))
}

/** Reciprocating knife: back and triangular sections. */
export function knifeGeometry() {
  const H = D.header
  const hw = H.width / 2 - 0.05
  return xform(sickle({ from: -hw, to: hw, y: CUT_Y }), mat4.t(H.cutterX + 0.005, 0, 0))
}

/** Header auger: tube, opposite-hand flights moving crop to the centre, retractable fingers. */
export function headerAugerGeometry() {
  return headerAuger({ halfWidth: D.header.width / 2 - 0.08, centreHalf: D.feeder.halfWidth, tubeR: D.auger.tube, r: D.auger.r })
}

/** Pick-up reel: centre shaft and spiders (rotate with the reel). */
export function reelSpiderGeometry() {
  return reelSpider({ halfWidth: D.header.width / 2 - 0.1, r: D.reel.r, bats: D.reel.bats })
}

/** One reel bat (tube along Z) with tines hanging down (kept vertical by the reel eccentric). */
export function reelBatGeometry() {
  return reelBat({ halfWidth: D.header.width / 2 - 0.1 })
}

/** Reel support arms from the header back to the reel ends (fixed). */
export function reelArmsGeometry() {
  const R = D.reel
  const hw = D.header.width / 2 + 0.03
  return merge(bar([D.header.backX + 0.1, D.header.topY, hw], [R.x, R.y, hw], 0.05, 0.08), bar([D.header.backX + 0.1, D.header.topY, -hw], [R.x, R.y, -hw], 0.05, 0.08), rod([R.x, R.y, hw - 0.12], [R.x, R.y, hw + 0.02], 0.07, 16), rod([R.x, R.y, -hw - 0.02], [R.x, R.y, -hw + 0.12], 0.07, 16))
}

/* ------------------------------ Feeder house ------------------------------ */

export function feederPath() {
  const F = D.feeder
  return loopPath(new THREE.Vector2(...F.lo), F.sprocket, new THREE.Vector2(...F.hi), F.sprocket)
}

export function feederHousingGeometry() {
  const F = D.feeder
  const [lx, ly] = F.lo
  const [hx, hy] = F.hi
  const hw = F.halfWidth + 0.02
  const dir = new THREE.Vector2(hx - lx, hy - ly).normalize()
  const nrm = new THREE.Vector2(-dir.y, dir.x)
  const off = (x: number, y: number, k: number): [number, number] => [x + nrm.x * k, y + nrm.y * k]
  const b0 = off(lx + 0.18, ly, -0.16)
  const b1 = off(hx - 0.15, hy, -0.16)
  const t0 = off(lx + 0.18, ly, 0.2)
  const t1 = off(hx - 0.15, hy, 0.2)
  const parts = [bar([b0[0], b0[1], 0], [b1[0], b1[1], 0], 2 * hw, 0.02), bar([t0[0], t0[1], 0], [t1[0], t1[1], 0], 2 * hw, 0.02)]
  for (const z of [hw, -hw - 0.012]) parts.push(plateXY([b0, b1, t1, t0], 0.012, z))
  return merge(...parts)
}

export function feederSprocketsGeometry() {
  const F = D.feeder
  return merge(shaftZ(F.lo[0], F.lo[1], F.sprocket * 0.8, -F.halfWidth, F.halfWidth, 20), shaftZ(F.hi[0], F.hi[1], F.sprocket * 0.8, -F.halfWidth, F.halfWidth, 20))
}

/** One slat of the chain-and-slat elevator (local: x along the chain, y outward). */
export function slatGeometry() {
  return elevatorSlat(D.feeder.halfWidth - 0.04)
}

/* ------------------------------ Threshing unit ------------------------------ */

export function cylinderGeometry() {
  return threshingDrum({ r: D.cyl.r, halfWidth: D.cyl.halfWidth, bars: D.cyl.bars })
}

/** Concave: transverse bars on an arc below the cylinder, side plates (radius set by the clearance). */
export function concaveGeometry(clearanceMm: number) {
  return concave({ r: D.cyl.r, halfWidth: D.cyl.halfWidth, clearance: clearanceMm / 1000 })
}

export function beaterGeometry() {
  return bladedRotor({ r: D.beater.r, halfWidth: D.cyl.halfWidth, blades: 4 })
}

/* ------------------------------ Separating and cleaning ------------------------------ */

const W = D.walkers
/** Walker base-line height at x (rises towards the rear). */
export const walkerBase = (x: number) => 1.2 + (W.x0 - x) * 0.075
export const walkerWidth = (2 * D.cyl.halfWidth) / W.n

/** One straw walker: a stepped (saw-tooth) trough, side view extruded across its width. */
export function walkerGeometry() {
  return strawWalker({ x0: W.x0, x1: W.x1, base: walkerBase, width: walkerWidth })
}

/** Crankshaft carrying the walkers, local origin on its axis; throws at the walker phases. */
export function walkerCrankGeometry() {
  return walkerCrank({ halfWidth: D.cyl.halfWidth, r: W.crankR, phases: WALKER_PHASE.slice(0, W.n) })
}

/** Grain pan (under the concave) and return pan (under the walkers) — move with the shoe. */
export function pansGeometry() {
  const hw = D.cyl.halfWidth + 0.04
  return merge(bar([2.25, 0.98, 0], [1.08, 0.9, 0], 2 * hw, 0.015), bar([1.0, 1.0, 0], [-1.7, 1.15, 0], 2 * hw, 0.015), slab(1.0, 0.9, 1.02, 1.0, -hw, hw))
}

/** Adjustable-louvre sieve (chaffer or lower sieve) in its frame. */
export function sieveGeometry(x0: number, x1: number, y: number, pitch: number, tilt: number) {
  return louvreSieve({ x0, x1, y, pitch, tilt, halfWidth: D.cyl.halfWidth + 0.03 })
}

export function fanRotorGeometry() {
  return bladedRotor({ r: D.fan.r, halfWidth: D.cyl.halfWidth + 0.02, blades: 6, hubR: 0.05, shaftR: 0.035, bladeT: 0.012, seg: 16 })
}

export function fanHousingGeometry() {
  const F = D.fan
  const pts: V2[] = []
  const a0 = (40 * PI) / 180
  const a1 = (320 * PI) / 180
  for (let i = 0; i <= 28; i++) {
    const a = a0 + ((a1 - a0) * i) / 28
    const r = F.r + 0.04 + 0.06 * (i / 28)
    pts.push([F.x + r * Math.cos(a + PI), F.y + r * Math.sin(a + PI)])
  }
  for (let i = 28; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 28
    const r = F.r + 0.055 + 0.06 * (i / 28)
    pts.push([F.x + r * Math.cos(a + PI), F.y + r * Math.sin(a + PI)])
  }
  const hw = D.cyl.halfWidth + 0.04
  return merge(plateXY(pts, 2 * hw, -hw), plateXY([[F.x - 0.36, F.y - 0.38], [F.x + 0.36, F.y - 0.38], [F.x + 0.36, F.y + 0.38], [F.x - 0.36, F.y + 0.38]], 0.01, hw), plateXY([[F.x - 0.36, F.y - 0.38], [F.x + 0.36, F.y - 0.38], [F.x + 0.36, F.y + 0.38], [F.x - 0.36, F.y + 0.38]], 0.01, -hw - 0.01))
}

/** Transverse auger (clean grain or tailings) running out to the right-hand side (−Z). */
export function crossAugerGeometry() {
  const z0 = D.cyl.halfWidth
  const z1 = -D.body.hw - 0.12
  return auger({ tubeR: 0.03, flightR: 0.085, z0: z1, z1: z0, turns: 7, wire: 0.016, inset: 0.02 })
}

export function troughGeometry(x: number, y: number) {
  const z0 = D.cyl.halfWidth + 0.02
  const z1 = -D.body.hw - 0.14
  return merge(bar([x - 0.14, y + 0.1, (z0 + z1) / 2], [x, y - 0.12, (z0 + z1) / 2], Math.abs(z0 - z1), 0.012), bar([x, y - 0.12, (z0 + z1) / 2], [x + 0.14, y + 0.1, (z0 + z1) / 2], Math.abs(z0 - z1), 0.012))
}

/** Clean-grain and tailings elevators (on the right-hand side, outside the side sheet). */
export function elevatorsGeometry() {
  const z = -D.body.hw - 0.12
  const ca = D.cleanAuger
  const ta = D.tailAuger
  return merge(
    bar([ca.x, ca.y - 0.08, z], [ca.x, D.tank.y1 - 0.1, z], 0.2, 0.26),
    bar([ca.x, D.tank.y1 - 0.15, z], [ca.x + 0.5, D.tank.y1 + 0.02, z + 0.5], 0.18, 0.16),
    bar([ta.x, ta.y - 0.08, z], [D.cyl.x - 0.15, D.cyl.y + 0.45, z], 0.16, 0.18),
  )
}

/* ------------------------------ Body, tank, cab, engine ------------------------------ */

export function bodyGeometry() {
  const B = D.body
  const side: V2[] = [
    [B.x0, B.y0 + 0.3],
    [B.x0 + 0.5, B.y0],
    [B.x1 - 0.3, B.y0],
    [B.x1, B.y0 + 0.5],
    [B.x1, 1.25],
    [D.feeder.hi[0] + 0.05, 1.6],
    [B.x1 - 0.35, B.y1],
    [B.x0, B.y1],
  ]
  const t = 0.025
  return merge(
    plateXY(side, t, B.hw),
    plateXY(side, t, -B.hw - t),
    slab(B.x0, B.y1, B.x1 - 0.35, B.y1 + 0.03, -B.hw - t, B.hw + t),
    // rear hood over the walker ends
    bar([B.x0, B.y1, 0], [B.x0 - 0.35, 1.55, 0], 2 * B.hw + 2 * t, 0.02),
  )
}

export function tankGeometry() {
  const T = D.tank
  const t = 0.02
  return merge(
    slab(T.x0, T.y0, T.x1, T.y0 + t, -T.hw, T.hw),
    slab(T.x0, T.y0, T.x0 + t, T.y1, -T.hw, T.hw),
    slab(T.x1 - t, T.y0, T.x1, T.y1, -T.hw, T.hw),
    slab(T.x0 + t, T.y0, T.x1 - t, T.y1, T.hw - t, T.hw),
    slab(T.x0 + t, T.y0, T.x1 - t, T.y1, -T.hw, -T.hw + t),
  )
}

export function tankAugerGeometry() {
  const T = D.tank
  return merge(xform(cylinder(0.03, T.x1 - T.x0 - 0.1, 16), mat4.c(mat4.t((T.x0 + T.x1) / 2, T.y0 + 0.1, 0), alongX)))
}

/** Unloading auger tube with spout; local origin at the pivot, stowed along −X. */
export function unloadGeometry() {
  const U = D.unload
  const parts = [
    xform(tube(0.13, 0.11, U.L, 32), mat4.c(mat4.t(-U.L / 2, 0, 0), alongX)),
    xform(tube(0.14, 0.11, 0.35, 32), mat4.c(mat4.t(0, -0.2, 0), mat4.t(0, 0, 0))),
    xform(tube(0.11, 0.08, 0.35, 24), mat4.t(-U.L + 0.05, -0.2, 0)),
  ]
  return merge(...parts)
}

export function cabFrameGeometry() {
  const x0 = 2.35
  const x1 = 3.45
  const y0 = 2.2
  const y1 = 3.25
  const hw = 0.7
  const p = 0.045
  const parts = [slab(x0 - 0.05, y1, x1 + 0.08, y1 + 0.08, -hw - 0.05, hw + 0.05), slab(x0, y0 - 0.05, x1, y0, -hw, hw)]
  for (const x of [x0, x1]) for (const z of [hw, -hw]) parts.push(slab(x - p / 2, y0, x + p / 2, y1, z - p / 2, z + p / 2))
  // seat and steering column
  parts.push(slab(2.45, y0, 2.85, y0 + 0.45, -0.25, 0.25), slab(2.45, y0 + 0.45, 2.55, y0 + 0.95, -0.25, 0.25), bar([3.2, y0, 0], [3.0, y0 + 0.75, 0], 0.06, 0.06), xform(tube(0.2, 0.18, 0.03, 32), mat4.c(mat4.t(3.0, y0 + 0.78, 0), mat4.rz(0.35))))
  // platform out to the cab from the feeder
  parts.push(slab(x0 - 0.1, 1.95, x1 + 0.2, 2.15, -hw, hw))
  return merge(...parts)
}

export function cabGlassGeometry() {
  return slab(2.37, 2.22, 3.43, 3.23, -0.68, 0.68)
}

export function engineGeometry() {
  return merge(slab(-2.6, D.body.y1 + 0.03, -1.0, 2.9, -0.75, 0.75), slab(-2.65, 2.3, -2.6, 2.85, -0.7, 0.7), xform(cylinder(0.07, 0.6, 16), mat4.t(-1.4, 3.15, 0.45)))
}

export function strawChopperGeometry() {
  return bladedRotor({ r: 0.22, halfWidth: D.body.hw - 0.05, blades: 6, hubR: 0.05, shaftR: 0.06, shaftExtra: 0, bladeT: 0.01, seg: 16 })
}

export function axlesGeometry() {
  const F = D.front
  const R = D.rear
  return merge(
    shaftZ(F.x, F.r, 0.11, -F.z + 0.25, F.z - 0.25, 24),
    slab(F.x - 0.25, F.r - 0.2, F.x + 0.25, D.body.y0 + 0.1, -D.body.hw - 0.02, -D.body.hw + 0.15),
    slab(F.x - 0.25, F.r - 0.2, F.x + 0.25, D.body.y0 + 0.1, D.body.hw - 0.15, D.body.hw + 0.02),
    shaftZ(R.x, R.r, 0.07, -R.z + 0.12, R.z - 0.12, 20),
    slab(R.x - 0.12, R.r, R.x + 0.12, D.body.y0 + 0.05, -0.15, 0.15),
  )
}

/** Crop stalk (unit height 1) with an ear on top; heads separately so stubble can drop them. */
export function stalkGeometry() {
  return merge(xform(cylinder(0.006, 1, 5), mat4.t(0, 0.5, 0)))
}
export function earGeometry() {
  return merge(xform(lathe([[0, -0.06], [0.014, -0.05], [0.016, 0.02], [0.0, 0.07]], 6), mat4.t(0, 0, 0)))
}
