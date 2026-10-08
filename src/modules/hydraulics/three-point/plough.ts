import * as THREE from 'three'
import { box, cylinder, extrude, mat4, merge, tube, xform } from '@/geometry'
import { hitchToWorld } from '@/physics/linkageControl'
import type { LinkagePose, P2 } from '@/tractor/linkage'

/**
 * Two-furrow fully mounted mouldboard plough, drawn in the hitch frame of the shared tractor
 * (origin at the lower hitch pins' midpoint, +Y up the mast, −X rearward, Z lateral).
 * Typical proportions (beyond the notes, which name the plough parts but give no sizes).
 */
export const PLOUGH = {
  /** share points of the two bodies (hitch frame x, lateral z) */
  bodies: [
    { x: -0.6, z: 0.08 },
    { x: -1.25, z: -0.27 },
  ],
  /** share height below the lower hitch pins */
  shareY: -0.56,
  /** furrow width per body, m */
  furrow: 0.35,
  /** centre of soil resistance, hitch-frame x (its height is ⅓ of the depth above the shares) */
  Px: -0.95,
  /** centre of gravity and mass (typical) */
  cg: { x: -0.8, y: -0.2 } as P2,
  mass: 320,
  /** frame beam height in the hitch frame */
  beamY: -0.02,
}
export const PLOUGH_WIDTH = PLOUGH.bodies.length * PLOUGH.furrow

/** Mean working depth of the shares below a level surface at y = 0 (negative = out of the ground). */
export function ploughDepth(pose: LinkagePose) {
  let s = 0
  for (const b of PLOUGH.bodies) s += hitchToWorld(pose, { x: b.x, y: PLOUGH.shareY }).y
  return -s / PLOUGH.bodies.length
}

/** Centre of soil resistance in the hitch frame for a depth d (⅓ of the depth above the shares). */
export const resistanceLocal = (d: number): P2 => ({ x: PLOUGH.Px, y: PLOUGH.shareY + Math.max(0, d) / 3 })

/** Hitch-frame geometry of the plough. `mast` = top-pin height, `spread` = lower pin spacing. */
export function ploughGeometry(mast: number, spread: number, lowerPin: number, topPin: number) {
  const half = spread / 2
  const zAxis = (g: THREE.BufferGeometry) => xform(g, mat4.rx(Math.PI / 2))
  // headstock: lower cross-shaft, two tapered plates to the top-pin bracket, pins
  const cross = xform(zAxis(cylinder(0.032, spread - 0.1, 24)), mat4.t(0, 0, 0))
  const plate = (s: number) => {
    const sh = new THREE.Shape()
    sh.moveTo(-0.06, -0.05)
    sh.lineTo(0.05, -0.05)
    sh.lineTo(0.035, mast + 0.05)
    sh.lineTo(-0.035, mast + 0.05)
    sh.closePath()
    const g = extrude(sh, 0.014)
    // lean the plate inward: lower end at z = ±(half − 0.09), upper at ±0.06
    const lean = Math.atan2(half - 0.09 - 0.06, mast)
    return xform(g, mat4.c(mat4.t(0, 0, s * (half - 0.09)), mat4.rx(-s * lean), mat4.t(0, 0, -0.007)))
  }
  const brace = (() => {
    const L = Math.hypot(0.62, mast - 0.05)
    const b = box(L, 0.05, 0.05)
    b.translate(-L / 2, 0, 0)
    return xform(b, mat4.c(mat4.t(0, mast - 0.03, -0.04), mat4.rz(Math.atan2(mast - 0.05 - PLOUGH.beamY, 0.62))))
  })()
  const headstock = merge(cross, plate(1), plate(-1), brace)
  const lowerPins = merge(...[1, -1].map((s) => xform(zAxis(cylinder(lowerPin / 2, 0.11, 20)), mat4.t(0, 0, s * (half + 0.02)))))
  const topPinG = xform(zAxis(cylinder(topPin / 2, 0.16, 20)), mat4.t(0, mast, 0))
  // frame beam (square tube) carrying the bodies
  const beamLen = 1.55
  const beam = box(beamLen, 0.09, 0.09)
  beam.translate(-beamLen / 2 - 0.05, PLOUGH.beamY, -0.08)
  const crossBar = box(0.09, 0.07, spread - 0.25)
  crossBar.translate(-0.05, PLOUGH.beamY, 0)
  const frame = merge(beam, crossBar)

  const legs: THREE.BufferGeometry[] = []
  const boards: THREE.BufferGeometry[] = []
  const shares: THREE.BufferGeometry[] = []
  const landsides: THREE.BufferGeometry[] = []
  const legLen = PLOUGH.beamY - (PLOUGH.shareY + 0.2)
  for (const b of PLOUGH.bodies) {
    // leg (standard) from the beam down to the frog, raked slightly back
    const leg = box(0.05, legLen, 0.035)
    legs.push(xform(leg, mat4.c(mat4.t(b.x + 0.12, PLOUGH.beamY - legLen / 2, b.z), mat4.rz(0.12))))
    const clamp = box(0.12, 0.12, 0.1)
    legs.push(xform(clamp, mat4.t(b.x + 0.1, PLOUGH.beamY, b.z)))
    // mouldboard: a curved plate (concave forward-upward), angled to turn the slice toward −Z
    const R = 0.34
    const s = new THREE.Shape()
    const a0 = -Math.PI * 0.5
    const a1 = -Math.PI * 0.06
    const cx = -0.02
    const cy = R
    const n = 18
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      const px = cx - R * Math.cos(a) * 0.9
      const py = cy + R * Math.sin(a)
      if (i === 0) s.moveTo(px, py)
      else s.lineTo(px, py)
    }
    for (let i = n; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / n
      s.lineTo(cx - (R + 0.014) * Math.cos(a) * 0.9 - 0.01, cy + (R + 0.014) * Math.sin(a))
    }
    s.closePath()
    const mb = extrude(s, 0.3)
    boards.push(xform(mb, mat4.c(mat4.t(b.x, PLOUGH.shareY, b.z), mat4.ry(-0.55), mat4.t(0, 0, -0.15))))
    // share: wedge-ish plate at the front bottom
    const sh = new THREE.Shape()
    sh.moveTo(0.06, 0)
    sh.lineTo(-0.2, 0)
    sh.lineTo(-0.2, 0.05)
    sh.lineTo(-0.04, 0.03)
    sh.closePath()
    shares.push(xform(extrude(sh, 0.3), mat4.c(mat4.t(b.x, PLOUGH.shareY, b.z), mat4.ry(-0.55), mat4.t(0, 0, -0.15))))
    // landside plate along the land side of the body
    const ls = box(0.45, 0.1, 0.012)
    landsides.push(xform(ls, mat4.t(b.x - 0.2, PLOUGH.shareY + 0.06, b.z + 0.13)))
  }
  return {
    headstock,
    lowerPins,
    topPin: topPinG,
    frame,
    legs: merge(...legs),
    boards: merge(...boards),
    shares: merge(...shares),
    landsides: merge(...landsides),
  }
}

/** Automatic coupler (AEE510 Fig 43): inverted-V frame with hooks, in the hitch frame. */
export function couplerGeometry(mast: number, spread: number) {
  const half = spread / 2
  const leg = (s: number) => {
    const L = Math.hypot(half - 0.05, mast)
    const b = box(0.05, L, 0.04)
    const ang = Math.atan2(half - 0.05, mast)
    return xform(b, mat4.c(mat4.t(0.07, mast / 2, s * (half + 0.05) / 2), mat4.rx(-s * ang)))
  }
  const hookLow = (s: number) => xform(tube(0.05, 0.03, 0.05, 24), mat4.c(mat4.t(0.07, 0, s * half), mat4.rx(Math.PI / 2)))
  const hookTop = xform(box(0.1, 0.08, 0.1), mat4.t(0.07, mast, 0))
  const bar = xform(box(0.05, 0.05, spread - 0.05), mat4.t(0.07, 0.03, 0))
  const lever = xform(box(0.02, 0.3, 0.02), mat4.c(mat4.t(0.12, mast + 0.12, 0.06), mat4.rz(-0.3)))
  return { frame: merge(leg(1), leg(-1), hookLow(1), hookLow(-1), hookTop, bar), lever }
}
