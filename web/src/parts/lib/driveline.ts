import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, gear, lathe, mat4, merge, pipe, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { bevelGear, hexBolt, torus } from '@/geometry/parts'
import { annularSector } from './elements'
import { ringTeethFor } from './engine'
import { axial, dogRing, helical, internalSplinePlate, ringZ, shellZ, spur } from './shapes'

/**
 * Shared parts library — driveline: dry and wet clutches, synchromesh and selectors, bevel sets,
 * planetary carriers, brakes, universal and CV joints, telescopic shafts and torque-converter
 * elements.
 *
 * Unless a builder says otherwise its local frame follows shapes.ts: the shaft axis is Z and
 * gears and plates lie in the XY plane. Joint hardware (Hooke's and CV joints) runs along X.
 * All solids are closed and outward-facing.
 */

const { PI, sqrt } = Math

/* ================================ dry clutch ================================ */

export interface ClutchDiscSpec {
  /** lining outer / inner radius */
  Ro: number
  Ri: number
  /** lining and steel core thickness */
  lining?: number
  core?: number
  /** splined hub: bore, outer radius and axial extent */
  bore: number
  hubR?: number
  hubZ0: number
  hubZ1: number
}

/** total thickness of a clutch disc */
export const clutchDiscThickness = (s: { lining?: number; core?: number }) => 2 * (s.lining ?? 0.0035) + (s.core ?? 0.002)

/**
 * Dry clutch (driven) plate: splined hub, steel core and a friction lining on each face.
 * Axis Z; the flywheel-side lining face is z = 0 and the disc extends to +Z.
 */
export function clutchDisc(s: ClutchDiscSpec) {
  const lining = s.lining ?? 0.0035
  const core = s.core ?? 0.002
  const hubR = s.hubR ?? 0.05
  const T = 2 * lining + core
  const hub = ringZ(hubR, s.bore, s.hubZ0, s.hubZ1, 48)
  const coreG = ringZ(s.Ro - 0.004, hubR, lining, lining + core, 96)
  const linings = merge(ringZ(s.Ro, s.Ri, 0, lining, 96), ringZ(s.Ro, s.Ri, lining + core, T, 96))
  return { hub, core: coreG, linings }
}

/** Pressure plate: friction face at z = 0, back at z = t, optional lugs for the lever struts on the back. */
export function pressurePlate(s: { rIn: number; rOut: number; t: number; lugs?: number; lugR?: number; segments?: number }) {
  const parts = [ringZ(s.rOut, s.rIn, 0, s.t, s.segments ?? 96)]
  const n = s.lugs ?? 0
  for (let i = 0; i < n; i++) {
    const a = (2 * PI * i) / n
    parts.push(xform(box(0.02, 0.016, 0.022), mat4.c(mat4.rz(a), mat4.t(s.lugR ?? s.rOut, 0, s.t + 0.011))))
  }
  return merge(...parts)
}

/**
 * Clutch release lever drawn in its radial plane (X = radius, Z = axial), pivot at the origin.
 * rIn / rOut: radii of the inner (bearing) and outer (pressure-plate) ends; zIn / zOut their heights.
 */
export function releaseLever(s: { rIn: number; rPivot: number; rOut: number; zIn: number; zOut: number; width?: number }) {
  const sh = new THREE.Shape()
  const a = s.rIn - s.rPivot
  const b = s.rOut - s.rPivot
  sh.moveTo(a, s.zIn - 0.005)
  sh.lineTo(a + 0.006, s.zIn - 0.006)
  sh.lineTo(0, -0.008)
  sh.lineTo(b, s.zOut - 0.006)
  sh.lineTo(b + 0.004, s.zOut + 0.004)
  sh.lineTo(0, 0.008)
  sh.lineTo(a, s.zIn + 0.006)
  const g = extrude(sh, s.width ?? 0.012, { curveSegments: 4 })
  // extruded along Z in its XY plane → lay the shape's Y onto world Z (radial plane XZ)
  return xform(g, mat4.rx(PI / 2))
}

/**
 * Clutch release (thrust) bearing on its sliding carrier. Axis Z, bearing face (towards the
 * levers or diaphragm fingers) at z = 0, carrier sleeve towards +Z with the fork collar on it.
 */
export function releaseBearing(s: { rIn?: number; rOut?: number; width?: number; sleeveR?: number; sleeveIn?: number; sleeveEnd?: number } = {}) {
  const rIn = s.rIn ?? 0.034
  const rOut = s.rOut ?? 0.056
  const w = s.width ?? 0.018
  const sR = s.sleeveR ?? 0.04
  const races = ringZ(rOut, rIn, 0, w, 64)
  const sleeve = ringZ(sR, s.sleeveIn ?? 0.033, w, s.sleeveEnd ?? 0.07, 48)
  const collar = ringZ(sR + 0.01, sR, w + 0.012, w + 0.022, 48)
  return { races, carrier: merge(sleeve, collar) }
}

/** Belleville (dished) spring: inner edge raised by `rise` above the outer edge, which sits on z = z0. Axis Z. */
export function bellevilleSpring(s: { rIn: number; rOut: number; rise: number; t: number; z0?: number; segments?: number }) {
  const z0 = s.z0 ?? 0
  return axial(
    [
      [s.rIn, z0 + s.rise],
      [s.rOut, z0],
      [s.rOut, z0 + s.t],
      [s.rIn, z0 + s.rise + s.t],
    ],
    s.segments ?? 96,
  )
}

/**
 * Starter-ring flex plate (drive plate) between the crank and a torque converter: a thin disc
 * with the starter ring gear on its rim. Not a flywheel (rule 6): the converter's mass does that
 * job. Frame as `flywheel()` in engine.ts: axis Z, converter-side face at z = 0, plate towards −Z.
 */
export function flexPlate(s: { r: number; t?: number; bore?: number; ringModule?: number; ringWidth?: number }) {
  const t = s.t ?? 0.015
  const disc = ringZ(s.r, s.bore ?? 0.03, -t, 0, 96)
  const m = s.ringModule ?? 0.0029
  const teeth = ringTeethFor({ r: s.r, ringModule: m })
  const rw = s.ringWidth ?? Math.max(t, 0.012)
  const ring = xform(gear({ teeth, module: m, width: rw, bore: s.r, flankPoints: 4 }), mat4.t(0, 0, -t / 2))
  return { disc, ring, teeth }
}

/* ================================ wet clutches ================================ */

/**
 * Wet-clutch plate with teeth: `teeth: 'inner'` = splined to a hub (bore rIn, tips rIn − depth),
 * `'outer'` = lugs into a drum (body rOut, tips rOut + depth). Axis Z, centred on z = 0.
 */
export function clutchPlate(s: { rOut: number; rIn: number; t: number; n: number; depth: number; teeth: 'inner' | 'outer' }) {
  return s.teeth === 'inner' ? internalSplinePlate(s.n, s.rOut, s.rIn, s.rIn - s.depth, s.t) : dogRing(s.n, s.rOut, s.rOut + s.depth, s.rIn, s.t)
}

/**
 * Stack of plain annular plates along +Z: plate k spans z0 + k·pitch … + t. Even plates take
 * size `a`, odd plates size `b` (default `a`) — friction discs alternating with steel plates.
 * (elements.ts `plateStack` is the engagement layout of the machine-elements clutch, not geometry.)
 */
export function plateStackZ(s: { count: number; z0: number; pitch: number; t: number; a: { rOut: number; rIn: number }; b?: { rOut: number; rIn: number }; segments?: number }) {
  const A: THREE.BufferGeometry[] = []
  const B: THREE.BufferGeometry[] = []
  const b = s.b ?? s.a
  for (let k = 0; k < s.count; k++) {
    const z = s.z0 + k * s.pitch
    const d = k % 2 === 0 ? s.a : b
    ;(k % 2 === 0 ? A : B).push(ringZ(d.rOut, d.rIn, z, z + s.t, s.segments ?? 56))
  }
  return { a: merge(...A), b: B.length ? merge(...B) : null, all: merge(...A, ...B) }
}

/* ================================ synchromesh & selectors ================================ */

export interface SynchroGearSpec {
  teeth: number
  module: number
  width: number
  helixDeg: number
  hand: 1 | -1
  /** bore (also the dog ring and cone bore) */
  bore: number
  /** which face carries the dogs: +1 the +Z face, −1 the −Z face */
  side: 1 | -1
  /** dog-tooth ring: root and tip radii, axial width */
  dog: { rRoot: number; rTip: number; width: number; n?: number }
  /** synchro cone beyond the dogs (large end next to them), or null for plain dog engagement */
  cone?: { rBig: number; rSmall: number; length: number } | null
}

/** Free-running helical gear with its dog ring and synchro cone on one face. Axis Z, gear centred on z = 0. */
export function synchroGear(s: SynchroGearSpec) {
  const g = helical(s.teeth, s.module, s.width, s.helixDeg, s.hand, s.bore, 3, 3)
  const dz = s.side * (s.width / 2 + s.dog.width / 2)
  const dog = xform(dogRing(s.dog.n ?? 24, s.dog.rRoot, s.dog.rTip, s.bore, s.dog.width), mat4.t(0, 0, dz))
  let cone: THREE.BufferGeometry | null = null
  if (s.cone) {
    const c0 = s.side * (s.width / 2 + s.dog.width)
    const { rBig, rSmall, length: L } = s.cone
    cone = axial(
      s.side > 0
        ? [
            [s.bore, c0],
            [rBig, c0],
            [rSmall, c0 + L],
            [s.bore, c0 + L],
          ]
        : [
            [s.bore, c0 - L],
            [rSmall, c0 - L],
            [rBig, c0],
            [s.bore, c0],
          ],
      40,
    )
  }
  return { gear: g, dog, cone }
}

/**
 * Baulk (blocker) ring: bronze ring with an internal cone (radius coneA at −w/2, coneB at +w/2)
 * and a ring of blocking teeth. Axis Z, centred on z = 0. Defaults: the gearboxes scene.
 */
export function baulkRing(s: { rOut?: number; coneA?: number; coneB?: number; width?: number; toothRoot?: number; toothTip?: number; toothBore?: number; n?: number } = {}) {
  const rOut = s.rOut ?? 0.034
  const w = s.width ?? 0.008
  const body = axial(
    [
      [s.coneA ?? 0.0315, -w / 2],
      [rOut, -w / 2],
      [rOut, w / 2],
      [s.coneB ?? 0.0285, w / 2],
    ],
    48,
  )
  const teeth = dogRing(s.n ?? 24, s.toothRoot ?? rOut - 0.0005, s.toothTip ?? rOut + 0.0025, s.toothBore ?? rOut - 0.001, w * 0.5)
  return merge(body, teeth)
}

/**
 * Selector (shift) collar / synchro sleeve: internal splines (root rRoot, tips rTip) and a fork
 * groove between two flanges. Axis Z, centred on z = 0. Defaults: the gearboxes scene.
 */
export function shiftCollar(s: { rOut?: number; rRoot?: number; rTip?: number; width?: number; n?: number; flangeR?: number; grooveHalf?: number; flangeW?: number } = {}) {
  const rOut = s.rOut ?? 0.044
  const g = s.grooveHalf ?? 0.003
  const fw = s.flangeW ?? 0.004
  const fR = s.flangeR ?? rOut + 0.006
  const ring = internalSplinePlate(s.n ?? 24, rOut, s.rRoot ?? 0.0345, s.rTip ?? 0.0305, s.width ?? 0.014)
  const groove = merge(ringZ(fR, rOut - 0.0005, -g - fw, -g, 48), ringZ(fR, rOut - 0.0005, g, g + fw, 48))
  return merge(ring, groove)
}

/**
 * Sliding-mesh gear cluster: two spur gears at z = ∓d joined by a sleeve, with a fork groove
 * between two flanges in the middle. Axis Z.
 */
export function slidingCluster(s: { za: number; zb: number; module: number; width: number; bore: number; d: number; sleeveR?: number; flangeR?: number; grooveHalf?: number; flangeW?: number }) {
  const a = xform(spur(s.za, s.module, s.width, s.bore, 3), mat4.t(0, 0, -s.d))
  const b = xform(spur(s.zb, s.module, s.width, s.bore, 3), mat4.t(0, 0, s.d))
  const sR = s.sleeveR ?? 0.034
  const g = s.grooveHalf ?? 0.006
  const fw = s.flangeW ?? 0.005
  const fR = s.flangeR ?? 0.042
  const sleeve = ringZ(sR, s.bore, -s.d + s.width / 2, s.d - s.width / 2, 40)
  const groove = merge(ringZ(fR, sR - 0.001, -g - fw, -g, 40), ringZ(fR, sR - 0.001, g, g + fw, 40))
  return { gears: merge(a, b), sleeve: merge(sleeve, groove) }
}

const boxFromTo = (min: [number, number, number], max: [number, number, number]) => xform(box(max[0] - min[0], max[1] - min[1], max[2] - min[2]), mat4.t((min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2))

/**
 * Selector fork hanging from its rail: rail at (xRail, yRail) along Z, the fork pads drop to
 * y = dropTo above the shaft axis (gear frame: shaft on Z through the origin).
 */
export function shiftFork(s: { dropTo: number; xRail: number; yRail?: number; padHalf?: number }) {
  const yRail = s.yRail ?? 0.112
  const p = s.padHalf ?? 0.03
  return merge(
    boxFromTo([s.xRail - 0.006, s.dropTo + 0.012, -0.006], [s.xRail + 0.006, yRail, 0.006]),
    boxFromTo([Math.min(s.xRail, 0) - 0.006, s.dropTo + 0.006, -0.006], [Math.max(s.xRail, 0) + 0.006, s.dropTo + 0.018, 0.006]),
    boxFromTo([-p, s.dropTo, -0.0025], [p, s.dropTo + 0.008, 0.0025]),
  )
}

/** Solid ball of radius r (closed lathe about Y). */
function ballY(r: number, seg = 24) {
  return lathe(
    Array.from({ length: 9 }, (_, i) => {
      const a = -PI / 2 + (PI * i) / 8
      return [r * Math.cos(a), r * Math.sin(a)] as V2
    }),
    seg,
  )
}

/** Gear lever: pivot ball at the origin, stick up +Y, ball knob on top. */
export function gearLever(s: { ballR?: number; stickR?: number; length?: number; knobR?: number } = {}) {
  const L = s.length ?? 0.26
  const knobR = s.knobR ?? 0.02
  return {
    ball: ballY(s.ballR ?? 0.022),
    stick: xform(cylinder(s.stickR ?? 0.007, L, 16), mat4.t(0, L / 2, 0)),
    knob: xform(ballY(knobR, 20), mat4.t(0, L + knobR / 2, 0)),
  }
}

/* ================================ bevel sets & differential ================================ */

export interface BevelToothSpec {
  teeth: number
  module: number
  face: number
  pitchAngleDeg: number
}

/**
 * Bevel pinion (frame of `bevelGear`: axis +Z towards the apex, large end at z = 0) with an
 * optional shaft behind it (to z = −shaftLen) and a drive flange on the shaft end.
 */
export function bevelPinion(s: BevelToothSpec & { bore?: number; shaftR?: number; shaftLen?: number; flangeR?: number }) {
  const teeth = bevelGear({ teeth: s.teeth, module: s.module, faceWidth: s.face, pitchAngleDeg: s.pitchAngleDeg, bore: s.bore ?? 0 })
  if (!s.shaftLen) return { teeth, shaft: null }
  const r = s.shaftR ?? 0.022
  const parts = [xform(cylinder(r, s.shaftLen, 32), mat4.c(mat4.t(0, 0, -s.shaftLen / 2), mat4.rx(PI / 2)))]
  if (s.flangeR) {
    const f = s.flangeR
    parts.push(xform(lathe([[r, 0], [f, 0], [f, 0.012], [r + 0.008, 0.022], [r, 0.022]], 48), mat4.c(mat4.t(0, 0, -s.shaftLen), mat4.rx(-PI / 2))))
  }
  return { teeth, shaft: merge(...parts) }
}

/**
 * Crown wheel (bevelGear frame, back face at z = 0, back towards −Z) with its backing ring
 * (rOut, gear bore, depth behind the gear) and a ring of bolts at radius r, height z.
 */
export function crownWheel(s: BevelToothSpec & { bore: number; backing?: { rOut: number; depth: number }; bolts?: { n: number; r: number; z: number; phase?: number; d?: number; length?: number } }) {
  const teeth = bevelGear({ teeth: s.teeth, module: s.module, faceWidth: s.face, pitchAngleDeg: s.pitchAngleDeg, bore: s.bore })
  const ring = s.backing ? ringZ(s.backing.rOut, s.bore, -s.backing.depth, 0, 96) : null
  let bolts: THREE.BufferGeometry | null = null
  if (s.bolts) {
    const b = s.bolts
    bolts = merge(
      ...Array.from({ length: b.n }, (_, k) => {
        const a = (2 * PI * k) / b.n + (b.phase ?? 0)
        return xform(hexBolt(b.d ?? 0.01, b.length ?? 0.03), mat4.c(mat4.t(b.r * Math.cos(a), b.r * Math.sin(a), b.z), mat4.rx(-PI / 2)))
      }),
    )
  }
  return { teeth, ring, bolts }
}

/**
 * Plain differential case, axis Z: the crown-wheel flange face is z = 0 and the case runs back
 * to z = −length. Defaults: the gearboxes scene.
 */
export function diffCase(s: { bore?: number; length?: number; rEnd?: number; rBody?: number; rFlange?: number } = {}) {
  const bore = s.bore ?? 0.03
  const L = s.length ?? 0.1
  const rF = s.rFlange ?? 0.11
  return axial(
    [
      [bore, -L],
      [s.rEnd ?? 0.075, -L],
      [s.rBody ?? 0.085, -0.03],
      [rF, -0.012],
      [rF, 0],
      [bore, 0],
    ],
    48,
  )
}

/**
 * Cup-shaped axle centre housing round the crown wheel, open at z = z0, end wall at z1 with a
 * half-shaft bore. Axis Z (scenes turn it onto the axle). Defaults: the gearboxes scene.
 */
export function crownHousing(s: { rIn?: number; rOut?: number; z0?: number; z1?: number; bore?: number; wall?: number } = {}) {
  const rIn = s.rIn ?? 0.165
  const rOut = s.rOut ?? 0.177
  const z0 = s.z0 ?? -0.17
  const z1 = s.z1 ?? 0.08
  const bore = s.bore ?? 0.04
  const w = s.wall ?? 0.01
  return axial(
    [
      [rIn, z0],
      [rOut, z0],
      [rOut, z1],
      [bore, z1],
      [bore, z1 - w],
      [rIn, z1 - w],
    ],
    72,
  )
}

/**
 * Placing a straight bevel gear (from `bevelGear()`: axis local +Z, large end at z = 0, apex on
 * +Z) so that its pitch-cone apex sits on a common apex and its teeth interlock with a mate.
 * `axis` points from the gear TOWARDS the apex; angles are measured about it, so a meshing pair
 * obeys ω_b = −(z_a/z_b)·ω_a — the same relation as `gearMesh` in the DriveGraph.
 * `contactDir`: direction (perpendicular to the axis) from the gear axis to the mesh point;
 * `toothAtContact`: a tooth (true) or a tooth space (false) sits on the contact line.
 */
export interface BevelPlacement {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  /** static phase about local Z so that teeth interlock at θ = 0 */
  phase: number
}

export function placeBevelGear(apex: THREE.Vector3, axis: THREE.Vector3, pitchR: number, pitchAngle: number, contactDir: THREE.Vector3, teeth: number, toothAtContact: boolean): BevelPlacement {
  const a = axis.clone().normalize()
  const position = apex.clone().addScaledVector(a, -pitchR / Math.tan(pitchAngle))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a)
  const local = contactDir.clone().applyQuaternion(quaternion.clone().invert())
  const beta = Math.atan2(local.y, local.x)
  return { position, quaternion, phase: beta + (toothAtContact ? 0 : PI / teeth) }
}

/* ================================ planetary sets ================================ */

/**
 * Planet-carrier plate: an n-lobed spider (hub radius rHub, lobes out to rLobe) with an optional
 * bore. Axis Z, centred on z = 0. Lobes on the +X axis and every 2π/n.
 */
export function spiderPlate(s: { n: number; rHub: number; rLobe: number; t: number; bore?: number }) {
  const pts: THREE.Vector2[] = []
  const N = 160
  for (let i = 0; i < N; i++) {
    const a = (2 * PI * i) / N
    const f = Math.pow((1 + Math.cos(s.n * a)) / 2, 3)
    const r = s.rHub + (s.rLobe - s.rHub) * f
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  const holes: THREE.Vector2[][] = []
  if (s.bore && s.bore > 0) {
    const h: THREE.Vector2[] = []
    for (let i = 0; i < 40; i++) {
      const a = (-2 * PI * i) / 40
      h.push(new THREE.Vector2(s.bore * Math.cos(a), s.bore * Math.sin(a)))
    }
    holes.push(h)
  }
  return extrudeTwisted(pts, holes, s.t)
}

/**
 * Planet carrier: two spider plates at z = ±plateZ (the +Z one bored for the sun shaft) joined by
 * n planet pins on the pin circle rc. Lobes reach rc + lobeClear. Axis Z.
 */
export function planetCarrier(s: { n: number; rc: number; pinR: number; plateT: number; plateZ: number; rHub: number; lobeClear: number; frontBore: number }) {
  const lobe = { n: s.n, rHub: s.rHub, rLobe: s.rc + s.lobeClear, t: s.plateT }
  const plates = merge(xform(spiderPlate({ ...lobe, bore: s.frontBore }), mat4.t(0, 0, s.plateZ)), xform(spiderPlate(lobe), mat4.t(0, 0, -s.plateZ)))
  const pinLen = 2 * (s.plateZ - s.plateT / 2)
  const pins = merge(
    ...Array.from({ length: s.n }, (_, i) => {
      const a = (2 * PI * i) / s.n
      return xform(cylinder(s.pinR, pinLen, 20), mat4.c(mat4.t(s.rc * Math.cos(a), s.rc * Math.sin(a), 0), mat4.rx(PI / 2)))
    }),
  )
  return { plates, pins }
}

/* ================================ brakes ================================ */

/**
 * Brake disc (annulus with bore `bore`) of thickness t centred on z, with an optional friction
 * lining (outer radius rOut − inset, inner rIn, thickness t) bonded on each face. Axis Z.
 */
export function brakeDisc(s: { rOut: number; bore: number; t: number; z?: number; lining?: { rIn: number; t: number; inset?: number }; segments?: number }) {
  const z = s.z ?? 0
  const seg = s.segments ?? 64
  const disc = ringZ(s.rOut, s.bore, z - s.t / 2, z + s.t / 2, seg)
  let lining: THREE.BufferGeometry | null = null
  if (s.lining) {
    const ro = s.rOut - (s.lining.inset ?? 0.003)
    const { rIn, t } = s.lining
    lining = merge(ringZ(ro, rIn, z - s.t / 2 - t, z - s.t / 2, seg), ringZ(ro, rIn, z + s.t / 2, z + s.t / 2 + t, seg))
  }
  return { disc, lining }
}

/**
 * Band brake (stationary) round a drum of radius r: the band (clearance gap, thickness t) and
 * its anchor lug on +Y (w × h, centred `at` beyond the drum). Axis Z, centred on z = 0.
 */
export function bandBrake(s: { r: number; width: number; gap?: number; t?: number; lug?: { w: number; h: number; at: number } }) {
  const gap = s.gap ?? 0.002
  const t = s.t ?? 0.004
  const lug = s.lug ?? { w: 0.03, h: 0.03, at: 0.018 }
  const b = ringZ(s.r + gap + t, s.r + gap, -s.width / 2, s.width / 2, 72)
  return merge(b, xform(box(lug.w, lug.h, s.width), mat4.t(0, s.r + lug.at, 0)))
}

/**
 * Internal expanding brake shoe spanning a0…a1 (rad) in the brake frame (axis Z, drum centre at
 * the origin): web, table and bonded lining inside a drum of radius rDrum. The result is shifted
 * so that its anchor `pivot` is the origin (it swings by rotation.z about the pin).
 * Sectors from elements.ts `annularSector`.
 */
export function brakeShoe(s: { a0: number; a1: number; pivot: { x: number; y: number }; rDrum?: number; width?: number }) {
  const rD = s.rDrum ?? 0.15
  const w = s.width ?? 0.04
  const d6 = (6 * PI) / 180
  const web = annularSector(rD - 0.038, rD - 0.012, s.a0, s.a1, 0.008, 28)
  const table = annularSector(rD - 0.012, rD - 0.008, s.a0, s.a1, w, 28)
  const lining = annularSector(rD - 0.008, rD - 0.0035, s.a0 + d6, s.a1 - d6, w - 0.004, 28)
  const t = mat4.t(-s.pivot.x, -s.pivot.y, 0)
  return { metal: xform(merge(web, table), t), lining: xform(lining, t) }
}

/**
 * Brake drum for internal shoes, open towards −Z (rim at zOpen): friction bore rDrum, wall
 * thickness, back plate at zBack with the hub bore and wheel studs. Axis Z. Defaults: the brakes
 * scene. (elements.ts `brakeDrum` is the symmetric web drum of the machine-elements scenes.)
 */
export function shoeBrakeDrum(s: { rDrum?: number; wall?: number; zOpen?: number; zBack?: number; bore?: number; studs?: number } = {}) {
  const r = s.rDrum ?? 0.15
  const w = s.wall ?? 0.012
  const zo = s.zOpen ?? -0.035
  const zb = s.zBack ?? 0.03
  const bore = s.bore ?? 0.035
  const drum = shellZ(
    [
      [bore, zb],
      [r, zb],
      [r, zo],
      [r + w, zo],
      [r + w, zb + 0.012],
      [bore, zb + 0.012],
    ],
    72,
  )
  const n = s.studs ?? 6
  const studs = merge(...Array.from({ length: n }, (_, k) => xform(cylinder(0.006, 0.03, 10), mat4.c(mat4.rz((2 * PI * k) / n), mat4.t(0.07, 0, zb + 0.025), mat4.rx(PI / 2)))))
  return merge(drum, studs)
}

/* ================================ universal (Hooke's) joints ================================ */

/**
 * Hooke's (cardan) joint proportions: a medium tractor PTO driveline joint (cross 94 mm over the
 * cups, 17 mm trunnions) — typical values.
 *
 * Local frame of a yoke: joint centre at the origin, shaft along −X, pin (trunnion) axis along Y.
 * The cross has its arms along ±Y and ±Z.
 */
export const UJ = {
  trunnionR: 0.0085,
  centreHalf: 0.016,
  trunnionEnd: 0.0435,
  cupInnerR: 0.0125,
  cupOuterR: 0.0155,
  cupOpen: 0.026,
  cupBottom: 0.0445,
  cupEnd: 0.047,
  needleR: 0.0019,
  needles: 16,
  earIn: 0.03,
  earOut: 0.044,
  earR: 0.023,
  earLen: 0.062,
  bridge: 0.078,
  hubEnd: 0.108,
  hubR: 0.025,
  shaftR: 0.0175,
}
export type UJSpec = typeof UJ

/** Yoke: two ears with cup bores, a bridge and a hub (shaft along −X, pin along Y). */
export function ujYoke(J: UJSpec = UJ) {
  const s = new THREE.Shape()
  s.moveTo(-J.earLen, -J.earR)
  s.absarc(0, 0, J.earR, -PI / 2, PI / 2, false)
  s.lineTo(-J.earLen, J.earR)
  const hole = new THREE.Path()
  hole.absarc(0, 0, J.cupOuterR, 0, 2 * PI, true)
  s.holes.push(hole)
  const t = J.earOut - J.earIn
  // extruded in XY along Z → rotate so the plate lies in XZ, thickness along Y
  const ear = xform(extrude(s, t, { curveSegments: 32 }), mat4.rx(-PI / 2))
  const earTop = xform(ear, mat4.t(0, (J.earIn + J.earOut) / 2, 0))
  const earBot = xform(ear, mat4.t(0, -(J.earIn + J.earOut) / 2, 0))
  const bridgeW = J.bridge - J.earLen
  const bridge = xform(box(bridgeW, 2 * J.earOut, 2 * J.earR), mat4.t(-(J.earLen + J.bridge) / 2, 0, 0))
  const hubLen = J.hubEnd - J.bridge
  const hub = xform(cylinder(J.hubR, hubLen, 40), mat4.c(mat4.t(-(J.bridge + J.hubEnd) / 2, 0, 0), mat4.rz(PI / 2)))
  return merge(earTop, earBot, bridge, hub)
}

/** Cross (spider): centre block and four trunnions — arms along ±Y and ±Z. */
export function ujCross(J: UJSpec = UJ) {
  const c = J.centreHalf
  const centre = box(2 * c, 2 * c, 2 * c)
  const len = J.trunnionEnd - c
  const arm = cylinder(J.trunnionR, len, 28)
  const mid = c + len / 2
  const arms = [
    xform(arm, mat4.t(0, mid, 0)),
    xform(arm, mat4.t(0, -mid, 0)),
    xform(arm, mat4.c(mat4.rx(PI / 2), mat4.t(0, mid, 0))),
    xform(arm, mat4.c(mat4.rx(-PI / 2), mat4.t(0, mid, 0))),
  ]
  return merge(centre, ...arms)
}

/** Unit transforms that carry a +Y-pointing part to each of the four trunnion directions. */
const ARM_DIRS = [mat4.rx(0), mat4.rx(PI), mat4.rx(PI / 2), mat4.rx(-PI / 2)]

/** Four closed-end needle-bearing cups (with circlips), one on each trunnion. */
export function ujCups(J: UJSpec = UJ) {
  const cup = lathe(
    [
      [J.cupInnerR, J.cupOpen],
      [J.cupOuterR, J.cupOpen],
      [J.cupOuterR, J.cupEnd],
      [0, J.cupEnd],
      [0, J.cupBottom],
      [J.cupInnerR, J.cupBottom],
    ],
    40,
  )
  const clip = xform(torus(J.cupOuterR - 0.0012, 0.0011, 8, 32), mat4.c(mat4.t(0, J.earOut + 0.0014, 0), mat4.rx(PI / 2)))
  return merge(...ARM_DIRS.flatMap((m) => [xform(cup, m), xform(clip, m)]))
}

/** Needle rollers between trunnion and cup, on all four arms. */
export function ujNeedles(J: UJSpec = UJ) {
  const len = J.cupBottom - J.cupOpen - 0.004
  const n = cylinder(J.needleR, len, 8)
  const rc = J.trunnionR + J.needleR
  const ring: THREE.BufferGeometry[] = []
  for (let i = 0; i < J.needles; i++) {
    const a = (i / J.needles) * 2 * PI
    ring.push(xform(n, mat4.t(rc * Math.cos(a), J.cupOpen + 0.002 + len / 2, rc * Math.sin(a))))
  }
  const one = merge(...ring)
  return merge(...ARM_DIRS.map((m) => xform(one, m)))
}

/** Lip seals at the open end of each cup. */
export function ujSeals(J: UJSpec = UJ) {
  const seal = xform(tube(J.cupInnerR + 0.0005, J.trunnionR + 0.0002, 0.003, 32), mat4.t(0, J.cupOpen - 0.0016, 0))
  return merge(...ARM_DIRS.map((m) => xform(seal, m)))
}

export { pillowBlockX } from './elements'

/**
 * Lemon-profile telescopic PTO-shaft tube along +X from x = 0 to 1 (scale.x sets its length):
 * cross-section half widths a (along Z) and b (along Y), wall thickness `wall`.
 */
export function lemonTube(a: number, b: number, wall: number) {
  const pts = (A: number, B: number) =>
    Array.from({ length: 40 }, (_, i) => {
      const t = (i / 40) * PI * 2
      const c = Math.cos(t)
      return new THREE.Vector2(A * Math.sign(c) * Math.abs(c) ** 0.8, B * Math.sin(t))
    })
  const s = new THREE.Shape(pts(a, b))
  s.holes.push(new THREE.Path(pts(a - wall, b - wall).reverse()))
  return xform(extrude(s, 1), mat4.ry(PI / 2))
}

/**
 * Test-rig inertia (load) wheel on the X axis, centred on x = 0: rim radius r, rim corners
 * chamfered in to rimIn, half width h, on a bore. Not an engine flywheel (no ring gear).
 */
export function inertiaWheel(s: { r: number; rimIn: number; halfWidth: number; bore: number; chamfer?: number }) {
  const c = s.chamfer ?? 0.008
  const h = s.halfWidth
  return xform(
    lathe(
      [
        [s.bore, -h],
        [s.rimIn, -h],
        [s.r, -h + c],
        [s.r, h - c],
        [s.rimIn, h],
        [s.bore, h],
      ],
      64,
    ),
    mat4.rz(PI / 2),
  )
}

export { benchMotor } from './electrical'

/* ================================ constant-velocity joints ================================ */

/** CV-joint proportions (m): typical small-tractor / 4WD front-hub sizes. */
export const CV_JOINT = {
  rz: { Rb: 0.03, ballR: 0.0095, innerR: 0.0262, cageIn: 0.0267, cageOut: 0.0338, cupIn: 0.0345, cupOut: 0.048 },
  weiss: { Rb: 0.03, ballR: 0.009, centreR: 0.0115, prongR: 0.042, prongIn: 0.0235, prongHalf: 0.016 },
  tracta: { R: 0.026 },
  tri: { legR: 0.025, rollerR: 0.0105, potOut: 0.05 },
}
export type CVJointSpec = typeof CV_JOINT

/*
 * CV-joint solids. Lathe solids are built along +Y and turned onto +X (the shaft axis). Every
 * joint is drawn with its input member on the −X side and the joint centre at the origin.
 */
const AXIS_X = mat4.rz(-PI / 2)
const alongX = (profile: V2[], seg = 64) => xform(lathe(profile, seg), AXIS_X)

/** Points on a sphere-of-radius-R arc in the (r, y) half-plane from y0 to y1. */
function arc(R: number, y0: number, y1: number, n = 16): V2[] {
  const pts: V2[] = []
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n
    pts.push([sqrt(Math.max(0, R * R - y * y)), y])
  }
  return pts
}

/** Solid sphere (closed lathe about Y), centred on the origin — joint balls. */
export function ball(r: number, seg = 24) {
  const pts: V2[] = []
  for (let i = 0; i <= 12; i++) {
    const a = -PI / 2 + (PI * i) / 12
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return lathe(pts, seg)
}

/** Ball-track groove: a solid tube along a circular arc of radius R in the meridian plane at angle ψ. */
function grooveArc(R: number, tubeR: number, psi: number, halfSpan: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 24; i++) {
    const t = -halfSpan + (2 * halfSpan * i) / 24
    pts.push(new THREE.Vector3(R * Math.sin(t), R * Math.cos(t) * Math.cos(psi), R * Math.cos(t) * Math.sin(psi)))
  }
  return pipe(new THREE.CatmullRomCurve3(pts), tubeR, 0, 32, 16)
}

/** Rzeppa (Birfield) outer race / bell with six ball grooves; shaft towards −X. */
export function rzeppaCup(cv: CVJointSpec = CV_JOINT) {
  const { Rb, cupIn, cupOut } = cv.rz
  const rimY = 0.016
  const prof: V2[] = [
    [0, -0.12],
    [0.017, -0.12],
    [0.017, -0.052],
    [cupOut, -0.046],
    [cupOut, rimY - 0.003],
    [cupOut - 0.004, rimY],
    ...arc(cupIn, rimY, -cupIn, 24).slice(0, -1),
    [0, -cupIn],
  ]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, cv.rz.ballR + 0.0004, (k * PI) / 3, 0.75) })
  return csg(body, ops)
}

/** Rzeppa inner race on its shaft (towards +X) with six ball grooves. */
export function rzeppaInner(cv: CVJointSpec = CV_JOINT) {
  const { Rb, innerR } = cv.rz
  const h = 0.0135
  const prof: V2[] = [[0, -h], ...arc(innerR, -h, h, 16), [0.012, h], [0.012, 0.13], [0, 0.13]]
  const body = alongX(prof, 64)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, cv.rz.ballR + 0.0004, (k * PI) / 3, 0.6) })
  return csg(body, ops)
}

/** Rzeppa ball cage with six windows. */
export function rzeppaCage(cv: CVJointSpec = CV_JOINT) {
  const { cageIn, cageOut, Rb, ballR } = cv.rz
  const h = 0.0135
  const prof: V2[] = [...arc(cageOut, -h, h, 12), ...arc(cageIn, h, -h, 12)]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) {
    const psi = (k * PI) / 3
    ops.push({ op: 'sub', geometry: xform(box(2 * ballR + 0.001, 0.03, 2 * ballR + 0.006), mat4.c(mat4.rx(psi), mat4.t(0, Rb, 0))) })
  }
  return csg(body, ops)
}

/** Weiss (Bendix) yoke: two grooved prongs on a hub (towards −X). */
export function weissYoke(cv: CVJointSpec = CV_JOINT) {
  const { Rb, ballR, prongR, prongIn, prongHalf } = cv.weiss
  const shell = alongX([...arc(prongR, -0.03, 0.013, 16), ...arc(prongIn, 0.013, -0.03, 10)], 64)
  const ops: CsgOp[] = [{ op: 'and', geometry: box(0.2, 0.2, 2 * prongHalf) }]
  for (let k = 0; k < 4; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, ballR + 0.0004, PI / 4 + (k * PI) / 2, 0.8) })
  const prongs = csg(shell, ops)
  const hub = alongX([[0, -0.11], [0.016, -0.11], [0.016, -0.045], [prongR, -0.042], [prongR, -0.029], [0, -0.029]], 64)
  return merge(prongs, hub)
}

/** Tracta spigot half (tongue) with its trunnions. */
export function tractaSpigot(cv: CVJointSpec = CV_JOINT) {
  const R = cv.tracta.R
  const half = alongX([[0, -R], ...arc(R, -R, -0.002, 16).slice(1), [0, -0.002]], 48)
  const tongue = xform(box(0.018, 0.04, 0.0075), mat4.t(0.005, 0, 0))
  const trunnions = merge(...[1, -1].map((s) => xform(cylinder(0.0085, 0.014, 24), mat4.t(0, s * (R + 0.002), 0))))
  return { body: csg(half, [{ op: 'add', geometry: tongue }]), trunnions }
}

/** Tracta slotted half with its trunnions. */
export function tractaSlotted(cv: CVJointSpec = CV_JOINT) {
  const R = cv.tracta.R
  const half = alongX([[0, 0.002], ...arc(R, 0.002, R, 16).slice(0, -1), [0, R]], 48)
  const slot = box(0.04, 0.044, 0.0085)
  const trunnions = merge(...[1, -1].map((s) => xform(cylinder(0.0085, 0.014, 24), mat4.t(0, s * (R + 0.002), 0))))
  return { body: csg(half, [{ op: 'sub', geometry: slot }]), trunnions }
}

/** Tripode pot (housing) with three roller bores; shaft towards −X. */
export function tripodePot(cv: CVJointSpec = CV_JOINT) {
  const { legR, rollerR, potOut } = cv.tri
  const prof: V2[] = [
    [0, -0.12],
    [0.018, -0.12],
    [0.018, -0.056],
    [potOut, -0.05],
    [potOut, 0.04],
    [0.019, 0.04],
    [0.019, -0.03],
    [0, -0.03],
  ]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 3; k++) {
    const a = (2 * PI * k) / 3
    ops.push({ op: 'sub', geometry: xform(cylinder(rollerR + 0.0006, 0.08, 32), mat4.c(mat4.rx(a), mat4.t(0.006, legR, 0), AXIS_X)) })
  }
  return csg(body, ops)
}

/** Tripode spider: hub, three legs and the shaft (towards +X). */
export function tripodeSpider(cv: CVJointSpec = CV_JOINT) {
  const { legR } = cv.tri
  const hub = alongX([[0.0, -0.011], [0.014, -0.011], [0.014, 0.011], [0.0, 0.011]], 40)
  const legs = [0, 1, 2].map((k) => xform(cylinder(0.0056, legR + 0.004, 20), mat4.c(mat4.rx((2 * PI * k) / 3), mat4.t(0, (legR + 0.004) / 2, 0))))
  const shaft = alongX([[0, 0.011], [0.0115, 0.011], [0.0115, 0.14], [0, 0.14]], 32)
  return merge(hub, ...legs, shaft)
}

/** Tripode roller (spherical outside), axis Y. */
export function tripodeRoller(cv: CVJointSpec = CV_JOINT) {
  const r = cv.tri.rollerR
  const h = 0.0062
  return lathe([[0.0062, -h], ...arc(r, -h, h, 10), [0.0062, h]], 32)
}

/* ================================ torque converter ================================ */

/** Torus section of a converter: core-circle centre at radius RC; point at section radius R, angle θ (θ = 0 outer, +π/2 rear). */
export const torusPoint = (RC: number, R: number, th: number): V2 => [RC + R * Math.cos(th), R * Math.sin(th)]

/** Converter shell / core band: section radii R0…R1 for θ from t0 to t1, revolved about Z. */
export function torusBand(RC: number, R0: number, R1: number, t0: number, t1: number, n = 24) {
  const pts: V2[] = []
  for (let i = 0; i <= n; i++) pts.push(torusPoint(RC, R1, t0 + ((t1 - t0) * i) / n))
  for (let i = n; i >= 0; i--) pts.push(torusPoint(RC, R0, t0 + ((t1 - t0) * i) / n))
  return shellZ(pts, 96)
}

/** Flat converter blades in the meridional plane between section radii B and A, θ t0…t1, thickness `thick`; `count` copies round Z. */
export function torusBlades(s: { RC: number; A: number; B: number; count: number; t0: number; t1: number; thick: number; phase?: number }) {
  const outline: THREE.Vector2[] = []
  const n = 14
  for (let i = 0; i <= n; i++) {
    const [r, z] = torusPoint(s.RC, s.A - 0.0005, s.t0 + ((s.t1 - s.t0) * i) / n)
    outline.push(new THREE.Vector2(r, z))
  }
  for (let i = n; i >= 0; i--) {
    const [r, z] = torusPoint(s.RC, s.B + 0.0005, s.t0 + ((s.t1 - s.t0) * i) / n)
    outline.push(new THREE.Vector2(r, z))
  }
  const plate = extrudeTwisted(outline, [], s.thick)
  const parts: THREE.BufferGeometry[] = []
  for (let k = 0; k < s.count; k++) {
    const a = (s.phase ?? 0) + (2 * PI * k) / s.count
    const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    const ax = new THREE.Vector3(0, 0, 1)
    const tang = new THREE.Vector3(Math.sin(a), -Math.cos(a), 0)
    parts.push(xform(plate, new THREE.Matrix4().makeBasis(radial, ax, tang)))
  }
  return merge(...parts)
}

/**
 * Converter stator: hub (bore on the one-way clutch) plus blades inclined to the axis (they turn
 * the returning oil to the impeller's direction). Axis Z, centred on z = 0.
 */
export function statorWheel(s: { r0: number; r1: number; half: number; bore: number; blades: number; thick?: number; incline?: number }) {
  const hub = ringZ(s.r0, s.bore, -s.half - 0.004, s.half + 0.004, 64)
  const sh = new THREE.Shape()
  const h = s.half
  sh.moveTo(s.r0 - 0.002, -h)
  sh.lineTo(s.r1, -h * 0.8)
  sh.lineTo(s.r1, h * 0.8)
  sh.lineTo(s.r0 - 0.002, h)
  sh.closePath()
  const plate = extrudeTwisted(sh.getPoints(), [], s.thick ?? 0.0035)
  const parts: THREE.BufferGeometry[] = [hub]
  const inc = s.incline ?? 0.7
  for (let k = 0; k < s.blades; k++) {
    const a = (2 * PI * k) / s.blades
    const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
    const tang = new THREE.Vector3(-Math.sin(a), Math.cos(a), 0)
    const ax = new THREE.Vector3(0, 0, 1).multiplyScalar(Math.cos(inc)).addScaledVector(tang, Math.sin(inc))
    const nrm = radial.clone().cross(ax)
    parts.push(xform(plate, new THREE.Matrix4().makeBasis(radial, ax, nrm)))
  }
  return merge(...parts)
}
