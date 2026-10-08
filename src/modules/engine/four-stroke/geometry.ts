import * as THREE from 'three'
import {
  box,
  cam,
  csg,
  cylinder,
  extrude,
  gear,
  helixSpring,
  lathe,
  mat4,
  merge,
  pipe,
  roundedRect,
  tube,
  xform,
  type V2,
} from '@/geometry'
import { BOWL, CAM_X, CAM_Y, CROWN_TDC, DIM, PUSHROD_X, tappetLifts } from './model'

const { PI } = Math
const along = {
  /** rotate a Y-axis solid so its axis lies along Z */
  z: mat4.rx(PI / 2),
  /** rotate a Y-axis solid so its axis lies along X */
  x: mat4.rz(PI / 2),
}

/** Smooth closed curve through points (for ports and manifolds). */
const path = (pts: [number, number, number][], tension = 0.5) =>
  new THREE.CatmullRomCurve3(
    pts.map((p) => new THREE.Vector3(...p)),
    false,
    'catmullrom',
    tension,
  )

/* ---------- ports, shared by the head (as cut-outs) and the flow particles ---------- */

/** Inlet port centre line in HEAD-LOCAL coordinates (head deck at y = 0). */
export const INLET_PORT = path([
  [DIM.valveX, -0.002, DIM.inletZ],
  [DIM.valveX, 0.02, DIM.inletZ],
  [DIM.valveX + 0.02, 0.048, DIM.inletZ + 0.006],
  [0.06, 0.062, DIM.inletZ + 0.01],
  [0.1, 0.064, DIM.inletZ + 0.01],
])

export const EXHAUST_PORT = path([
  [DIM.valveX, -0.002, DIM.exhaustZ],
  [DIM.valveX, 0.018, DIM.exhaustZ],
  [DIM.valveX + 0.022, 0.036, DIM.exhaustZ - 0.006],
  [0.06, 0.042, DIM.exhaustZ - 0.01],
  [0.1, 0.042, DIM.exhaustZ - 0.01],
])

/** Injector axis: tip near the bowl centre, body leaning out towards +X. */
export const INJECTOR = (() => {
  const tilt = (16 * PI) / 180
  const tip = new THREE.Vector3(0.008, 0.002, 0)
  const dir = new THREE.Vector3(Math.sin(tilt), Math.cos(tilt), 0)
  return { tilt, tip, dir }
})()

/* ------------------------------ block ------------------------------ */

const BLOCK_X0 = -0.108
const BLOCK_X1 = 0.082
const BLOCK_Z = 0.07
const CASE_X = 0.132
const CASE_Z = 0.08
const CASE_TOP = 0.13
const SPLIT_Y = -0.025

function blockGeometry() {
  const upper = xform(box(BLOCK_X1 - BLOCK_X0, CROWN_TDC - CASE_TOP, 2 * BLOCK_Z), mat4.t((BLOCK_X0 + BLOCK_X1) / 2, (CROWN_TDC + CASE_TOP) / 2, 0))
  const lower = xform(box(2 * CASE_X, CASE_TOP - SPLIT_Y, 2 * CASE_Z), mat4.t(0, (CASE_TOP + SPLIT_Y) / 2, 0))
  const shell = csg(lower, [{ op: 'add', geometry: upper }])
  const bore = xform(cylinder(DIM.linerOuter, 0.4, 48), mat4.t(0, CROWN_TDC - 0.1, 0))
  const crankCavity = xform(cylinder(0.112, 0.13, 56), along.z)
  const sumpOpening = xform(box(0.224, 0.06, 0.13), mat4.t(0, SPLIT_Y - 0.01, 0))
  const camCavity = xform(box(0.058, 0.08, 0.13), mat4.t(CAM_X, CAM_Y, 0))
  const camBore = xform(cylinder(0.014, 0.3, 24), mat4.c(mat4.t(CAM_X, CAM_Y, 0), along.z))
  const mainBore = xform(cylinder(0.031, 0.3, 32), along.z)
  const jacket = xform(tube(DIM.jacketOuter, DIM.linerOuter - 0.0005, 0.155, 48), mat4.t(0, CROWN_TDC - 0.0115 - 0.155 / 2, 0))
  const ops = [
    { op: 'sub' as const, geometry: bore },
    { op: 'sub' as const, geometry: crankCavity },
    { op: 'sub' as const, geometry: sumpOpening },
    { op: 'sub' as const, geometry: camCavity },
    { op: 'sub' as const, geometry: camBore },
    { op: 'sub' as const, geometry: mainBore },
    { op: 'sub' as const, geometry: jacket },
  ]
  for (const z of [DIM.inletZ, DIM.exhaustZ]) {
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.32, 20), mat4.t(PUSHROD_X, 0.25, z)) })
    ops.push({ op: 'sub', geometry: xform(cylinder(DIM.tappetR + 0.0008, 0.07, 24), mat4.t(PUSHROD_X, CAM_Y + 0.045, z)) })
  }
  return csg(shell, ops)
}

/** Coolant filling the block water jacket. */
function jacketCoolant() {
  return xform(tube(DIM.jacketOuter - 0.0003, DIM.linerOuter, 0.155 - 0.0006, 48), mat4.t(0, CROWN_TDC - 0.0115 - 0.155 / 2, 0))
}

function liner() {
  const top = CROWN_TDC
  const bottom = 0.1
  return lathe(
    [
      [DIM.bore / 2, bottom],
      [DIM.linerOuter - 0.0002, bottom],
      [DIM.linerOuter - 0.0002, top],
      [DIM.bore / 2, top],
    ],
    64,
  )
}

/* ------------------------------ head ------------------------------ */

const HEAD_X0 = BLOCK_X0
const HEAD_X1 = BLOCK_X1

function headGeometry() {
  const H = DIM.headHeight
  const body = xform(box(HEAD_X1 - HEAD_X0, H, 2 * BLOCK_Z), mat4.t((HEAD_X0 + HEAD_X1) / 2, H / 2, 0))
  const ops: { op: 'sub'; geometry: THREE.BufferGeometry; matrix?: THREE.Matrix4 }[] = []
  ops.push({ op: 'sub', geometry: pipe(INLET_PORT, 0.0165, 0, 40, 20) })
  ops.push({ op: 'sub', geometry: pipe(EXHAUST_PORT, 0.0145, 0, 40, 20) })
  for (const [z, r] of [
    [DIM.inletZ, DIM.inletHeadR],
    [DIM.exhaustZ, DIM.exhaustHeadR],
  ] as const) {
    // valve guide bore and seat recess
    ops.push({ op: 'sub', geometry: xform(cylinder(DIM.valveStemR + 0.0004, 0.2, 20), mat4.t(DIM.valveX, H / 2 + 0.03, z)) })
    ops.push({ op: 'sub', geometry: xform(lathe([[0, -0.01], [r + 0.0005, -0.01], [r + 0.0005, 0.0008], [r - 0.004, 0.006], [0, 0.006]], 40), mat4.t(DIM.valveX, 0, z)) })
    // pushrod passage
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.3, 20), mat4.t(PUSHROD_X, H / 2, z)) })
  }
  // injector bore along its tilted axis
  const injM = new THREE.Matrix4().compose(
    INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.08)),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir),
    new THREE.Vector3(1, 1, 1),
  )
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0095, 0.17, 24), injM) })
  return csg(body, ops)
}

function gasketGeometry() {
  // unit height plate, scaled to the deck gap
  const outline = roundedRect(HEAD_X1 - HEAD_X0, 2 * BLOCK_Z, 0.004, (HEAD_X0 + HEAD_X1) / 2, 0)
  const hole = new THREE.Path()
  hole.absarc(0, 0, DIM.bore / 2 + 0.001, 0, PI * 2, true)
  outline.holes.push(hole)
  for (const z of [DIM.inletZ, DIM.exhaustZ]) {
    const h = new THREE.Path()
    h.absarc(PUSHROD_X, z, 0.0095, 0, PI * 2, true)
    outline.holes.push(h)
  }
  const g = extrude(outline, 1, { curveSegments: 32 })
  // extruded along Z → lay flat (XZ) with y from 0 to 1
  return xform(g, mat4.c(mat4.t(0, 0.5, 0), mat4.rx(-PI / 2)))
}

function rockerCover() {
  const top = DIM.headHeight
  const h = 0.085
  const outer = xform(box(0.15, h, 2 * BLOCK_Z - 0.004), mat4.t(-0.04, top + h / 2, 0))
  const inner = xform(box(0.14, h, 2 * BLOCK_Z - 0.014), mat4.t(-0.04, top + h / 2 - 0.005, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

/* ------------------------------ valve train ------------------------------ */

function valve(headR: number) {
  const s = DIM.valveStemR
  const L = DIM.valveTip
  return lathe(
    [
      [0, 0],
      [headR, 0],
      [headR, 0.0022],
      [headR - 0.0035, 0.0052],
      [s + 0.0025, 0.014],
      [s, 0.022],
      [s, L],
      [0, L],
    ],
    40,
  )
}

/** Spring of unit length along Y (scaled to the live installed length). */
export const SPRING_SEAT = DIM.headHeight
export const SPRING_FREE = DIM.valveTip - 0.012 - DIM.headHeight
function valveSpring() {
  return helixSpring(0.0125, 0.0021, 1, 6)
}

function retainer() {
  return lathe([[DIM.valveStemR, 0], [0.0155, 0.0], [0.0155, 0.003], [0.0085, 0.009], [DIM.valveStemR, 0.009]], 32)
}

function rocker() {
  // side profile in XY, pivot at origin, pushrod end at −armPush, valve end at +armValve
  const s = new THREE.Shape()
  const a = DIM.rockerArmPush
  const b = DIM.rockerArmValve
  s.moveTo(-a - 0.006, -0.002)
  s.lineTo(-a - 0.006, 0.006)
  s.quadraticCurveTo(-a * 0.4, 0.013, 0, 0.012)
  s.quadraticCurveTo(b * 0.55, 0.011, b + 0.002, 0.004)
  s.quadraticCurveTo(b + 0.008, 0.0, b + 0.004, -0.007)
  s.lineTo(b - 0.006, -0.008)
  s.quadraticCurveTo(b * 0.5, -0.006, 0, -0.011)
  s.quadraticCurveTo(-a * 0.5, -0.008, -a - 0.006, -0.002)
  const pivot = new THREE.Path()
  pivot.absarc(0, 0, 0.0062, 0, PI * 2, true)
  s.holes.push(pivot)
  return extrude(s, 0.012, { curveSegments: 16 })
}

function rockerShaft() {
  return xform(cylinder(0.0058, 0.14, 24), along.z)
}

function rockerPedestal() {
  return box(0.014, DIM.rockerY - DIM.headHeight, 0.012)
}

function tappet() {
  return lathe([[0, 0], [DIM.tappetR, 0], [DIM.tappetR, DIM.tappetH], [0.006, DIM.tappetH], [0.004, DIM.tappetH - 0.004], [0, DIM.tappetH - 0.004]], 32)
}

/** Pushrod of unit length along Y. */
function pushrod() {
  return lathe([[0, 0], [0.0035, 0.0], [0.0042, 0.02], [0.0042, 0.98], [0.0035, 1], [0, 1]], 16)
}

/** Lobe profile from the valve-timing curve: cam angle φ ↔ crank angle 2φ. */
function lobeLift(which: 'inlet' | 'exhaust') {
  return (phi: number) => {
    const deg = ((phi * 2 * 180) / PI) % 720
    return tappetLifts(deg < 0 ? deg + 720 : deg)[which]
  }
}

function camshaft() {
  const shaft = xform(cylinder(0.0105, 0.235, 24), mat4.c(mat4.t(0, 0, -0.0075), along.z))
  const inlet = xform(cam(DIM.camBase, lobeLift('inlet'), 0.014), mat4.t(0, 0, DIM.inletZ))
  const exhaust = xform(cam(DIM.camBase, lobeLift('exhaust'), 0.014), mat4.t(0, 0, DIM.exhaustZ))
  const journals = [0.065, -0.065].map((z) => xform(cylinder(0.0138, 0.016, 32), mat4.c(mat4.t(0, 0, z), along.z)))
  return { shaft, lobes: merge(inlet, exhaust), journals: merge(...journals) }
}

/* ------------------------------ crank train ------------------------------ */

function crankshaft() {
  const R = DIM.crankR
  // web profile in XY (crank local frame: pin at +Y)
  const web = new THREE.Shape()
  const cw = 0.079
  const a0 = PI / 2 + PI - 0.95
  const a1 = PI / 2 + PI + 0.95
  web.absarc(0, 0, cw, a0, a1, false)
  web.lineTo(0.034 * Math.cos(0.35), R + 0.034 * Math.sin(0.35))
  web.absarc(0, R, 0.034, 0.35, PI - 0.35, false)
  web.lineTo(cw * Math.cos(a0), cw * Math.sin(a0))
  const webs = [0.022, -0.022].map((z) => xform(extrude(web, 0.014, { curveSegments: 32 }), mat4.t(0, 0, z)))
  const pin = xform(cylinder(0.028, 0.032, 40), mat4.c(mat4.t(0, R, 0), along.z))
  const mains = [
    xform(cylinder(0.03, 0.066, 40), mat4.c(mat4.t(0, 0, 0.062), along.z)),
    xform(cylinder(0.03, 0.066, 40), mat4.c(mat4.t(0, 0, -0.062), along.z)),
  ]
  const nose = xform(cylinder(0.02, 0.055, 32), mat4.c(mat4.t(0, 0, 0.12), along.z))
  const tail = xform(lathe([[0, 0], [0.04, 0], [0.04, 0.012], [0.03, 0.012], [0.03, 0.03], [0, 0.03]], 40), mat4.c(mat4.t(0, 0, -0.095), mat4.rx(-PI / 2)))
  return merge(...webs, pin, ...mains, nose, tail)
}

function flywheel() {
  const g = lathe(
    [
      [0.03, 0],
      [0.15, 0],
      [0.15, 0.042],
      [0.12, 0.042],
      [0.11, 0.016],
      [0.06, 0.016],
      [0.055, 0.03],
      [0.03, 0.03],
    ],
    96,
  )
  return xform(g, mat4.rx(-PI / 2)) // axis along −Z → faces the block
}

function ringGear() {
  return gear({ teeth: 108, module: 0.0029, width: 0.016, bore: 0.15, flankPoints: 4 })
}

function timingGears() {
  const crank = gear({ teeth: DIM.crankTeeth, module: DIM.timingModule, width: 0.014, bore: 0.02 })
  const camG = gear({ teeth: DIM.camTeeth, module: DIM.timingModule, width: 0.014, bore: 0.0105 })
  return { crank, cam: camG }
}

function pulley() {
  return xform(
    lathe([[0.02, 0], [0.072, 0], [0.072, 0.004], [0.058, 0.012], [0.072, 0.02], [0.072, 0.024], [0.02, 0.024]], 64),
    mat4.rx(PI / 2),
  )
}

function conRod() {
  const L = DIM.rodL
  const big = 0.043
  const bore = 0.0305
  const s = new THREE.Shape()
  // start on the split line at the right, go up the big end, shank, small end, back down
  s.moveTo(big, 0)
  s.absarc(0, 0, big, 0, 1.18, false)
  s.lineTo(0.0115, L - 0.03)
  s.absarc(0, L, 0.021, -1.0, PI + 1.0, false)
  s.lineTo(-0.0115, L - 0.03)
  s.lineTo(-big * Math.cos(1.18), big * Math.sin(1.18))
  s.absarc(0, 0, big, PI - 1.18, PI, false)
  s.lineTo(-bore, 0)
  s.absarc(0, 0, bore, PI, 0, true)
  s.lineTo(big, 0)
  const small = new THREE.Path()
  small.absarc(0, L, 0.0145, 0, PI * 2, true)
  s.holes.push(small)
  const body = extrude(s, 0.028, { curveSegments: 40 })
  const capS = new THREE.Shape()
  capS.moveTo(big, 0)
  capS.lineTo(bore, 0)
  capS.absarc(0, 0, bore, 0, -PI, true)
  capS.lineTo(-big, 0)
  capS.absarc(0, 0, big, PI, PI * 2, false)
  const cap = extrude(capS, 0.028, { curveSegments: 40 })
  const boltHoles = [0.0365, -0.0365].map((x) => ({ op: 'sub' as const, geometry: xform(cylinder(0.0042, 0.1, 16), mat4.t(x, 0, 0)) }))
  const bolts = merge(...[0.0365, -0.0365].map((x) => xform(cylinder(0.0039, 0.066, 16), mat4.t(x, -0.004, 0))))
  const shells = lathe(
    [
      [0.028, -0.0135],
      [bore - 0.0001, -0.0135],
      [bore - 0.0001, 0.0135],
      [0.028, 0.0135],
    ],
    48,
  )
  return {
    body: csg(body, boltHoles),
    cap: csg(cap, boltHoles),
    bolts,
    shells: xform(shells, along.z),
    bush: xform(tube(0.0145, 0.014, 0.028, 32), mat4.c(mat4.t(0, L, 0), along.z)),
  }
}

function piston() {
  const R = DIM.bore / 2 - 0.0004
  const top = DIM.pistonComp
  const bottom = -DIM.pistonSkirt
  const d = 0.0042
  // ring grooves, bottom to top: oil, second compression, top compression
  const grooves: [number, number][] = [
    [top - 0.026, 0.004],
    [top - 0.017, 0.0026],
    [top - 0.009, 0.0026],
  ]
  // CCW in the (r, y) half-plane: cavity ceiling → inner skirt → skirt bottom → outer wall → crown → bowl → axis
  const prof: V2[] = [
    [0, top - 0.03],
    [0.022, top - 0.03],
    [R - 0.0055, top - 0.036],
    [R - 0.0055, bottom],
    [R, bottom],
  ]
  for (const [gy, w] of grooves) prof.push([R, gy - w / 2], [R - d, gy - w / 2], [R - d, gy + w / 2], [R, gy + w / 2])
  prof.push([R, top])
  for (let i = 1; i < BOWL.length; i++) prof.push([BOWL[i][0], top - BOWL[i][1]])
  const body = lathe(prof, 72)
  const boss = xform(cylinder(0.019, 2 * (R - 0.004), 32), along.z)
  const slot = xform(box(0.08, 0.086, 0.031), mat4.t(0, -0.017, 0))
  const pinHole = xform(cylinder(0.014, 0.2, 32), along.z)
  return csg(body, [
    { op: 'add', geometry: boss },
    { op: 'sub', geometry: slot },
    { op: 'sub', geometry: pinHole },
  ])
}

function rings() {
  const R = DIM.bore / 2
  const top = DIM.pistonComp
  const ring = (y: number, h: number) => lathe([[R - 0.0040, y - h / 2], [R - 0.00005, y - h / 2], [R - 0.00005, y + h / 2], [R - 0.0040, y + h / 2]], 72)
  return {
    compression: merge(ring(top - 0.009, 0.0024), ring(top - 0.017, 0.0024)),
    oil: ring(top - 0.026, 0.0038),
  }
}

function gudgeonPin() {
  return xform(tube(0.0139, 0.008, 2 * (DIM.bore / 2 - 0.006), 32), along.z)
}

/** Gas in the bowl (moves with the piston) and a unit-height column above the crown. */
function gas() {
  const bowl = lathe(BOWL.map(([r, d]) => [Math.max(0, r - 0.0002), -d + 0.0002] as V2).reverse(), 48)
  const column = lathe([[0, 0], [DIM.bore / 2 - 0.0002, 0], [DIM.bore / 2 - 0.0002, 1], [0, 1]], 64)
  return { bowl, column }
}

/* ------------------------------ injector ------------------------------ */

function injector() {
  const L = 0.14
  const body = lathe(
    [
      [0.0, 0],
      [0.0035, 0],
      [0.0042, 0.012],
      [0.0085, 0.02],
      [0.0085, 0.085],
      [0.0115, 0.088],
      [0.0115, 0.12],
      [0.006, 0.124],
      [0.006, L],
      [0.003, L],
      [0.003, 0.124],
      // inner bore for the needle & spring
      [0.0042, 0.12],
      [0.0042, 0.03],
      [0.0019, 0.012],
      [0, 0.006],
    ],
    32,
  )
  const needle = lathe([[0, 0.0065], [0.0019, 0.0125], [0.0026, 0.03], [0.0026, 0.07], [0, 0.07]], 20)
  const spring = xform(helixSpring(0.0031, 0.0007, 1, 9), mat4.t(0, 0, 0))
  return { body, needle, spring }
}

/* ------------------------------ manifolds, sump ------------------------------ */

export const INTAKE_PATH = (headY: number) =>
  path([
    [HEAD_X1 - 0.001, headY + 0.064, DIM.inletZ + 0.01],
    [0.14, headY + 0.07, DIM.inletZ + 0.01],
    [0.165, headY + 0.11, DIM.inletZ + 0.01],
    [0.17, headY + 0.17, DIM.inletZ + 0.01],
  ])

export const EXHAUST_PATH = (headY: number) =>
  path([
    [HEAD_X1 - 0.001, headY + 0.042, DIM.exhaustZ - 0.01],
    [0.145, headY + 0.04, DIM.exhaustZ - 0.02],
    [0.18, headY + 0.0, DIM.exhaustZ - 0.04],
    [0.2, headY - 0.06, DIM.exhaustZ - 0.05],
  ])

function airCleaner() {
  return lathe([[0, 0], [0.05, 0], [0.055, 0.01], [0.055, 0.11], [0.045, 0.125], [0, 0.125]], 48)
}

function sump() {
  const outer = xform(box(2 * CASE_X, 0.15, 2 * CASE_Z), mat4.t(0, SPLIT_Y - 0.075, 0))
  const inner = xform(box(2 * CASE_X - 0.012, 0.15, 2 * CASE_Z - 0.012), mat4.t(0, SPLIT_Y - 0.075 + 0.006, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function sumpOil() {
  return xform(box(2 * CASE_X - 0.0125, 0.05, 2 * CASE_Z - 0.0125), mat4.t(0, SPLIT_Y - 0.15 + 0.006 + 0.025 + 0.0002, 0))
}

/* ------------------------------ build all (cached) ------------------------------ */

/** Heavy, parameter-independent parts — built once, in the geometry worker. */
export function buildStatic() {
  const cs = camshaft()
  return {
    block: blockGeometry(),
    coolant: jacketCoolant(),
    liner: liner(),
    head: headGeometry(),
    gasket: gasketGeometry(),
    rockerCover: rockerCover(),
    inletValve: valve(DIM.inletHeadR),
    exhaustValve: valve(DIM.exhaustHeadR),
    spring: valveSpring(),
    retainer: retainer(),
    rocker: rocker(),
    rockerShaft: rockerShaft(),
    pedestal: rockerPedestal(),
    tappet: tappet(),
    pushrod: pushrod(),
    camshaft: cs.shaft,
    camLobes: cs.lobes,
    camJournals: cs.journals,
    crankshaft: crankshaft(),
    flywheel: flywheel(),
    ringGear: ringGear(),
    timing: timingGears(),
    pulley: pulley(),
    rod: conRod(),
    piston: piston(),
    rings: rings(),
    pin: gudgeonPin(),
    gas: gas(),
    injector: injector(),
    airCleaner: airCleaner(),
    sump: sump(),
    oil: sumpOil(),
  }
}

export type StaticEngineGeometry = ReturnType<typeof buildStatic>

/** Cheap parts that depend on the head position (compression ratio) — built on the main thread. */
export const dynamicParts = {
  intakePipe: (headY: number) => pipe(INTAKE_PATH(headY), 0.019, 0.016, 40, 24),
  exhaustPipe: (headY: number) => pipe(EXHAUST_PATH(headY), 0.017, 0.014, 40, 24),
  hpPipe: (from: THREE.Vector3) =>
    pipe(new THREE.CatmullRomCurve3([from, from.clone().add(new THREE.Vector3(0.03, 0.02, 0)), new THREE.Vector3(0.2, from.y + 0.03, 0.04)]), 0.0032, 0.0012, 24, 10),
}

let ready: StaticEngineGeometry | null = null

/** Resolve the static geometry (worker) before the scene mounts. */
export async function prepareEngineGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/four-stroke', buildStatic)
  return ready
}

/** Geometry for rendering; builds synchronously if prepare() was skipped (e.g. tests). */
export function buildEngineGeometry(): StaticEngineGeometry & typeof dynamicParts {
  if (!ready) ready = buildStatic()
  return { ...ready, ...dynamicParts }
}
