import * as THREE from 'three'
import { box, cylinder, extrudeTwisted, lathe, mat4, xform, type V2 } from '@/geometry'
import { bandLayout } from './model'

/**
 * Geometry for the clutch & brake scene. Clutches are lathed in a Y-axis frame (the scene turns
 * them so the shafts run along X); brakes are drawn in the XY plane with drum axes along Z.
 * All solids are closed lathes or extrusions. Millimetre profiles are scaled to metres.
 */

const { PI, cos, sin } = Math
const MM = 0.001
export const lathMM = (pts: V2[], seg = 64) => lathe(pts.map(([r, y]) => [r * MM, y * MM] as V2), seg)
const along = { z: mat4.rx(PI / 2) }

/* ------------------------------ Multiple-disc clutch (Fig 14-1) ------------------------------ */

export const DISC = { steelT: 2.5, bronzeT: 3, gap: 2, y0: -10, collarT: 5 }

export function discClutchParts(RoMM: number, RiMM: number) {
  const steelOut = RoMM + 1
  const bronzeIn = RiMM
  const drumIn = Math.max(steelOut + 8, RoMM + 9)
  return {
    shaftC: xform(cylinder(20 * MM, 90 * MM, 32), mat4.t(0, 35 * MM, 0)),
    shaftD: xform(cylinder(15 * MM, 50 * MM, 32), mat4.t(0, -40 * MM, 0)),
    housing: lathMM([[0, -15], [drumIn + 5, -15], [drumIn + 5, 24], [drumIn, 24], [drumIn, -12], [0, -12]], 72),
    steel: lathMM([[20, 0], [steelOut, 0], [steelOut, DISC.steelT], [20, DISC.steelT]], 72),
    bronze: lathMM([[bronzeIn, 0], [drumIn - 0.5, 0], [drumIn - 0.5, DISC.bronzeT], [bronzeIn, DISC.bronzeT]], 72),
    collar: lathMM([[20, 0], [steelOut - 2, 0], [steelOut - 2, DISC.collarT], [20, DISC.collarT]], 64),
    drumIn: drumIn * MM,
  }
}

/** y (mm) of each plate's lower face for engagement e (0…1); plates alternate steel/bronze starting with steel. */
export function plateStack(nSteel: number, nBronze: number, e: number) {
  const out: { steel: boolean; y: number }[] = []
  let y = DISC.y0
  let s = nSteel
  let b = nBronze
  let steelTurn = true
  while (s + b > 0) {
    const steel: boolean = (steelTurn && s > 0) || b === 0
    if (steel) s--
    else b--
    steelTurn = !steel
    out.push({ steel, y })
    y += (steel ? DISC.steelT : DISC.bronzeT) + (1 - e) * DISC.gap
  }
  return { plates: out, collarY: y }
}

/* ------------------------------ Cone clutch ------------------------------ */

export function coneClutchParts(RoMM: number, RiMM: number, alpha: number) {
  const h = (RoMM - RiMM) / Math.tan(alpha)
  const lin = 2
  return {
    h: h * MM,
    cone: lathMM([[18, 0], [RiMM, 0], [RoMM, h], [RoMM, h + 10], [18, h + 10]], 72),
    lining: lathMM([[RiMM, 0.5], [RiMM + lin, 0.5], [RoMM + lin, h - 0.5], [RoMM, h - 0.5]], 72),
    cup: lathMM([[0, -12], [RoMM + 14, -12], [RoMM + 14, h], [RoMM + lin, h], [RiMM + lin, 0], [0, 0]], 72),
    shaftIn: xform(cylinder(18 * MM, 80 * MM, 32), mat4.t(0, (h + 40) * MM, 0)),
    shaftOut: xform(cylinder(18 * MM, 50 * MM, 32), mat4.t(0, -37 * MM, 0)),
  }
}

/* ------------------------------ Brake drums ------------------------------ */

/** Drum with hub, web and rim, axis along Z, sizes in mm. */
export function drum(R: number, half: number, hub = 25) {
  const rim = R - 30 * (R / 360)
  const g = lathMM(
    [
      [hub, -half],
      [hub * 2.4, -half],
      [hub * 2.4, -8],
      [rim, -8],
      [rim, -half],
      [R, -half],
      [R, half],
      [rim, half],
      [rim, 8],
      [hub * 2.4, 8],
      [hub * 2.4, half],
      [hub, half],
    ],
    96,
  )
  return g.applyMatrix4(along.z)
}

/** Annular sector (shoe or lining) in the XY plane between radii r0, r1 and angles a0…a1, extruded along Z. */
export function sector(r0: number, r1: number, a0: number, a1: number, depth: number, n = 24) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(r1 * cos(a), r1 * sin(a)))
  }
  for (let i = n; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(r0 * cos(a), r0 * sin(a)))
  }
  return extrudeTwisted(pts, [], depth)
}

/** A thin strip of thickness t following a polyline in the XY plane, extruded `width` along Z. */
export function strip(line: THREE.Vector2[], t: number, width: number) {
  const n = line.length
  const outer: THREE.Vector2[] = []
  const inner: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) {
    const prev = line[Math.max(0, i - 1)]
    const next = line[Math.min(n - 1, i + 1)]
    const d = next.clone().sub(prev).normalize()
    const nrm = new THREE.Vector2(-d.y, d.x)
    outer.push(line[i].clone().addScaledVector(nrm, t / 2))
    inner.push(line[i].clone().addScaledVector(nrm, -t / 2))
  }
  return extrudeTwisted([...outer, ...inner.reverse()], [], width)
}

/** Band-brake band: from the fixed pivot O, round the drum over the top, to the lever point A. */
export function bandPath(r: number, wrap: number, la: number, t: number, leverTop: number) {
  const L = bandLayout(r, wrap, la)
  const rc = r + t / 2
  const pts: THREE.Vector2[] = [new THREE.Vector2(-la / 2, -L.h + leverTop)]
  const n = 96
  // from the left tangent angle round the top (decreasing angle) to the right one
  const a0 = L.tl + 2 * PI
  const a1 = L.tr
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    pts.push(new THREE.Vector2(rc * cos(a), rc * sin(a)))
  }
  pts.push(new THREE.Vector2(la / 2, -L.h + leverTop))
  return { pts, ...L }
}

export function stand(x: number, z: number, yTop: number, yFloor: number, w = 0.05, d = 0.06) {
  return xform(box(w, yTop - yFloor, d), mat4.t(x, (yTop + yFloor) / 2, z))
}

export function pin(r: number, len: number) {
  return xform(cylinder(r, len, 20), along.z)
}
