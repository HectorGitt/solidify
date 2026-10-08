import * as THREE from 'three'
import { box, cylinder, extrude, helixSpring, lathe, mat4, merge, roundedRect, tube, xform, type V2 } from '@/geometry'
import { hexBolt, sprocket, torus } from '@/geometry/parts'
import { DIM, RS, type ChainType, type ShoeType } from './model'

/**
 * Undercarriage geometry. Link-local frame (for the instanced chain): x along the chain from the
 * bushing joint (x = −p/2) to the pin joint (x = +p/2), y outward (shoe side), z across the track.
 */
const { PI } = Math
const p = DIM.pitch
const alongZ = mat4.rx(PI / 2)

/** Offset ("cranked") link: inner half round the bushing, outer half round the pin, both sides. */
export function linkGeometry() {
  const h = 2 * DIM.rail
  const t = DIM.linkT
  const half = (x0: number, x1: number, z: number) => {
    const s = roundedRect(x1 - x0, h, 0.035, (x0 + x1) / 2, 0)
    return xform(extrude(s, t, { curveSegments: 4 }), mat4.t(0, 0, z))
  }
  const zi = DIM.gauge - t / 2
  const zo = DIM.gauge + t / 2
  return merge(
    half(-p / 2 - 0.04, 0.004, zi),
    half(-p / 2 - 0.04, 0.004, -zi),
    half(-0.004, p / 2 + 0.04, zo),
    half(-0.004, p / 2 + 0.04, -zo),
  )
}

/** Bushing pressed into the inner link halves; interlocking bushings reach into counterbores of the outer links (Fig 6). */
export function bushingGeometry(chain: ChainType) {
  const len = 2 * DIM.gauge + (chain === 'interlocking' ? 2 * 0.012 : 0)
  return xform(tube(DIM.bushingR, DIM.bushingIn, len, 24), mat4.c(mat4.t(-p / 2, 0, 0), alongZ))
}

/** Pin pressed into the outer link halves, turning inside the next link's bushing. */
export function pinGeometry() {
  return xform(cylinder(DIM.pinR, 2 * (DIM.gauge + DIM.linkT) + 0.012, 16), mat4.c(mat4.t(p / 2, 0, 0), alongZ))
}

/** Master pin with its snap ring (Fig 4): the one pin removed to split the track. */
export function masterPinGeometry() {
  const L = 2 * (DIM.gauge + DIM.linkT) + 0.03
  const pin = xform(cylinder(DIM.pinR, L, 20), mat4.c(mat4.t(p / 2, 0, 0.009), alongZ))
  const head = xform(cylinder(DIM.pinR + 0.008, 0.01, 20), mat4.c(mat4.t(p / 2, 0, -(DIM.gauge + DIM.linkT) - 0.006), alongZ))
  const ring = xform(torus(DIM.pinR + 0.002, 0.003, 8, 24), mat4.t(p / 2, 0, DIM.gauge + DIM.linkT + 0.012))
  return merge(pin, head, ring)
}

/** Track shoe of the chosen type (Fig 5), bolted to the outer face of the links. */
export function shoeGeometry(type: ShoeType) {
  const L = p * 0.97
  const W = DIM.shoeW
  const y0 = DIM.rail
  const T = type === 'rubber' ? 0.03 : DIM.plateT
  const s = new THREE.Shape()
  s.moveTo(-L / 2, -W / 2)
  s.lineTo(L / 2, -W / 2)
  s.lineTo(L / 2, W / 2)
  s.lineTo(-L / 2, W / 2)
  s.lineTo(-L / 2, -W / 2)
  const hole = (cx: number, cz: number, hx: number, hz: number, round: boolean) => {
    const hp = new THREE.Path()
    if (round) {
      hp.absellipse(cx, cz, hx, hz, 0, 2 * PI, true, 0)
    } else {
      hp.moveTo(cx - hx, cz - hz)
      hp.lineTo(cx - hx, cz + hz)
      hp.lineTo(cx + hx, cz + hz)
      hp.lineTo(cx + hx, cz - hz)
      hp.lineTo(cx - hx, cz - hz)
    }
    s.holes.push(hp)
  }
  if (type === 'open') hole(-0.012, 0, 0.032, 0.055, true)
  if (type === 'snow') hole(-0.012, 0, 0.022, 0.07, true)
  if (type === 'multi') {
    hole(0, 0.05, 0.012, 0.022, false)
    hole(0, -0.05, 0.012, 0.022, false)
  }
  // extrude along Z, then lay the plate in the x–z plane with its thickness along +y
  const plate = xform(extrude(s, T, { curveSegments: 16 }), mat4.c(mat4.t(0, y0 + T / 2, 0), mat4.rx(PI / 2)))
  const parts = [plate]
  const grouser = (x: number, hgt: number, w = 0.02) => parts.push(xform(box(w, hgt, W), mat4.t(x, y0 + T + hgt / 2 - 0.001, 0)))
  if (type === 'standard') grouser(0.045, 0.04)
  if (type === 'open') grouser(0.06, 0.04, 0.018)
  if (type === 'snow') grouser(0.06, 0.028, 0.016)
  if (type === 'multi') {
    grouser(-0.055, 0.015, 0.016)
    grouser(0.03, 0.015, 0.016)
    grouser(0.07, 0.015, 0.012)
  }
  return merge(...parts)
}

/** Height of the shoe's outer face above the pitch line (grouser tips). */
export function shoeReach(type: ShoeType) {
  return DIM.rail + (type === 'rubber' ? 0.03 : DIM.plateT + ({ standard: 0.04, open: 0.04, snow: 0.028, multi: 0.015, rubber: 0 } as const)[type])
}

/** Shoe bolt (head on the shoe, shank into the link), 4 per shoe. */
export function boltGeometry() {
  return hexBolt(0.016, 0.045)
}

export const BOLT_OFFSETS: [number, number][] = [
  [-0.035, DIM.gauge],
  [0.035, DIM.gauge],
  [-0.035, -DIM.gauge],
  [0.035, -DIM.gauge],
]

/** Drive sprocket: z odd teeth at half the chain pitch (hunting tooth), hub and mounting flange. */
export function sprocketGeometry() {
  const chord = 2 * RS * Math.sin(PI / DIM.teeth)
  const rim = sprocket(DIM.teeth, chord, 2 * DIM.bushingR, 0.07, 0.1)
  const hub = xform(lathe([[0.06, -0.12], [0.16, -0.12], [0.16, -0.035], [0.105, -0.035], [0.105, 0.035], [0.16, 0.035], [0.16, 0.09], [0.06, 0.09]], 48), alongZ)
  const disc = xform(tube(RS - 0.04, 0.1, 0.03, 64), alongZ)
  return merge(rim, hub, disc)
}

/** Front idler: treads under the two link rails and a centre flange that runs between the links. */
export function idlerGeometry() {
  const Rt = DIM.idlerR - DIM.rail
  const g = DIM.gauge
  const prof: V2[] = [
    [0.05, -0.2],
    [0.12, -0.2],
    [0.12, -g - 0.04],
    [Rt, -g - 0.035],
    [Rt, -0.085],
    [Rt + 0.013, -0.075],
    [Rt + 0.013, 0.075],
    [Rt, 0.085],
    [Rt, g + 0.035],
    [0.12, g + 0.04],
    [0.12, 0.2],
    [0.05, 0.2],
  ]
  // lathe profile is (r, y): flip to CCW
  return xform(lathe(prof.map(([r, y]) => [r, -y] as V2).reverse(), 72), alongZ)
}

/** Flanged roller running on the link rails (track or carrier roller). */
export function rollerGeometry(r: number) {
  const g = DIM.gauge
  const f = r + 0.025
  const prof: V2[] = [
    [0.03, -g - 0.075],
    [0.055, -g - 0.075],
    [0.055, -g - 0.045],
    [f, -g - 0.045],
    [f, -g - 0.03],
    [r, -g - 0.022],
    [r, -g + 0.04],
    [r - 0.012, -g + 0.05],
    [r - 0.012, g - 0.05],
    [r, g - 0.04],
    [r, g + 0.022],
    [f, g + 0.03],
    [f, g + 0.045],
    [0.055, g + 0.045],
    [0.055, g + 0.075],
    [0.03, g + 0.075],
  ]
  return xform(lathe(prof.map(([rr, y]) => [rr, -y] as V2).reverse(), 48), alongZ)
}

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
  return xform(helixSpring(0.072, 0.013, 1, 7), mat4.rz(-PI / 2))
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
