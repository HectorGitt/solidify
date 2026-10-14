import * as THREE from 'three'
import { box, cylinder, extrudeTwisted, lathe, mat4, merge, tube, xform } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'
import { annulusOil, cylinderBarrel, cylinderCap, oilColumn, pistonRod, rodGland, sealedPiston } from '@/parts/lib/hydraulics'
import { ballJoint, steeringWheel } from '@/parts/lib/steeringBox'
import { AX, CYL, GEROTOR, L_AT_LEFT_LOCK, L_AT_RIGHT_LOCK, rotorProfile } from './model'

/** Cheap geometry for the steering scene (no CSG) — built once on the main thread. */
const { PI } = Math

/** Layout (metres). */
export const LAY = {
  pump: { x: 0.42, y: 0.78, z: -0.22 },
  tank: { x: 0.42, y: 0.8, z: 0.22 },
  mu: { x: -1.45, y: 1.12, z: 0 },
  muH: 0.11,
  wheelY: 1.55,
  box: { x: -1.45, y: 0.75, z: 0 },
  dropZ: 0.45,
  dropLen: 0.2,
  upperArm: 0.18,
  upperY: AX.y + 0.16,
}

export const RAM_ROD = L_AT_LEFT_LOCK - 0.05
export const RAM_BARREL = L_AT_RIGHT_LOCK - RAM_ROD + 0.06
/** piston width and the gland's depth inside the barrel */
export const PISTON_W = 0.025
export const GLAND_IN = 0.02

/**
 * Double-acting steering cylinder from the shared parts library: barrel with welded cap and eye
 * (pin 30 mm behind the cap face, at the local origin's −X), sealed piston, rod (from the piston's
 * rod face), screwed gland at the rod end, and unit oil columns. Axis +X.
 */
function cylinderParts() {
  const R = CYL.bore / 2
  const Ro = R + 0.007
  const rodR = CYL.rod / 2
  const cap = cylinderCap({ Ro, capT: 0.015, eye: { len: 0.031, halfH: 0.016, holeR: 0.008, thick: 0.03 }, segments: 40 })
  const piston = sealedPiston({ R, width: PISTON_W, grooveD: 0.003, segments: 40 })
  return {
    barrel: merge(cylinderBarrel({ R, Ro, length: RAM_BARREL, segments: 40 }), cap.cap),
    gland: rodGland({ rodR, R, Ro, x0: RAM_BARREL - GLAND_IN, x1: RAM_BARREL, out: 0.01, segments: 40 }),
    piston: piston.piston,
    seals: merge(piston.seals, piston.wearRing),
    rod: pistonRod({ rodR, length: RAM_ROD, start: PISTON_W, eye: false, segments: 40 }).rod,
    unitOil: oilColumn(R - 0.0003, 40),
    annOil: annulusOil(rodR, R, 40),
  }
}

/** Metering unit: housing shell (cutaway-able), gerotor stator ring with rollers, rotor, spool sleeve. */
function meteringUnit() {
  const { Rp, roller: rr, width, lobes } = GEROTOR
  const R = Rp + rr + 0.012
  const housing = lathe(
    [
      [0.014, -0.05],
      [R + 0.006, -0.05],
      [R + 0.006, 0.06],
      [0.014, 0.06],
      [0.014, 0.052],
      [R, 0.052],
      [R, -0.042],
      [0.014, -0.042],
    ],
    56,
  )
  // stator ring: inner contour has a pocket for each roller
  const inner: THREE.Vector2[] = []
  for (let i = 0; i < 420; i++) {
    const a = (-2 * PI * i) / 420
    const u = new THREE.Vector2(Math.cos(a), Math.sin(a))
    let r = Rp
    for (let k = 0; k < lobes; k++) {
      const c = new THREE.Vector2(Rp * Math.cos((2 * PI * k) / lobes), Rp * Math.sin((2 * PI * k) / lobes))
      const uc = u.dot(c)
      const disc = rr * rr - (c.lengthSq() - uc * uc)
      if (disc >= 0) r = Math.max(r, uc + Math.sqrt(disc))
    }
    inner.push(u.multiplyScalar(r))
  }
  const outer: THREE.Vector2[] = []
  for (let i = 0; i < 96; i++) outer.push(new THREE.Vector2((R - 0.0005) * Math.cos((2 * PI * i) / 96), (R - 0.0005) * Math.sin((2 * PI * i) / 96)))
  const stator = extrudeTwisted(outer, [inner], width).rotateX(PI / 2)
  const rollers = merge(
    ...Array.from({ length: lobes }, (_, k) => xform(cylinder(rr - 0.0002, width - 0.001, 20), mat4.t(Rp * Math.cos((2 * PI * k) / lobes), 0, Rp * Math.sin((2 * PI * k) / lobes)))),
  )
  // rotor (in the X–Z plane, axis Y). rotorProfile is in (x, y); map y → −z so +spin about Y matches.
  const prof = rotorProfile(540).map((p) => new THREE.Vector2(p.x, p.y))
  const bore: THREE.Vector2[] = []
  for (let i = 0; i < 6 * 6; i++) {
    const a = (-2 * PI * i) / 36
    const r = i % 6 < 3 ? 0.009 : 0.0105
    bore.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  const rotor = extrudeTwisted(prof, [bore], width - 0.001).rotateX(PI / 2)
  const sleeve = tube(0.0125, 0.007, 0.07, 32).translate(0, 0.012, 0)
  return { housing, stator, rollers, rotor, sleeve }
}

export function buildSteeringParts() {
  const tyreGeo = tyre({ radius: AX.wheelR, width: AX.wheelW, rimRadius: AX.rimR, pattern: 'F2' })
  const rimGeo = rim(AX.rimR, AX.wheelW * 0.8, 0.07, 0.03)
  return {
    // axis Y → Z for wheels
    tyre: xform(tyreGeo, mat4.rx(PI / 2)),
    rim: xform(rimGeo, mat4.rx(PI / 2)),
    beam: box(0.11, 0.12, 2 * AX.kpZ - 0.06),
    kingpin: cylinder(0.04, 0.2, 32),
    stub: xform(cylinder(0.03, AX.wheelZ - AX.kpZ, 24), mat4.rx(PI / 2)),
    bar: box(1, 1, 1),
    rodBar: xform(cylinder(0.5, 1, 14), mat4.t(0, 0.5, 0)),
    ballJoint: ballJoint(0.022, 16),
    cyl: cylinderParts(),
    mu: meteringUnit(),
    column: cylinder(0.016, LAY.wheelY - LAY.mu.y - 0.06, 20),
    ...(() => {
      // steering wheel turns about Y: the library builds it about X
      const w = steeringWheel({ R: 0.2, rimR: 0.014, spokeR: 0.009, hubR: 0.035, hubL: 0.04 })
      const up = mat4.rz(PI / 2)
      return { rimRing: xform(w.rim, up), spokes: xform(w.spokes, up), hub: xform(w.hub, up) }
    })(),
    pump: merge(box(0.13, 0.11, 0.1), xform(cylinder(0.065, 0.025, 40), mat4.c(mat4.t(0.09, 0, 0), mat4.rz(PI / 2)))),
    tank: lathe(
      [
        [0, 0],
        [0.07, 0],
        [0.07, 0.18],
        [0.03, 0.2],
        [0, 0.2],
      ],
      36,
    ),
    tankOil: lathe(
      [
        [0, 0.004],
        [0.066, 0.004],
        [0.066, 0.12],
        [0, 0.12],
      ],
      36,
    ),
    box: box(0.16, 0.16, 0.14),
    valveBlock: box(0.07, 0.06, 0.1),
    sectorShaft: xform(cylinder(0.02, LAY.dropZ, 20), mat4.c(mat4.t(0, 0, LAY.dropZ / 2), mat4.rx(PI / 2))),
  }
}

export type SteeringParts = ReturnType<typeof buildSteeringParts>
let cache: SteeringParts | null = null
export const steeringParts = () => (cache ??= buildSteeringParts())
