import * as THREE from 'three'
import { box, cylinder, lathe, mat4, merge, pipe, tube, xform, type V2 } from '@/geometry'
import { loopPath, rim, tyre } from '@/geometry/parts'
import { bar, plateXY, rod } from '../_shared/geom'
import { D, WALKER_PHASE } from './model'

/**
 * Combine geometry, built on the main thread (no CSG). Every piece is a closed solid.
 * Axes: see model.ts (side view in XY, +X forward, width along Z).
 */
const { PI } = Math
const alongZ = mat4.rx(PI / 2)
const alongX = mat4.rz(PI / 2)

/** Box between two corners in side view, spanning z0…z1. */
export function slab(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number) {
  return xform(box(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0)), mat4.t((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2))
}

/** Solid or hollow cylinder along Z from z0 to z1, centred at (x, y). */
export function shaftZ(x: number, y: number, r: number, z0: number, z1: number, seg = 24) {
  return xform(cylinder(r, Math.abs(z1 - z0), seg), mat4.c(mat4.t(x, y, (z0 + z1) / 2), alongZ))
}

/** Helical auger flight (round-section flight approximation) along Z. */
export function flight(x: number, y: number, R: number, z0: number, z1: number, turns: number, wire = 0.03) {
  class Helix extends THREE.Curve<THREE.Vector3> {
    constructor() {
      super()
    }
    getPoint(t: number, target = new THREE.Vector3()) {
      const a = t * turns * 2 * PI
      return target.set(x + R * Math.cos(a), y + R * Math.sin(a), z0 + (z1 - z0) * t)
    }
  }
  return pipe(new Helix(), wire, 0, Math.max(48, Math.round(Math.abs(turns) * 28)), 8)
}

/** Wheel: tyre + rim, axle along Z, centred on the origin. */
export function wheel(radius: number, width: number, lugs: number, pattern: 'R1' | 'F2') {
  const rr = radius * 0.6
  const t = tyre({ radius, width, rimRadius: rr, pattern, lugs })
  t.rotateX(PI / 2)
  const r = rim(rr, width * 0.9, 0.12, 0.05)
  r.rotateX(PI / 2)
  return { tyre: t, rim: r }
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
  const parts = [slab(H.cutterX - 0.07, 0.07, H.cutterX, 0.1, -hw, hw)]
  const pitch = 0.0762
  for (let z = -hw + pitch / 2; z < hw; z += pitch) {
    parts.push(bar([H.cutterX - 0.06, 0.1, z], [H.cutterX + 0.12, 0.085, z], 0.018, 0.016))
  }
  return merge(...parts)
}

/** Reciprocating knife: back and triangular sections. */
export function knifeGeometry() {
  const H = D.header
  const hw = H.width / 2 - 0.05
  const pitch = 0.0762
  const parts = [slab(H.cutterX - 0.005, 0.104, H.cutterX + 0.015, 0.112, -hw, hw)]
  for (let z = -hw + pitch / 2; z < hw - pitch / 2; z += pitch) {
    const s = new THREE.Shape([new THREE.Vector2(H.cutterX, z - pitch / 2 + 0.003), new THREE.Vector2(H.cutterX + 0.075, z - 0.006), new THREE.Vector2(H.cutterX + 0.075, z + 0.006), new THREE.Vector2(H.cutterX, z + pitch / 2 - 0.003)])
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false })
    g.rotateX(PI / 2)
    g.translate(0, 0.108, 0)
    parts.push(g)
  }
  return merge(...parts)
}

/** Header auger: tube, opposite-hand flights moving crop to the centre, retractable fingers. */
export function headerAugerGeometry() {
  const A = D.auger
  const hw = D.header.width / 2 - 0.08
  const parts = [shaftZ(0, 0, A.tube, -hw, hw, 28)]
  const fz = D.feeder.halfWidth
  // flights: left side (z > 0) and right side (z < 0) of opposite hand
  parts.push(flight(0, 0, A.r - 0.03, fz, hw, 5.5))
  parts.push(flight(0, 0, A.r - 0.03, -fz, -hw, 5.5))
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * 2 * PI
    const z = -fz + 0.15 + (k % 3) * ((2 * fz - 0.3) / 2)
    parts.push(rod([0, 0, z], [Math.cos(a) * (A.r + 0.06), Math.sin(a) * (A.r + 0.06), z], 0.011, 8))
  }
  return merge(...parts)
}

/** Pick-up reel: centre shaft and spiders (rotate with the reel). */
export function reelSpiderGeometry() {
  const R = D.reel
  const hw = D.header.width / 2 - 0.1
  const parts = [shaftZ(0, 0, 0.06, -hw, hw, 24)]
  for (const z of [-hw + 0.05, 0, hw - 0.05])
    for (let k = 0; k < R.bats; k++) {
      const a = (k / R.bats) * 2 * PI
      parts.push(rod([0, 0, z], [R.r * Math.cos(a), R.r * Math.sin(a), z], 0.02, 8))
    }
  return merge(...parts)
}

/** One reel bat (tube along Z) with tines hanging down (kept vertical by the reel eccentric). */
export function reelBatGeometry() {
  const hw = D.header.width / 2 - 0.1
  const parts = [shaftZ(0, 0, 0.025, -hw, hw, 12)]
  for (let z = -hw + 0.05; z < hw; z += 0.16) parts.push(rod([0, 0, z], [0.04, -0.3, z], 0.006, 6))
  return merge(...parts)
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
  const hw = D.feeder.halfWidth - 0.04
  return merge(slab(-0.02, 0, 0.02, 0.035, -hw, hw), slab(-0.03, -0.01, 0.03, 0.01, hw - 0.02, hw + 0.02), slab(-0.03, -0.01, 0.03, 0.01, -hw - 0.02, -hw + 0.02))
}

/* ------------------------------ Threshing unit ------------------------------ */

export function cylinderGeometry() {
  const Cy = D.cyl
  const hw = Cy.halfWidth
  const parts = [shaftZ(0, 0, 0.04, -hw - 0.15, hw + 0.15, 20)]
  for (const z of [-hw + 0.02, -hw / 3, hw / 3, hw - 0.02]) parts.push(xform(tube(Cy.r - 0.035, 0.04, 0.02, 40), mat4.c(mat4.t(0, 0, z), alongZ)))
  for (let k = 0; k < Cy.bars; k++) {
    const a = (k / Cy.bars) * 2 * PI
    const c = Math.cos(a)
    const s = Math.sin(a)
    // rasp bar with ribs (alternate bars have opposite rib angles in practice)
    const g = slab(-0.025, -0.022, 0.025, 0.022, -hw, hw)
    const ribs: THREE.BufferGeometry[] = [g]
    for (let z = -hw + 0.06; z < hw - 0.03; z += 0.09) ribs.push(xform(slab(-0.006, 0.022, 0.006, 0.034, -0.04, 0.04), mat4.c(mat4.t(0, 0, z), mat4.ry(0.5 * (k % 2 ? 1 : -1)))))
    const bar0 = merge(...ribs)
    parts.push(xform(bar0, new THREE.Matrix4().makeRotationZ(a - PI / 2).setPosition((Cy.r - 0.035) * c, (Cy.r - 0.035) * s, 0)))
  }
  return merge(...parts)
}

/** Concave: transverse bars on an arc below the cylinder, side plates (radius set by the clearance). */
export function concaveGeometry(clearanceMm: number) {
  const Cy = D.cyl
  const hw = Cy.halfWidth + 0.01
  const R = Cy.r + clearanceMm / 1000 + 0.012
  const a0 = (-28 * PI) / 180
  const a1 = (-148 * PI) / 180
  const parts: THREE.BufferGeometry[] = []
  const n = 16
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    parts.push(xform(slab(-0.008, -0.012, 0.008, 0.012, -hw, hw), new THREE.Matrix4().makeRotationZ(a + PI / 2).setPosition(R * Math.cos(a), R * Math.sin(a), 0)))
  }
  // side plates: thick arcs
  const arc: V2[] = []
  for (let i = 0; i <= 24; i++) {
    const a = a0 + ((a1 - a0) * i) / 24
    arc.push([(R - 0.015) * Math.cos(a), (R - 0.015) * Math.sin(a)])
  }
  for (let i = 24; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / 24
    arc.push([(R + 0.07) * Math.cos(a), (R + 0.07) * Math.sin(a)])
  }
  parts.push(plateXY(arc, 0.015, hw), plateXY(arc, 0.015, -hw - 0.015))
  // wires through the bars (the slots let grain and chaff fall through)
  for (let z = -hw + 0.1; z < hw; z += 0.1) {
    const pts: THREE.Vector3[] = []
    for (let i = 0; i <= 12; i++) {
      const a = a0 + ((a1 - a0) * i) / 12
      pts.push(new THREE.Vector3(R * Math.cos(a), R * Math.sin(a), z))
    }
    parts.push(pipe(new THREE.CatmullRomCurve3(pts), 0.004, 0, 24, 6))
  }
  return merge(...parts)
}

export function beaterGeometry() {
  const B = D.beater
  const hw = D.cyl.halfWidth
  const parts = [shaftZ(0, 0, 0.05, -hw - 0.1, hw + 0.1, 20)]
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * 2 * PI
    parts.push(xform(slab(0.04, -0.008, B.r, 0.008, -hw, hw), mat4.rz(a)))
  }
  return merge(...parts)
}

/* ------------------------------ Separating and cleaning ------------------------------ */

const W = D.walkers
/** Walker base-line height at x (rises towards the rear). */
export const walkerBase = (x: number) => 1.2 + (W.x0 - x) * 0.075
export const walkerWidth = (2 * D.cyl.halfWidth) / W.n

/** One straw walker: a stepped (saw-tooth) trough, side view extruded across its width. */
export function walkerGeometry() {
  const pts: V2[] = []
  const steps = 5
  const L = (W.x0 - W.x1) / steps
  pts.push([W.x0, walkerBase(W.x0)])
  pts.push([W.x1, walkerBase(W.x1)])
  for (let i = 0; i < steps; i++) {
    const xr = W.x1 + i * L
    const xf = xr + L
    pts.push([xr, walkerBase(xr) + 0.24])
    pts.push([xf - 0.02, walkerBase(xf) + 0.1])
  }
  const t = walkerWidth - 0.02
  return plateXY(pts, t, -t / 2)
}

/** Crankshaft carrying the walkers, local origin on its axis; throws at the walker phases. */
export function walkerCrankGeometry() {
  const hw = D.cyl.halfWidth
  const r = W.crankR
  const parts = [shaftZ(0, 0, 0.03, -hw - 0.08, -hw + 0.02, 16), shaftZ(0, 0, 0.03, hw - 0.02, hw + 0.08, 16)]
  for (let k = 0; k < W.n; k++) {
    const zc = -hw + walkerWidth * (k + 0.5)
    const a = WALKER_PHASE[k]
    const px = r * Math.cos(a)
    const py = r * Math.sin(a)
    parts.push(rod([px, py, zc - walkerWidth / 2 + 0.01], [px, py, zc + walkerWidth / 2 - 0.01], 0.022, 12))
    parts.push(bar([0, 0, zc - walkerWidth / 2 + 0.005], [px * 1.3 + 1e-4, py * 1.3, zc - walkerWidth / 2 + 0.005], 0.012, 0.05))
    parts.push(bar([0, 0, zc + walkerWidth / 2 - 0.005], [px * 1.3 + 1e-4, py * 1.3, zc + walkerWidth / 2 - 0.005], 0.012, 0.05))
  }
  return merge(...parts)
}

/** Grain pan (under the concave) and return pan (under the walkers) — move with the shoe. */
export function pansGeometry() {
  const hw = D.cyl.halfWidth + 0.04
  return merge(bar([2.25, 0.98, 0], [1.08, 0.9, 0], 2 * hw, 0.015), bar([1.0, 1.0, 0], [-1.7, 1.15, 0], 2 * hw, 0.015), slab(1.0, 0.9, 1.02, 1.0, -hw, hw))
}

/** Adjustable-louvre sieve (chaffer or lower sieve) in its frame. */
export function sieveGeometry(x0: number, x1: number, y: number, pitch: number, tilt: number) {
  const hw = D.cyl.halfWidth + 0.03
  const parts = [slab(x1, y - 0.04, x0, y + 0.03, hw, hw + 0.015), slab(x1, y - 0.04, x0, y + 0.03, -hw - 0.015, -hw), slab(x1 - 0.015, y - 0.04, x1, y + 0.03, -hw, hw), slab(x0, y - 0.04, x0 + 0.015, y + 0.03, -hw, hw)]
  for (let x = x1 + pitch; x < x0 - pitch / 2; x += pitch) parts.push(xform(slab(-pitch * 0.45, -0.002, pitch * 0.45, 0.002, -hw, hw), new THREE.Matrix4().makeRotationZ(tilt).setPosition(x, y, 0)))
  return merge(...parts)
}

export function fanRotorGeometry() {
  const hw = D.cyl.halfWidth + 0.02
  const parts = [shaftZ(0, 0, 0.035, -hw - 0.1, hw + 0.1, 16)]
  for (let k = 0; k < 6; k++) parts.push(xform(slab(0.05, -0.006, D.fan.r, 0.006, -hw, hw), mat4.rz((k / 6) * 2 * PI)))
  return merge(...parts)
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
  return merge(shaftZ(0, 0, 0.03, z1, z0, 16), flight(0, 0, 0.085, z1 + 0.02, z0 - 0.02, 7, 0.016))
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
  const hw = D.body.hw - 0.05
  return merge(shaftZ(0, 0, 0.06, -hw, hw, 16), ...[0, 1, 2, 3, 4, 5].map((k) => xform(slab(0.05, -0.005, 0.22, 0.005, -hw, hw), mat4.rz((k / 6) * 2 * PI))))
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
