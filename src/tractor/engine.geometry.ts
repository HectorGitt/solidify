import * as THREE from 'three'
import { box, cam, csg, cylinder, extrude, lathe, mat4, merge, pipe, roundedRect, tube, xform, type CsgOp } from '@/geometry'
import {
  BLOCK_X0,
  BLOCK_X1,
  CASE_TOP,
  CASE_X,
  EXHAUST_PORT,
  HEAD_X0,
  HEAD_X1,
  INJECTOR,
  INLET_PORT,
  SPLIT_Y,
  along,
  conRod,
  flywheel,
  gas,
  gudgeonPin,
  injector,
  jacketCoolant,
  liner,
  lobeLift,
  piston,
  pulley,
  pushrod,
  retainer,
  ringGear,
  rings,
  rocker,
  rockerPedestal,
  tappet,
  timingGears,
  valve,
  valveSpring,
} from '@/modules/engine/four-stroke/geometry'
import { CAM_X, CAM_Y, CROWN_TDC, DEFAULTS, DIM, PUSHROD_X, deckGap } from '@/modules/engine/four-stroke/model'

/**
 * The tractor's engine, in full: a four-cylinder version of the single-cylinder engine in the
 * four-stroke scene (100 × 124 mm per cylinder, the size of a classic 3.9-litre tractor diesel)
 * with one-piece castings, a four-throw crankshaft for firing order 1-3-4-2 and a four-cylinder
 * camshaft. Valves, rockers, pistons and rods are that scene's own parts.
 *
 * Engine frame as the four-stroke scene: crank axis = Z (cylinder 1 at the front, +Z), Y up,
 * origin at the crank centre. Worker-safe (no React, no DOM): built once, in the geometry worker.
 */

const { PI } = Math

/** cylinder pitch along the crank */
export const PITCH = 0.135
/** cylinder centres, no. 1 at the front */
export const CYL_Z = [1.5, 0.5, -0.5, -1.5].map((k) => k * PITCH)
/** firing angle of each cylinder (deg in the 720° cycle) for firing order 1-3-4-2 */
export const FIRING = [0, 540, 180, 360]
/** head deck height at the standard compression ratio */
export const HEAD_Y = CROWN_TDC + deckGap(DEFAULTS.r)

const Z1 = CYL_Z[0]
const Z4 = CYL_Z[3]
/** lengths of the cylinder barrel (upper block) and the crankcase, as the single plus three pitches */
const LU = 3 * PITCH + 0.14
const LL = 3 * PITCH + 0.16

const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const onZ = (x: number, y: number, z: number) => mat4.c(mat4.t(x, y, z), along.z)
const each = (f: (z: number, i: number) => THREE.BufferGeometry) => merge(...CYL_Z.map(f))
const valveZ = [DIM.inletZ, DIM.exhaustZ]

/* ------------------------------ castings ------------------------------ */

function block() {
  const upper = xform(box(BLOCK_X1 - BLOCK_X0, CROWN_TDC - CASE_TOP, LU), at((BLOCK_X0 + BLOCK_X1) / 2, (CROWN_TDC + CASE_TOP) / 2, 0))
  const lower = xform(box(2 * CASE_X, CASE_TOP - SPLIT_Y, LL), at(0, (CASE_TOP + SPLIT_Y) / 2, 0))
  const shell = csg(lower, [{ op: 'add', geometry: upper }])
  const ops: CsgOp[] = [
    { op: 'sub', geometry: each((z) => xform(cylinder(DIM.linerOuter, 0.4, 32), at(0, CROWN_TDC - 0.1, z))) },
    // a bay for each throw, leaving main-bearing bulkheads between the cylinders
    { op: 'sub', geometry: each((z) => xform(cylinder(0.112, PITCH - 0.03, 32), onZ(0, 0, z))) },
    { op: 'sub', geometry: xform(box(0.224, 0.06, LL - 0.03), at(0, SPLIT_Y - 0.01, 0)) },
    { op: 'sub', geometry: each((z) => xform(box(0.058, 0.08, PITCH - 0.035), at(CAM_X, CAM_Y, z))) },
    { op: 'sub', geometry: xform(cylinder(0.014, LL + 0.1, 16), onZ(CAM_X, CAM_Y, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.031, LL + 0.1, 24), onZ(0, 0, 0)) },
    { op: 'sub', geometry: each((z) => xform(tube(DIM.jacketOuter, DIM.linerOuter - 0.0005, 0.155, 32), at(0, CROWN_TDC - 0.0115 - 0.155 / 2, z))) },
    { op: 'sub', geometry: each((z) => merge(...valveZ.map((dz) => xform(cylinder(0.0095, 0.32, 12), at(PUSHROD_X, 0.25, z + dz))))) },
    { op: 'sub', geometry: each((z) => merge(...valveZ.map((dz) => xform(cylinder(DIM.tappetR + 0.0008, 0.07, 16), at(PUSHROD_X, CAM_Y + 0.045, z + dz))))) },
  ]
  return csg(shell, ops)
}

function head() {
  const H = DIM.headHeight
  const body = xform(box(HEAD_X1 - HEAD_X0, H, LU), at((HEAD_X0 + HEAD_X1) / 2, H / 2, 0))
  const seat = (r: number) => lathe([[0, -0.01], [r + 0.0005, -0.01], [r + 0.0005, 0.0008], [r - 0.004, 0.006], [0, 0.006]], 24)
  const injM = (z: number) =>
    new THREE.Matrix4().compose(
      INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.08)).add(new THREE.Vector3(0, 0, z)),
      new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir),
      new THREE.Vector3(1, 1, 1),
    )
  return csg(body, [
    { op: 'sub', geometry: each((z) => xform(pipe(INLET_PORT, 0.0165, 0, 20, 12), at(0, 0, z))) },
    { op: 'sub', geometry: each((z) => xform(pipe(EXHAUST_PORT, 0.0145, 0, 20, 12), at(0, 0, z))) },
    { op: 'sub', geometry: each((z) => merge(...valveZ.map((dz) => xform(cylinder(DIM.valveStemR + 0.0004, 0.2, 10), at(DIM.valveX, H / 2 + 0.03, z + dz))))) },
    { op: 'sub', geometry: each((z) => merge(xform(seat(DIM.inletHeadR), at(DIM.valveX, 0, z + DIM.inletZ)), xform(seat(DIM.exhaustHeadR), at(DIM.valveX, 0, z + DIM.exhaustZ)))) },
    { op: 'sub', geometry: each((z) => merge(...valveZ.map((dz) => xform(cylinder(0.0095, 0.3, 12), at(PUSHROD_X, H / 2, z + dz))))) },
    { op: 'sub', geometry: each((z) => xform(cylinder(0.0095, 0.17, 14), injM(z))) },
  ])
}

/** unit-height head gasket (scaled to the deck clearance), with fire rings and pushrod holes */
function gasket() {
  const outline = roundedRect(HEAD_X1 - HEAD_X0, LU, 0.004, (HEAD_X0 + HEAD_X1) / 2, 0)
  // the shape's y becomes −z once laid flat
  for (const z of CYL_Z) {
    const bore = new THREE.Path()
    bore.absarc(0, -z, DIM.bore / 2 + 0.001, 0, PI * 2, true)
    outline.holes.push(bore)
    for (const dz of valveZ) {
      const h = new THREE.Path()
      h.absarc(PUSHROD_X, -(z + dz), 0.0095, 0, PI * 2, true)
      outline.holes.push(h)
    }
  }
  return xform(extrude(outline, 1, { curveSegments: 32 }), mat4.c(at(0, 0.5, 0), mat4.rx(-PI / 2)))
}

function rockerCover() {
  const top = DIM.headHeight
  const h = 0.085
  const outer = xform(box(0.15, h, LU - 0.004), at(-0.04, top + h / 2, 0))
  const inner = xform(box(0.14, h, LU - 0.014), at(-0.04, top + h / 2 - 0.005, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function sump() {
  const outer = xform(box(2 * CASE_X, 0.15, LL), at(0, SPLIT_Y - 0.075, 0))
  const inner = xform(box(2 * CASE_X - 0.012, 0.15, LL - 0.012), at(0, SPLIT_Y - 0.075 + 0.006, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function oil() {
  return xform(box(2 * CASE_X - 0.0125, 0.05, LL - 0.0125), at(0, SPLIT_Y - 0.15 + 0.006 + 0.025 + 0.0002, 0))
}

/* ------------------------------ manifolds (head-local: deck at y = 0) ------------------------------ */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (...pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts)

function inletManifold() {
  const parts = CYL_Z.map((z) => pipe(curve(v(HEAD_X1 - 0.001, 0.064, z + DIM.inletZ + 0.01), v(0.115, 0.07, z + DIM.inletZ + 0.01), v(0.145, 0.085, z + 0.02)), 0.019, 0.016, 24, 20))
  parts.push(pipe(curve(v(0.15, 0.088, Z4 - 0.045), v(0.15, 0.088, Z1 + 0.06)), 0.03, 0.026, 8, 28))
  // riser to the air cleaner at the front
  parts.push(pipe(curve(v(0.15, 0.088, Z1 + 0.055), v(0.15, 0.13, Z1 + 0.09), v(0.15, 0.24, Z1 + 0.1)), 0.026, 0.022, 24, 24))
  return merge(...parts)
}

function exhaustManifold() {
  const parts = CYL_Z.map((z) => pipe(curve(v(HEAD_X1 - 0.001, 0.042, z + DIM.exhaustZ - 0.01), v(0.12, 0.034, z + DIM.exhaustZ - 0.02), v(0.165, 0.005, z - 0.035)), 0.017, 0.014, 24, 20))
  parts.push(pipe(curve(v(0.17, 0.0, Z4 - 0.06), v(0.17, 0.0, Z1 + 0.02)), 0.024, 0.02, 8, 24))
  // outlet: up past the manifold, towards the tractor's exhaust stack at the front
  parts.push(pipe(curve(v(0.17, 0.0, Z1 + 0.015), v(0.2, 0.04, Z1 + 0.06), v(0.215, 0.2, Z1 + 0.07), v(0.215, 0.32, Z1 + 0.07)), 0.022, 0.018, 32, 24))
  return merge(...parts)
}

/* ------------------------------ fuel ------------------------------ */

/** In-line injection pump on the side of the crankcase, engine-local. */
const PUMP = { x: 0.178, y: 0.175 }

function injectionPump() {
  const body = xform(box(0.07, 0.09, 3 * PITCH + 0.08), at(PUMP.x, PUMP.y, 0))
  const governor = xform(box(0.075, 0.11, 0.09), at(PUMP.x, PUMP.y + 0.01, Z4 - 0.11))
  const holders = each((z) => xform(cylinder(0.009, 0.03, 16), at(PUMP.x, PUMP.y + 0.06, z)))
  return merge(body, governor, holders)
}

/** where each injector's fuel inlet sits, engine-local */
export function injectorTop(z: number) {
  return INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.135)).add(v(0, HEAD_Y, z))
}

function hpPipes() {
  return each((z) => {
    const top = injectorTop(z)
    return pipe(curve(v(PUMP.x, PUMP.y + 0.074, z), v(PUMP.x + 0.01, HEAD_Y - 0.06, z + 0.012), v(0.2, HEAD_Y + 0.15, z + 0.012), v(top.x + 0.03, top.y + 0.02, z + 0.006), top), 0.0032, 0.0012, 48, 10)
  })
}

/* ------------------------------ crank & cam ------------------------------ */

/** four throws on one shaft, pins placed so each cylinder reaches TDC at its firing angle */
function crankshaft4() {
  const R = DIM.crankR
  const web = new THREE.Shape()
  const cw = 0.079
  const a0 = PI / 2 + PI - 0.95
  const a1 = PI / 2 + PI + 0.95
  web.absarc(0, 0, cw, a0, a1, false)
  web.lineTo(0.034 * Math.cos(0.35), R + 0.034 * Math.sin(0.35))
  web.absarc(0, R, 0.034, 0.35, PI - 0.35, false)
  web.lineTo(cw * Math.cos(a0), cw * Math.sin(a0))
  const webG = extrude(web, 0.014, { curveSegments: 32 })
  const throwG = merge(...[0.022, -0.022].map((z) => xform(webG, at(0, 0, z))), xform(cylinder(0.028, 0.032, 40), onZ(0, R, 0)))
  const throws = CYL_Z.map((z, i) => xform(throwG, mat4.c(at(0, 0, z), mat4.rz((-FIRING[i] * PI) / 180))))
  // main journals: front, between each pair of throws, and rear
  const mains = [xform(cylinder(0.03, 0.066, 40), onZ(0, 0, Z1 + 0.062))]
  for (let i = 0; i < 3; i++) mains.push(xform(cylinder(0.03, PITCH - 0.058, 40), onZ(0, 0, (CYL_Z[i] + CYL_Z[i + 1]) / 2)))
  mains.push(xform(cylinder(0.03, 0.066, 40), onZ(0, 0, Z4 - 0.062)))
  const nose = xform(cylinder(0.02, 0.055, 32), onZ(0, 0, Z1 + 0.12))
  const tail = xform(lathe([[0, 0], [0.04, 0], [0.04, 0.012], [0.03, 0.012], [0.03, 0.03], [0, 0.03]], 40), mat4.c(at(0, 0, Z4 - 0.095), mat4.rx(-PI / 2)))
  return merge(...throws, ...mains, nose, tail)
}

/** main-bearing shells in the bulkheads */
function mainBearings() {
  const zs = [Z1 + 0.062, ...[0, 1, 2].map((i) => (CYL_Z[i] + CYL_Z[i + 1]) / 2), Z4 - 0.062]
  return merge(...zs.map((z) => xform(tube(0.0335, 0.0302, 0.03, 40), onZ(0, 0, z))))
}

/** lobes for every cylinder, each pre-turned by half its firing angle (the shaft turns at half speed) */
function camshaft4() {
  const shaft = xform(cylinder(0.0105, LL + 0.04, 24), onZ(0, 0, 0))
  const lobes = CYL_Z.map((z, i) =>
    merge(
      xform(cam(DIM.camBase, lobeLift('inlet'), 0.014), mat4.c(at(0, 0, z + DIM.inletZ), mat4.rz((FIRING[i] * PI) / 360))),
      xform(cam(DIM.camBase, lobeLift('exhaust'), 0.014), mat4.c(at(0, 0, z + DIM.exhaustZ), mat4.rz((FIRING[i] * PI) / 360))),
    ),
  )
  const jz = [Z1 + 0.065, ...[0, 1, 2].map((i) => (CYL_Z[i] + CYL_Z[i + 1]) / 2), Z4 - 0.065]
  const journals = merge(...jz.map((z) => xform(cylinder(0.0138, 0.016, 32), onZ(0, 0, z))))
  return { shaft, lobes: merge(...lobes), journals }
}

/* ------------------------------ valve gear (head-local) ------------------------------ */

function rockerGear() {
  const shaft = xform(cylinder(0.0058, LU - 0.03, 24), onZ(DIM.rockerX, DIM.rockerY, 0))
  const pz = [Z1 + PITCH / 2 - 0.01, ...[0, 1, 2].map((i) => (CYL_Z[i] + CYL_Z[i + 1]) / 2), Z4 - PITCH / 2 + 0.01]
  const ped = rockerPedestal()
  const pedestals = merge(...pz.map((z) => xform(ped, at(DIM.rockerX, (DIM.headHeight + DIM.rockerY) / 2 - 0.004, z))))
  return { shaft, pedestals }
}

/* ------------------------------ all ------------------------------ */

export function buildStatic() {
  const rod = conRod()
  const inj = injector()
  const cs = camshaft4()
  const rg = rockerGear()
  return {
    block: block(),
    coolant: each((z) => xform(jacketCoolant(), at(0, 0, z))),
    liner: liner(),
    mains: mainBearings(),
    head: head(),
    gasket: gasket(),
    cover: rockerCover(),
    sump: sump(),
    oil: oil(),
    inlet: inletManifold(),
    exhaust: exhaustManifold(),
    pump: injectionPump(),
    hpPipes: hpPipes(),
    injector: inj,
    crank: crankshaft4(),
    flywheel: flywheel(),
    ringGear: ringGear(),
    timing: timingGears(),
    pulley: pulley(),
    rod,
    piston: piston(),
    rings: rings(),
    pin: gudgeonPin(),
    gas: gas(),
    camShaft: cs.shaft,
    camLobes: cs.lobes,
    camJournals: cs.journals,
    tappet: tappet(),
    pushrod: pushrod(),
    rocker: rocker(),
    rockerShaft: rg.shaft,
    pedestals: rg.pedestals,
    inletValve: valve(DIM.inletHeadR),
    exhaustValve: valve(DIM.exhaustHeadR),
    spring: valveSpring(),
    retainer: retainer(),
  }
}

export type TractorEngineGeometry = ReturnType<typeof buildStatic>

let ready: TractorEngineGeometry | null = null
let pending: Promise<TractorEngineGeometry> | null = null

/** Build (in the worker) and cache; safe to call often. */
export function prepareTractorEngine() {
  if (ready) return Promise.resolve(ready)
  return (pending ??= import('@/geometry/build')
    .then(({ buildGeometry }) => buildGeometry('tractor/engine', buildStatic))
    .then((g) => (ready = g)))
}

export const tractorEngineReady = () => ready
