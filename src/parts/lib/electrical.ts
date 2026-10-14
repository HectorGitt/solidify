import * as THREE from 'three'
import { box, csg, cylinder, extrude, gear, lathe, mat4, merge, ringGear, roundedRect, tube, xform } from '@/geometry'
import { mergeRaw } from '@/geometry/parts'
import { vPulley } from './engine'

/**
 * Shared parts library — electrical machines: starter motor (pinion, Bendix collar, armature,
 * commutator, brushes, field poles and coils, solenoid), lead-acid battery (case, cells, plates,
 * separators, electrolyte, posts), alternator (claw-pole rotor, stator, diodes, fan, pulley), DC
 * dynamo and spark plug.
 * Moved from the ignition scene, which now uses it, as does the whole-tractor view.
 * Each machine's local frame: axis along Z through the origin (starter pinion at z = 0, motor
 * towards −Z); battery centred on the origin.
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)
const alongX = mat4.rz(-PI / 2)

/** Starter motor with its pre-engaged solenoid. */
export function starterMotor(spec: { module: number; pinionTeeth: number }) {
  const pinion = gear({ teeth: spec.pinionTeeth, module: spec.module, width: 0.016, bore: 0.0062 })
  const collar = merge(xform(tube(0.012, 0.0062, 0.012, 24), mat4.c(mat4.t(0, 0, -0.014), alongZ)), xform(tube(0.009, 0.0062, 0.006, 24), mat4.c(mat4.t(0, 0, -0.023), alongZ)), xform(tube(0.012, 0.0062, 0.003, 24), mat4.c(mat4.t(0, 0, -0.0275), alongZ)))
  // motor (local: axis along Z through the origin)
  const yoke = xform(tube(0.041, 0.037, 0.09, 56), mat4.c(mat4.t(0, 0, -0.09), alongZ))
  const ceFrame = xform(lathe([[0.0062, 0], [0.041, 0], [0.041, 0.006], [0.03, 0.02], [0.0062, 0.02]], 48), mat4.c(mat4.t(0, 0, -0.135), mat4.rx(-PI / 2)))
  const deFrame = xform(lathe([[0.0062, 0], [0.041, 0], [0.04, 0.008], [0.022, 0.016], [0.0062, 0.016]], 48), mat4.c(mat4.t(0, 0, -0.045), alongZ))
  const shaft = xform(cylinder(0.0062, 0.19, 20), mat4.c(mat4.t(0, 0, -0.065), alongZ))
  const armature = xform(gear({ teeth: 14, module: 0.0034, width: 0.056, bore: 0.0062 }), mat4.t(0, 0, -0.088))
  const endTurns = merge(xform(tube(0.024, 0.012, 0.008, 32), mat4.c(mat4.t(0, 0, -0.056), alongZ)), xform(tube(0.024, 0.012, 0.008, 32), mat4.c(mat4.t(0, 0, -0.12), alongZ)))
  const commutator = xform(gear({ teeth: 26, module: 0.0013, width: 0.012, bore: 0.0062 }), mat4.t(0, 0, -0.13))
  const brushes = merge(xform(box(0.006, 0.01, 0.008), mat4.t(0, 0.023, -0.13)), xform(box(0.006, 0.01, 0.008), mat4.t(0, -0.023, -0.13)))
  const poles: THREE.BufferGeometry[] = []
  const fields: THREE.BufferGeometry[] = []
  const coilShape = roundedRect(0.026, 0.07, 0.006)
  const hole = new THREE.Path()
  hole.moveTo(-0.008, -0.026)
  hole.lineTo(-0.008, 0.026)
  hole.lineTo(0.008, 0.026)
  hole.lineTo(0.008, -0.026)
  hole.lineTo(-0.008, -0.026)
  coilShape.holes.push(hole)
  const coilG = extrude(coilShape, 0.006, { curveSegments: 8 })
  for (let i = 0; i < 4; i++) {
    const a = (i * PI) / 2 + PI / 4
    const m = mat4.c(mat4.rz(a), mat4.t(0, 0.0318, -0.09))
    poles.push(xform(box(0.016, 0.006, 0.05), m))
    fields.push(xform(coilG, mat4.c(mat4.rz(a), mat4.t(0, 0.0335, -0.09), mat4.rx(PI / 2))))
  }
  // solenoid on top (local, axis along Z at y = +0.068)
  const SY = 0.068
  const solBody = xform(lathe([[0.0105, 0], [0.023, 0], [0.023, 0.075], [0.0105, 0.075]], 40), mat4.c(mat4.t(0, SY, -0.125), alongZ))
  const solCoil = xform(tube(0.0205, 0.0108, 0.05, 32), mat4.c(mat4.t(0, SY, -0.09), alongZ))
  const solTerms = merge(xform(cylinder(0.0035, 0.014, 12), mat4.c(mat4.t(0.009, SY + 0.004, -0.132), alongZ)), xform(cylinder(0.0035, 0.014, 12), mat4.c(mat4.t(-0.009, SY + 0.004, -0.132), alongZ)))
  const plunger = merge(xform(cylinder(0.0098, 0.05, 24), mat4.c(mat4.t(0, 0, -0.025), alongZ)), xform(box(0.006, 0.012, 0.012), mat4.t(0, 0, 0.005)))
  const lever = merge(xform(box(0.005, 0.07, 0.006), mat4.t(0, 0, 0)), xform(cylinder(0.003, 0.012, 12), alongX))
  return { pinion, collar, yoke, ceFrame, deFrame, shaft, armature, endTurns, commutator, brushes, poles: merge(...poles), fields: merge(...fields), solBody, solCoil, solTerms, plunger, lever, SY }
}

export function battery() {
  const W = 0.24
  const H = 0.17
  const D = 0.16
  const caseG = csg(box(W, H, D), [{ op: 'sub', geometry: xform(box(W - 0.01, H, D - 0.01), mat4.t(0, 0.005, 0)) }])
  const lid = xform(box(W, 0.014, D), mat4.t(0, H / 2 + 0.007, 0))
  const cellW = (W - 0.01) / 6
  const partitions: THREE.BufferGeometry[] = []
  for (let i = 1; i < 6; i++) partitions.push(xform(box(0.003, H - 0.005, D - 0.01), mat4.t(-W / 2 + 0.005 + i * cellW, 0.0025, 0)))
  const pos: THREE.BufferGeometry[] = []
  const neg: THREE.BufferGeometry[] = []
  const sep: THREE.BufferGeometry[] = []
  const straps: THREE.BufferGeometry[] = []
  const plateH = 0.11
  const plateY = -H / 2 + 0.02 + plateH / 2
  for (let c = 0; c < 6; c++) {
    const cx = -W / 2 + 0.005 + (c + 0.5) * cellW
    const n = 9
    const pitch = (D - 0.024) / n
    for (let k = 0; k < n; k++) {
      const z = -D / 2 + 0.012 + (k + 0.5) * pitch
      const g = xform(box(cellW - 0.008, plateH, 0.0042), mat4.t(cx, plateY, z))
      ;(k % 2 ? pos : neg).push(g)
      if (k < n - 1) sep.push(xform(box(cellW - 0.006, plateH + 0.004, 0.0012), mat4.t(cx, plateY, z + pitch / 2)))
    }
    straps.push(xform(box(0.008, 0.006, D - 0.03), mat4.t(cx - 0.009, plateY + plateH / 2 + 0.003, 0)), xform(box(0.008, 0.006, D - 0.03), mat4.t(cx + 0.009, plateY + plateH / 2 + 0.003, 0)))
  }
  const electrolyte = merge(...[0, 1, 2, 3, 4, 5].map((c) => xform(box(cellW - 0.0034, 0.016, D - 0.0102), mat4.t(-W / 2 + 0.005 + (c + 0.5) * cellW, plateY + plateH / 2 + 0.006 + 0.0081, 0))))
  const caps = merge(...[0, 1, 2, 3, 4, 5].map((c) => xform(lathe([[0, 0], [0.011, 0], [0.011, 0.008], [0.008, 0.011], [0, 0.011]], 20), mat4.t(-W / 2 + 0.005 + (c + 0.5) * cellW, H / 2 + 0.014, 0.035))))
  const posPost = xform(lathe([[0, 0], [0.009, 0], [0.008, 0.022], [0, 0.022]], 24), mat4.t(-W / 2 + 0.03, H / 2 + 0.014, -0.045))
  const negPost = xform(lathe([[0, 0], [0.0078, 0], [0.007, 0.022], [0, 0.022]], 24), mat4.t(W / 2 - 0.03, H / 2 + 0.014, -0.045))
  return { case: caseG, lid, partitions: merge(...partitions), pos: merge(...pos), neg: merge(...neg), sep: merge(...sep), straps: merge(...straps), electrolyte, caps, posPost, negPost }
}

export function alternator(spec: { pulleyR: number; pulleyZ: number }) {
  const shell = (zSign: number) =>
    xform(lathe([[0.0065, 0], [0.046, 0], [0.05, 0.008], [0.05, 0.03], [0.047, 0.03], [0.047, 0.01], [0.0065, 0.006]], 56), zSign > 0 ? alongZ : mat4.rx(-PI / 2))
  const housings = merge(xform(shell(1), mat4.t(0, 0, 0.0155)), xform(shell(-1), mat4.t(0, 0, -0.0155)))
  const stator = ringGear({ teeth: 36, module: 0.0018, width: 0.026, rimOuter: 0.0455 })
  const statorWind = merge(xform(tube(0.042, 0.033, 0.006, 48), mat4.c(mat4.t(0, 0, 0.0165), alongZ)), xform(tube(0.042, 0.033, 0.006, 48), mat4.c(mat4.t(0, 0, -0.0165), alongZ)))
  // claw-pole rotor: interlocking fingers from each half (they do not touch)
  const claws: THREE.BufferGeometry[] = []
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * 2 * PI
    const front = i % 2 === 0
    claws.push(xform(box(0.011, 0.005, 0.03), mat4.c(mat4.rz(a), mat4.t(0, 0.0245, front ? 0.004 : -0.004))))
  }
  const rotorCore = merge(xform(cylinder(0.022, 0.012, 40), mat4.c(mat4.t(0, 0, 0.016), alongZ)), xform(cylinder(0.022, 0.012, 40), mat4.c(mat4.t(0, 0, -0.016), alongZ)))
  const rotorWind = xform(tube(0.02, 0.0075, 0.02, 32), alongZ)
  const shaft = xform(cylinder(0.006, 0.15, 20), mat4.c(mat4.t(0, 0, -0.03), alongZ))
  const diodes = merge(xform(tube(0.04, 0.012, 0.004, 40), mat4.c(mat4.t(0, 0, 0.05), alongZ)), ...[0, 1, 2, 3, 4, 5].map((i) => xform(cylinder(0.0035, 0.008, 12), mat4.c(mat4.rz((i * PI) / 3), mat4.t(0, 0.027, 0.056), alongZ))))
  const fan: THREE.BufferGeometry[] = [xform(tube(0.02, 0.006, 0.003, 32), mat4.c(mat4.t(0, 0, -0.05), alongZ))]
  for (let i = 0; i < 10; i++) fan.push(xform(box(0.022, 0.0025, 0.012), mat4.c(mat4.rz((i / 10) * 2 * PI), mat4.t(0.03, 0, -0.056))))
  const pulley = xform(vPulley({ r: spec.pulleyR + 0.004, bore: 0.006, land: 0.003, grooveW: 0.012, grooveDepth: 0.008, segments: 40 }), mat4.t(0, 0, spec.pulleyZ))
  return { housings, stator, statorWind, claws: merge(...claws), rotorCore, rotorWind, shaft, diodes, fan: merge(...fan), pulley }
}

/* ------------------------------ spark plug ------------------------------ */

/**
 * Spark plug. Local frame: axis +Y, y = 0 at the end of the thread (the combustion-chamber face of
 * the head), electrodes below, terminal on top. `seat` = where the insulator nose meets the shell
 * (nose length: long for a hot plug, short for a cold one); `gap` = electrode gap.
 */
export function sparkPlug(spec: { seat?: number; gap?: number } = {}) {
  const seat = spec.seat ?? 0.012
  const gap = spec.gap ?? 0.0006
  const body = lathe([[0.0058, 0], [0.007, 0], [0.007, 0.0195], [0.0062, 0.0195], [0.0062, 0.032], [0.0049, 0.032], [0.0049, seat], [0.0058, seat]], 32)
  const hex = lathe([[0.0062, 0.0195], [0.0105, 0.0195], [0.0105, 0.0295], [0.0068, 0.032], [0.0062, 0.032]], 6)
  const insulator = lathe(
    [
      [0.0011, 0.0005],
      [0.0021, 0.0005],
      [0.0047, seat],
      [0.00485, seat],
      [0.00485, 0.032],
      [0.0054, 0.033],
      [0.0054, 0.036],
      [0.0049, 0.038],
      [0.0054, 0.04],
      [0.0049, 0.042],
      [0.0054, 0.044],
      [0.0054, 0.06],
      [0.0036, 0.064],
      [0.0011, 0.064],
    ],
    32,
  )
  const tip = -0.0015
  const centre = lathe([[0, tip], [0.0011, tip], [0.0011, 0.0645], [0, 0.0645]], 16)
  const terminal = lathe([[0, 0.0645], [0.0028, 0.0645], [0.0028, 0.072], [0, 0.072]], 20)
  // side (earth) electrode: a leg down from the shell and a foot under the centre electrode
  const footTop = tip - gap
  const legH = 0.0004 - footTop
  const leg = xform(box(0.0014, legH, 0.0022), mat4.t(-0.0055, 0.0004 - legH / 2, 0))
  const foot = xform(box(0.0068, 0.0013, 0.0022), mat4.t(-0.0028, footTop - 0.00065, 0))
  return { shell: merge(body, hex), insulator, centre, terminal, ground: merge(leg, foot), sparkY: tip - gap / 2 }
}

/* ------------------------------ dynamo ------------------------------ */

/** Stack of wire turns along +Y from y = 0 (a cheap stand-in for a helix; turns drawn fewer than real). */
export function wireTurns(R: number, wire: number, length: number, n: number) {
  const t = new THREE.TorusGeometry(R, wire, 8, 28)
  t.rotateX(PI / 2)
  return mergeRaw(Array.from({ length: n }, (_, i) => t.clone().translate(0, wire + ((length - 2 * wire) * i) / Math.max(1, n - 1), 0)))
}

/**
 * DC dynamo (generator): yoke, end plates, two field poles with windings, wound armature,
 * commutator, brushes with springs and the drive pulley. Local frame: axis along Z through the
 * origin; the pulley (rim radius pulleyR + 4 mm, belt line at pulleyR) is centred at z = pulleyZ.
 */
export function dynamo(spec: { pulleyR: number; pulleyZ: number }) {
  const yoke = xform(tube(0.05, 0.045, 0.12, 56), alongZ)
  const ends = merge(xform(tube(0.05, 0.0065, 0.008, 48), mat4.c(mat4.t(0, 0, 0.064), alongZ)), xform(tube(0.05, 0.0065, 0.008, 48), mat4.c(mat4.t(0, 0, -0.064), alongZ)))
  // two field poles (neck + curved shoe) with their field windings
  const shoeShape = new THREE.Shape()
  const pa = 0.6
  shoeShape.absarc(0, 0, 0.0345, PI / 2 - pa, PI / 2 + pa, false)
  shoeShape.absarc(0, 0, 0.029, PI / 2 + pa, PI / 2 - pa, true)
  const pole = merge(extrude(shoeShape, 0.084, { curveSegments: 16 }), xform(box(0.02, 0.0106, 0.08), mat4.t(0, 0.0397, 0)))
  const poles = merge(pole, xform(pole, mat4.rz(PI)))
  const ringShape = roundedRect(0.036, 0.096, 0.006)
  const ringHole = new THREE.Path()
  ringHole.moveTo(-0.0106, -0.0412)
  ringHole.lineTo(0.0106, -0.0412)
  ringHole.lineTo(0.0106, 0.0412)
  ringHole.lineTo(-0.0106, 0.0412)
  ringShape.holes.push(ringHole)
  const ring = xform(extrude(ringShape, 0.0058, { curveSegments: 8 }), mat4.c(mat4.t(0, 0.0381, 0), mat4.rx(PI / 2)))
  const field = merge(ring, xform(ring, mat4.rz(PI)))
  const armature = gear({ teeth: 16, module: 0.003, width: 0.08, bore: 0.006 })
  const commutator = xform(gear({ teeth: 24, module: 0.0015, width: 0.016, bore: 0.006 }), mat4.t(0, 0, 0.052))
  const shaft = xform(cylinder(0.006, 0.17, 20), alongZ)
  const brushes = merge(xform(box(0.008, 0.01, 0.01), mat4.t(0.0245, 0, 0.052)), xform(box(0.008, 0.01, 0.01), mat4.t(-0.0245, 0, 0.052)))
  const springs = mergeRaw([1, -1].map((s) => xform(wireTurns(0.003, 0.0006, 0.012, 5), mat4.c(mat4.t(s * 0.0285, 0, 0.052), mat4.rz((-s * PI) / 2)))))
  const pulley = xform(vPulley({ r: spec.pulleyR + 0.004, bore: 0.006, land: 0.003, grooveW: 0.012, grooveDepth: 0.008, centred: true, segments: 48 }), mat4.t(0, 0, spec.pulleyZ))
  return { yoke, ends, poles, field, armature, commutator, shaft, brushes, springs, pulley }
}

/* ------------------------------ consolidated from other library files ------------------------------ */

/** (moved from driveline.ts) */
/** Test-rig electric drive motor on the X axis (body radius r, half length h) on a foot block, base `drop` below the axis. */
export function benchMotor(s: { r: number; halfLength: number; drop: number; foot: [number, number, number] }) {
  const { r, halfLength: h } = s
  const body = xform(
    lathe(
      [
        [0, -h],
        [r - 0.006, -h],
        [r, -h + 0.007],
        [r, h - 0.007],
        [r - 0.006, h],
        [0, h],
      ],
      48,
    ),
    mat4.rz(PI / 2),
  )
  return merge(body, xform(box(...s.foot), mat4.t(0, -s.drop + 0.04, 0)))
}
