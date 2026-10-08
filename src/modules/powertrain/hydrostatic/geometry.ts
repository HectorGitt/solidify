import * as THREE from 'three'
import { cylinder, extrudeTwisted, lathe, mat4, merge, pipe, xform } from '@/geometry'
import { rim, tyre } from '@/geometry/parts'
import { axial, ringZ, shaftZ } from '../common/geo'
import { DIM, UNIT } from './model'

/** Cheap (no CSG) geometry, built once on the main thread. Unit-local frames: axis along Z. */
const { PI } = Math

function circle(r: number, n = 48, cx = 0, cy = 0) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < n; i++) pts.push(new THREE.Vector2(cx + r * Math.cos((2 * PI * i) / n), cy + r * Math.sin((2 * PI * i) / n)))
  return pts
}

/** Kidney (annular sector) centred on angle c, half-width h, radii r0…r1. */
function kidney(c: number, h: number, r0: number, r1: number, n = 16) {
  const pts: THREE.Vector2[] = []
  for (let i = 0; i <= n; i++) {
    const a = c - h + (2 * h * i) / n
    pts.push(new THREE.Vector2(r1 * Math.cos(a), r1 * Math.sin(a)))
  }
  for (let i = n; i >= 0; i--) {
    const a = c - h + (2 * h * i) / n
    pts.push(new THREE.Vector2(r0 * Math.cos(a), r0 * Math.sin(a)))
  }
  return pts
}

const slab = (outline: THREE.Vector2[], holes: THREE.Vector2[][], z0: number, z1: number) => xform(extrudeTwisted(outline, holes, z1 - z0), mat4.t(0, 0, (z0 + z1) / 2))

/** Rounded polyline through corner points (quadratic fillets of radius r). */
export function roundedPath(points: THREE.Vector3[], r: number) {
  const path = new THREE.CurvePath<THREE.Vector3>()
  let prev = points[0].clone()
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1]
    const b = points[i]
    const c = points[i + 1]
    const d1 = b.clone().sub(a).normalize()
    const d2 = c.clone().sub(b).normalize()
    const p1 = b.clone().addScaledVector(d1, -r)
    const p2 = b.clone().addScaledVector(d2, r)
    path.add(new THREE.LineCurve3(prev, p1))
    path.add(new THREE.QuadraticBezierCurve3(p1, b.clone(), p2))
    prev = p2
  }
  path.add(new THREE.LineCurve3(prev, points[points.length - 1].clone()))
  return path
}

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
  const R = UNIT.pitchR
  const bores = Array.from({ length: UNIT.pistons }, (_, i) => circle(UNIT.bore / 2 + 0.0004, 20, R * Math.cos((2 * PI * i) / UNIT.pistons), R * Math.sin((2 * PI * i) / UNIT.pistons)))
  const block = slab(circle(DIM.blockR, 64), [...bores, circle(DIM.shaftR + 0.0005, 24)], DIM.blockZ0, DIM.blockZ1)
  const k0 = kidney(0, 1.25, R - 0.0075, R + 0.0075)
  const k1 = kidney(PI, 1.25, R - 0.0075, R + 0.0075)
  const valvePlate = slab(circle(DIM.blockR + 0.004, 64), [k0, k1, circle(DIM.shaftR + 0.001, 24)], DIM.valveZ0, DIM.blockZ0)
  const kidneyOil = { pos: slab(k0, [], DIM.valveZ0 + 0.0003, DIM.blockZ0 - 0.0003), neg: slab(k1, [], DIM.valveZ0 + 0.0003, DIM.blockZ0 - 0.0003) }
  const portHole = (s: number) => circle(0.009, 20, s * DIM.portX, 0)
  const cover = merge(
    slab(circle(DIM.housingR, 64), [portHole(1), portHole(-1)], DIM.coverZ0, DIM.valveZ0),
    ...[1, -1].map((s) => xform(ringZ(0.017, 0.009, DIM.bossZ, DIM.coverZ0, 24), mat4.t(s * DIM.portX, 0, 0))),
  )
  const portOil = {
    pos: xform(shaftZ(0.0087, DIM.bossZ + 0.0003, DIM.valveZ0 - 0.0003, 16), mat4.t(DIM.portX, 0, 0)),
    neg: xform(shaftZ(0.0087, DIM.bossZ + 0.0003, DIM.valveZ0 - 0.0003, 16), mat4.t(-DIM.portX, 0, 0)),
  }
  // housing: a cup open at the back (the end cover closes it), shaft hole in the front wall
  const housing = axial(
    [
      [DIM.housingIn, DIM.valveZ0],
      [DIM.housingR, DIM.valveZ0],
      [DIM.housingR, DIM.housingZ1],
      [0.024, DIM.housingZ1],
      [0.024, DIM.housingZ1 - 0.012],
      [DIM.housingIn, DIM.housingZ1 - 0.012],
    ],
    64,
  )
  // swashplate: plate face at local z = 0, trunnions along X
  const swash = merge(slab(circle(DIM.swR, 64), [circle(0.022, 24)], 0, DIM.swT), xform(cylinder(0.011, 2 * DIM.housingR + 0.03, 20), mat4.c(mat4.t(0, 0, DIM.swT / 2), mat4.rz(PI / 2))))
  const lever = merge(xform(cylinder(0.007, 0.1, 12), mat4.t(0, 0.05, 0)), xform(lathe([[0, -0.012], [0.012, -0.006], [0.012, 0.006], [0, 0.012]], 16), mat4.t(0, 0.105, 0)))
  const shaft = merge(shaftZ(DIM.shaftR, DIM.valveZ0 + 0.002, 0.16, 24), ringZ(0.04, DIM.shaftR, 0.15, 0.162, 40))
  const motorShaft = shaftZ(DIM.shaftR, DIM.valveZ0 + 0.002, DIM.wheelZ + 0.02, 24)
  const piston = lathe(
    [
      [0, -DIM.pistonL],
      [DIM.pistonR, -DIM.pistonL],
      [DIM.pistonR, -0.007],
      [0.004, -0.0055],
      [0.0065, -0.0035],
      [0.0068, 0],
      [0.0055, 0.004],
      [0, 0.0066],
    ],
    20,
  )
  const pistonZ = xform(piston, mat4.rx(PI / 2))
  const slipper = shaftZ(DIM.slipperR, 0, DIM.slipperT, 20)
  const column = shaftZ(UNIT.bore / 2 - 0.0002, 0, 1, 16)
  const pipeWall = { A: pipe(PIPES.A, DIM.pipeR, DIM.pipeIn, 64, 16), B: pipe(PIPES.B, DIM.pipeR, DIM.pipeIn, 64, 16) }
  const pipeOil = { A: pipe(PIPES.A, DIM.pipeIn - 0.0003, 0, 64, 12), B: pipe(PIPES.B, DIM.pipeIn - 0.0003, 0, 64, 12) }
  const wheel = merge(xform(tyre({ radius: DIM.wheelR, width: 0.06, rimRadius: 0.07, lugs: 12, lugHeight: 0.012 }), mat4.rx(PI / 2)))
  const wheelRim = xform(rim(0.07, 0.05, 0.03, 0.01), mat4.rx(PI / 2))
  const base = merge(...[-X, X].map((x) => xform(new THREE.BoxGeometry(0.2, 0.02, 0.16), mat4.t(x, -DIM.housingR - 0.01, 0.02))))
  return { block, valvePlate, kidneyOil, cover, portOil, housing, swash, lever, shaft, motorShaft, piston: pistonZ, slipper, column, pipeWall, pipeOil, wheel, wheelRim, base: merge(base) }
}

let cache: ReturnType<typeof buildHydroGeometry> | null = null
export const hydroGeometry = () => (cache ??= buildHydroGeometry())
