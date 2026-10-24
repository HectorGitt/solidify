import * as THREE from 'three'
import { mat4, merge, pipe, xform } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'
import { ringZ } from '@/parts/lib/shapes'
import { axialPistonUnit } from '@/parts/lib/hydraulics'
import { roundedPath } from '@/parts/lib/construct'
import { DIM, UNIT } from './model'

/** Cheap (no CSG) geometry, built once on the main thread. Unit-local frames: axis along Z. */
const { PI } = Math






export { roundedPath }

const X = DIM.unitX
const v = (x: number, z: number) => new THREE.Vector3(x, 0, z)

/** Oil paths, pump → motor. A: pump outer kidney (x<0 side) → motor outer kidney. B: inner pair. */
export const PIPES = {
  A: roundedPath([v(-X - DIM.portX, DIM.bossZ), v(-X - DIM.portX, DIM.outerZ), v(X + DIM.portX, DIM.outerZ), v(X + DIM.portX, DIM.bossZ)], 0.03),
  B: roundedPath([v(-X + DIM.portX, DIM.bossZ), v(-X + DIM.portX, DIM.innerZ), v(X - DIM.portX, DIM.innerZ), v(X - DIM.portX, DIM.bossZ)], 0.025),
}

/** Full particle path: kidney → port → pipe → port → kidney. */
export function flowPath(which: 'A' | 'B', reverse: boolean) {
  const xp = which === 'A' ? -X - DIM.portX : -X + DIM.portX
  const xm = which === 'A' ? X + DIM.portX : X - DIM.portX
  const zk = DIM.valveZ0 + 0.004
  const zr = which === 'A' ? DIM.outerZ : DIM.innerZ
  const pts = [v(xp, zk), v(xp, zr), v(xm, zr), v(xm, zk)]
  if (reverse) pts.reverse()
  return roundedPath(pts, 0.025)
}

export function buildHydroGeometry() {
  // the pump and motor are the library's axial-piston unit at this scene's size
  const u = axialPistonUnit({ ...DIM, pistons: UNIT.pistons, bore: UNIT.bore, pitchR: UNIT.pitchR })
  const shaft = merge(u.shaft(0.16), ringZ(0.04, DIM.shaftR, 0.15, 0.162, 40))
  const motorShaft = u.shaft(DIM.wheelZ + 0.02)
  const pipeWall = { A: pipe(PIPES.A, DIM.pipeR, DIM.pipeIn, 64, 16), B: pipe(PIPES.B, DIM.pipeR, DIM.pipeIn, 64, 16) }
  const pipeOil = { A: pipe(PIPES.A, DIM.pipeIn - 0.0003, 0, 64, 12), B: pipe(PIPES.B, DIM.pipeIn - 0.0003, 0, 64, 12) }
  const wheel = merge(xform(tyre({ radius: DIM.wheelR, width: 0.06, rimRadius: 0.07, lugs: 12, lugHeight: 0.012 }), mat4.rx(PI / 2)))
  const wheelRim = xform(rim(0.07, 0.05, 0.03, 0.01), mat4.rx(PI / 2))
  const base = merge(...[-X, X].map((x) => xform(new THREE.BoxGeometry(0.2, 0.02, 0.16), mat4.t(x, -DIM.housingR - 0.01, 0.02))))
  const { block, valvePlate, kidneyOil, cover, portOil, housing, swash, lever, piston, slipper, column } = u
  return { block, valvePlate, kidneyOil, cover, portOil, housing, swash, lever, shaft, motorShaft, piston, slipper, column, pipeWall, pipeOil, wheel, wheelRim, base: merge(base) }
}

let cache: ReturnType<typeof buildHydroGeometry> | null = null
export const hydroGeometry = () => (cache ??= buildHydroGeometry())
