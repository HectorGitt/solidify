import * as THREE from 'three'
import { box, lathe, merge } from '@/geometry'
import { bar, plateXY, smooth, sweepRings, thickSurface, type P3 } from '../_shared/geom'
import { pathBar } from '../_tillage/parts'
import type { Board } from './model'

/**
 * One right-hand mouldboard bottom. Local frame: x forward, y up, z left; the furrow floor is
 * y = 0, the landside face is z = 0 and the share point is at the origin. The bottom cuts the
 * strip z ∈ [−w, 0] and turns the slice over to the right (−z). Typical proportions for a
 * 300 mm (12 in) bottom; the notes give the parts but no dimensions.
 */

const deg = Math.PI / 180

export interface BoardShape {
  /** final turn of the slice, rad */
  thetaMax: number
  /** x where the turn starts and how long it takes */
  x0: number
  len: number
  /** board tail at the bottom and at the top */
  tailLow: number
  tailHigh: number
}

export const BOARDS: Record<Board, BoardShape> = {
  // longer board, turns the slice gradually
  general: { thetaMax: 128 * deg, x0: -0.22, len: 0.78, tailLow: -0.78, tailHigh: -1.02 },
  // short, steep board, turns the slice quickly and breaks it up
  stubble: { thetaMax: 140 * deg, x0: -0.2, len: 0.55, tailLow: -0.64, tailHigh: -0.82 },
  // same shape as general purpose, built from slats so sticky soil does not cling
  slatted: { thetaMax: 128 * deg, x0: -0.22, len: 0.78, tailLow: -0.78, tailHigh: -1.02 },
}

const LIFT = Math.tan(18 * deg)
/** height of the share / board lift plane at x (the slice is lifted by the share wedge first) */
export const liftY = (x: number) => Math.min(Math.max(-x, 0), 0.26) * LIFT
/** turn of the slice at x */
export const turnAt = (s: BoardShape, x: number) => s.thetaMax * smooth((-x + s.x0) / s.len)

/** Point on the slice-supporting line at x, distance s from the wing-edge pivot (z = −w). */
function onBoard(s: BoardShape, w: number, x: number, dist: number) {
  const th = turnAt(s, x)
  return new THREE.Vector3(x, liftY(x) + dist * Math.sin(th), -w + dist * Math.cos(th))
}

export interface BottomGeo {
  share: THREE.BufferGeometry
  board: THREE.BufferGeometry
  landside: THREE.BufferGeometry
  heel: THREE.BufferGeometry
  frog: THREE.BufferGeometry
  shin: THREE.BufferGeometry
  standard: THREE.BufferGeometry
  slice: THREE.BufferGeometry
  /** curve along the top of the turning slice (for clod particles) */
  sliceCurve: THREE.CatmullRomCurve3
  /** x of the wing (end of the cutting edge) */
  wingX: number
}

/**
 * @param vs, hs  vertical / horizontal suction (m, as drawn): the share point is bent down by vs
 * and towards the land by hs, below and beyond the landside line.
 * @param beamY   height of the plough beam above the furrow floor (top of the standard)
 */
export function buildBottom(w: number, d: number, board: Board, vs: number, hs: number, beamY: number): BottomGeo {
  const S = BOARDS[board]
  const wingX = -1.2 * w
  const chord = 0.13

  // ---- share: cutting edge from the point (landside) back to the wing, lifting rearward ----
  const share = thickSurface(
    (u, v) => {
      const k = Math.pow(1 - u, 3)
      const ex = wingX * u
      const ez = -w * u + hs * k
      const ey = -vs * k
      const x = ex - v * chord
      return new THREE.Vector3(x, ey * (1 - v) + liftY(x) * v, ez)
    },
    12,
    3,
    0.009,
  )

  // ---- mouldboard: the slice-supporting surface, twisted from the share lift to the turn ----
  const xf = (v: number) => (wingX - chord) * (1 - v) + -0.14 * v
  const xr = (v: number) => S.tailLow + (S.tailHigh - S.tailLow) * v
  const reach = 1.1 * w
  const surf = (u: number, v: number) => {
    const x = xf(v) + (xr(v) - xf(v)) * u
    return onBoard(S, w, x, v * reach)
  }
  let boardG: THREE.BufferGeometry
  if (board === 'slatted') {
    const slats: THREE.BufferGeometry[] = []
    const n = 5
    for (let i = 0; i < n; i++) {
      const v0 = 0.04 + (i / n) * 0.96
      const v1 = v0 + (0.96 / n) * 0.62
      slats.push(thickSurface((u, v) => surf(u, v0 + (v1 - v0) * v), 22, 2, 0.008))
    }
    boardG = merge(...slats)
  } else boardG = thickSurface(surf, 26, 10, 0.008)

  // ---- landside and its detachable heel, pressing on the furrow wall (z = 0) ----
  const landside = box(0.72, 0.13, 0.014)
  landside.translate(-0.12 - 0.36, 0.065 + 0.004, -0.007)
  const heel = box(0.14, 0.1, 0.016)
  heel.translate(-0.84 - 0.07, 0.05, -0.008)

  // ---- frog: the casting that the share, mouldboard and landside bolt to ----
  const frog = plateXY(
    [
      [-0.16, 0.012],
      [-0.82, 0.012],
      [-0.82, 0.14],
      [-0.58, 0.22],
      [-0.34, 0.07],
    ],
    0.11,
    -0.015 - 0.055,
  )
  frog.translate(0, 0, -0.055)
  // shin: the leading edge of the mouldboard above the share point
  const shin = thickSurface(
    (u, v) => {
      const y = 0.02 + u * (0.28 + d * 0.2)
      const x = -0.1 - u * 0.12
      const p = onBoard(S, w, x, reach)
      return new THREE.Vector3(x - v * 0.05, y, Math.min(p.z, -0.004) * 0 - 0.004 - v * 0.03)
    },
    6,
    2,
    0.01,
  )

  // ---- standard (leg) from the frog up to the beam ----
  const standard = pathBar(
    [
      [-0.62, 0.17, -0.07],
      [-0.6, 0.35, -0.07],
      [-0.52, beamY - 0.12, -0.07],
      [-0.5, beamY, -0.07],
    ],
    0.03,
    0.075,
    12,
  )

  // ---- the furrow slice: a w × d strip lifted by the share and turned by the board ----
  const rings: THREE.Vector3[][] = []
  const tops: THREE.Vector3[] = []
  const xEnd = Math.min(S.tailHigh, S.tailLow) - 0.55
  for (let x = -0.04; x >= xEnd; x -= 0.03) {
    const th = turnAt(S, x) * (1 + 0.05 * smooth((S.tailLow - x) / 0.4))
    const piv = new THREE.Vector2(-w, liftY(x) * (1 - smooth((S.tailLow - x) / 0.35)))
    const dir = new THREE.Vector2(Math.cos(th), Math.sin(th))
    const nrm = new THREE.Vector2(-Math.sin(th), Math.cos(th))
    const c = [piv.clone(), piv.clone().addScaledVector(dir, w), piv.clone().addScaledVector(dir, w).addScaledVector(nrm, d), piv.clone().addScaledVector(nrm, d)]
    const minY = Math.min(...c.map((p) => p.y))
    const lift = Math.max(0, -minY) + 0.002
    rings.push(c.map((p) => new THREE.Vector3(x, p.y + lift, p.x)))
    const mid = c[1].clone().add(c[2]).multiplyScalar(0.5).lerp(c[0].clone().add(c[3]).multiplyScalar(0.5), 0.5)
    const top = c[2].clone().add(c[3]).multiplyScalar(0.5).lerp(mid, 0.3)
    if (rings.length % 3 === 1) tops.push(new THREE.Vector3(x, top.y + lift + 0.01, top.x))
  }
  const slice = sweepRings(rings, Math.PI / 3)
  const sliceCurve = new THREE.CatmullRomCurve3(tops)

  return { share, board: boardG, landside, heel, frog, shin, standard, slice, sliceCurve, wingX }
}

/** Flat disc coulter (axis along Z) with a sharpened rim. */
export function coulterDisc(R: number, t = 0.006) {
  const g = lathe(
    [
      [0.03, -t],
      [R - 0.012, -t],
      [R, 0],
      [R - 0.012, t],
      [0.03, t],
    ],
    64,
  )
  const hub = lathe([[0.012, -0.035], [0.045, -0.035], [0.045, 0.035], [0.012, 0.035]], 24)
  const m = merge(g, hub)
  m.rotateX(Math.PI / 2)
  return m
}

/** Coulter shank: from the beam down to the hub, ending in a fork (beam end at the origin). */
export function coulterShank(hub: P3, top: P3) {
  const mid: P3 = [(hub[0] + top[0]) / 2 + 0.05, (hub[1] + top[1]) / 2, hub[2]]
  const arm = pathBar([top, mid, [hub[0] + 0.02, hub[1] + 0.06, hub[2]]], 0.03, 0.05, 10)
  const forkL = bar([hub[0] + 0.02, hub[1] + 0.06, hub[2] + 0.03], [hub[0], hub[1], hub[2] + 0.03], 0.012, 0.04)
  const forkR = bar([hub[0] + 0.02, hub[1] + 0.06, hub[2] - 0.03], [hub[0], hub[1], hub[2] - 0.03], 0.012, 0.04)
  const bridge = box(0.05, 0.03, 0.08)
  bridge.translate(hub[0] + 0.025, hub[1] + 0.07, hub[2])
  return merge(arm, forkL, forkR, bridge)
}
