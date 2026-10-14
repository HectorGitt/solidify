import * as THREE from 'three'
import { box, cylinder, extrude, mat4, merge, tube, xform } from '@/geometry'
import { coilSpring } from '@/parts/lib/chassis'
import {
  shoeBolt,
  shoeBoltOffsets,
  shoeReach as libShoeReach,
  trackBushing,
  trackIdler,
  trackLink,
  trackMasterPin,
  trackPin,
  trackRoller,
  trackShoe,
  trackSprocket,
  type TrackSpec,
} from '@/parts/lib/wheels'
import { DIM, type ChainType, type ShoeType } from './model'

/**
 * Undercarriage geometry. The track chain and running gear (links, bushings, pins, shoes, bolts,
 * sprocket, idler, rollers) come from the parts library (`@/parts/lib/wheels`), sized by DIM; the
 * frame, guards and tension mechanism of this undercarriage stay here.
 * Link-local frame (for the instanced chain): x along the chain from the bushing joint
 * (x = −p/2) to the pin joint (x = +p/2), y outward (shoe side), z across the track.
 */
const { PI } = Math
const alongZ = mat4.rx(PI / 2)
/** this undercarriage's track spec (DIM is the parts library's CRAWLER_TRACK default) */
const SPEC: TrackSpec = DIM

/** Offset ("cranked") link: inner half round the bushing, outer half round the pin, both sides. */
export const linkGeometry = () => trackLink(SPEC)
/** Bushing pressed into the inner link halves; interlocking bushings reach into counterbores of the outer links (Fig 6). */
export const bushingGeometry = (chain: ChainType) => trackBushing(chain, SPEC)
/** Pin pressed into the outer link halves, turning inside the next link's bushing. */
export const pinGeometry = () => trackPin(SPEC)
/** Master pin with its snap ring (Fig 4): the one pin removed to split the track. */
export const masterPinGeometry = () => trackMasterPin(SPEC)

/** Track shoe of the chosen type (Fig 5), bolted to the outer face of the links. */
export const shoeGeometry = (type: ShoeType) => trackShoe(type, SPEC)
/** Height of the shoe's outer face above the pitch line (grouser tips). */
export const shoeReach = (type: ShoeType) => libShoeReach(type, SPEC)
/** Shoe bolt (head on the shoe, shank into the link), 4 per shoe. */
export const boltGeometry = shoeBolt
export const BOLT_OFFSETS: [number, number][] = shoeBoltOffsets(SPEC)
/** Drive sprocket: z odd teeth at half the chain pitch (hunting tooth), hub and mounting flange. */
export const sprocketGeometry = () => trackSprocket(SPEC)
/** Front idler: treads under the two link rails and a centre flange that runs between the links. */
export const idlerGeometry = () => trackIdler(SPEC)
/** Flanged roller running on the link rails (track or carrier roller). */
export const rollerGeometry = (r: number) => trackRoller(r, SPEC)

/** Track frame: box-section beam (four plates, hollow so the recoil spring can be seen in section). */
export const FRAME = { x0: -1.0, x1: 1.02, y0: 0.37, y1: 0.58, z: 0.13, t: 0.014 }
export function frameGeometry() {
  const { x0, x1, y0, y1, z, t } = FRAME
  const L = x1 - x0
  const cx = (x0 + x1) / 2
  const top = xform(box(L, t, 2 * z), mat4.t(cx, y1 - t / 2, 0))
  const bot = xform(box(L, t, 2 * z), mat4.t(cx, y0 + t / 2, 0))
  const s1 = xform(box(L, y1 - y0 - 2 * t, t), mat4.t(cx, (y0 + y1) / 2, z - t / 2))
  const s2 = xform(box(L, y1 - y0 - 2 * t, t), mat4.t(cx, (y0 + y1) / 2, -z + t / 2))
  const endPlate = xform(box(t, y1 - y0 - 2 * t, 2 * z - 2 * t), mat4.t(x0 + t / 2, (y0 + y1) / 2, 0))
  // roller brackets and the carrier-roller post
  const parts = [top, bot, s1, s2, endPlate]
  for (const x of DIM.rollersX) {
    for (const zz of [1, -1]) parts.push(xform(box(0.08, 0.13, 0.03), mat4.t(x, 0.31, zz * (DIM.gauge + 0.075 + 0.02))))
  }
  return merge(...parts)
}

export function carrierPostGeometry(yc: number) {
  return merge(
    xform(box(0.07, yc - FRAME.y1 + 0.02, 0.05), mat4.t(DIM.xc, (yc + FRAME.y1) / 2, -DIM.gauge - 0.11)),
    xform(cylinder(0.025, 0.2, 20), mat4.c(mat4.t(DIM.xc, yc, -DIM.gauge - 0.04), alongZ)),
  )
}

/** Roller guards: side plates below the frame (protect rollers, keep debris out, guide the track). */
export function guardGeometry() {
  const L = 1.95
  const s = new THREE.Shape()
  s.moveTo(-L / 2, 0)
  s.lineTo(L / 2, 0)
  s.lineTo(L / 2 - 0.06, -0.19)
  s.lineTo(-L / 2 + 0.06, -0.19)
  s.lineTo(-L / 2, 0)
  for (let i = 0; i < 4; i++) {
    const cx = -0.6 + i * 0.4
    const h = new THREE.Path()
    h.moveTo(cx - 0.09, -0.04)
    h.lineTo(cx, -0.14)
    h.lineTo(cx + 0.09, -0.04)
    h.lineTo(cx - 0.09, -0.04)
    s.holes.push(h)
  }
  const plate = extrude(s, 0.012, { curveSegments: 4 })
  const zg = DIM.gauge + 0.125
  return merge(xform(plate, mat4.t(0.01, FRAME.y0 + 0.005, zg)), xform(plate, mat4.t(0.01, FRAME.y0 + 0.005, -zg)))
}

/** Recoil spring: unit length along +X (scaled to its working length). */
export function springGeometry() {
  return coilSpring({ coilR: 0.072, wireR: 0.013, turns: 7, axis: 'x' })
}

/** Hydraulic (grease) track adjuster: cylinder on the spring, rod to the idler yoke, grease fitting and relief valve. */
export function adjusterGeometry() {
  const body = xform(tube(0.05, 0.035, 0.26, 32), mat4.rz(-PI / 2))
  const cap = xform(cylinder(0.05, 0.02, 32), mat4.c(mat4.t(-0.13 - 0.01, 0, 0), mat4.rz(-PI / 2)))
  const fitting = xform(cylinder(0.008, 0.07, 12), mat4.t(-0.08, 0.075, 0))
  const nipple = xform(cylinder(0.012, 0.015, 12), mat4.t(-0.08, 0.115, 0))
  return { body: merge(body, cap), fitting: merge(fitting, nipple) }
}

/** Piston rod of unit length along +X. */
export function rodGeometry() {
  return xform(cylinder(0.03, 1, 24), mat4.c(mat4.t(0.5, 0, 0), mat4.rz(-PI / 2)))
}

/** Idler yoke blocks that slide on the frame. */
export function yokeGeometry() {
  const z = DIM.gauge + 0.13
  return merge(
    xform(box(0.24, 0.11, 0.04), mat4.t(0, 0, z)),
    xform(box(0.24, 0.11, 0.04), mat4.t(0, 0, -z)),
    xform(box(0.06, 0.11, 2 * z), mat4.t(-0.25, 0, 0)),
    xform(cylinder(0.045, 2 * z + 0.04, 24), alongZ),
  )
}

export function groundGeometry() {
  return box(4.6, 0.12, 1.4)
}

export function imprintGeometry() {
  return box(0.035, 0.004, DIM.shoeW)
}
