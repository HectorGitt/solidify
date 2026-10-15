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
import { CAM_X, CAM_Y, CROWN_TDC, DIM, PUSHROD_X } from '@/modules/engine/four-stroke/model'
import { sparkPlug } from '@/parts/lib/electrical'
import { BLOCK_INLET, FIRING_4, HEAD_OUTLET, HEAD_PASSAGE, HEAD_Y, PITCH, engineLayout, type EngineLayout } from './layout'

/**
 * The shared inline diesel engine, in full, for any number of cylinders and any firing order: the
 * single-cylinder engine of the four-stroke scene (100 × 124 mm per cylinder) repeated along one
 * crankshaft, with one-piece castings, a crankshaft whose throws suit the firing order, a camshaft
 * with a pair of lobes per cylinder, manifolds, an in-line injection pump and the valve gear.
 * Valves, rockers, pistons and rods are the four-stroke scene's own parts. Other sizes are this
 * engine scaled (see Engine.tsx).
 *
 * Engine frame as the four-stroke scene: crank axis = Z (cylinder 1 at the front, +Z), Y up,
 * origin at the crank centre. Worker-safe (no React, no DOM): built in the geometry worker, once per
 * firing layout.
 */

const { PI } = Math

export { FIRING_4, FIRING_ORDERS, HEAD_Y, PITCH, engineLayout, firingFromOrder, type EngineLayout } from './layout'

const at = (x: number, y: number, z: number) => mat4.t(x, y, z)
const onZ = (x: number, y: number, z: number) => mat4.c(mat4.t(x, y, z), along.z)
const each = (L: EngineLayout, f: (z: number, i: number) => THREE.BufferGeometry) => merge(...L.cylZ.map(f))
const valveZ = [DIM.inletZ, DIM.exhaustZ]

/* ------------------------------ castings ------------------------------ */

function block(L: EngineLayout) {
  const upper = xform(box(BLOCK_X1 - BLOCK_X0, CROWN_TDC - CASE_TOP, L.lu), at((BLOCK_X0 + BLOCK_X1) / 2, (CROWN_TDC + CASE_TOP) / 2, 0))
  const lower = xform(box(2 * CASE_X, CASE_TOP - SPLIT_Y, L.ll), at(0, (CASE_TOP + SPLIT_Y) / 2, 0))
  const shell = csg(lower, [{ op: 'add', geometry: upper }])
  const ops: CsgOp[] = [
    { op: 'sub', geometry: each(L, (z) => xform(cylinder(DIM.linerOuter, 0.4, 32), at(0, CROWN_TDC - 0.1, z))) },
    // a bay for each throw, leaving main-bearing bulkheads between the cylinders
    { op: 'sub', geometry: each(L, (z) => xform(cylinder(0.112, PITCH - 0.03, 32), onZ(0, 0, z))) },
    { op: 'sub', geometry: xform(box(0.224, 0.06, L.ll - 0.03), at(0, SPLIT_Y - 0.01, 0)) },
    { op: 'sub', geometry: each(L, (z) => xform(box(0.058, 0.08, PITCH - 0.035), at(CAM_X, CAM_Y, z))) },
    { op: 'sub', geometry: xform(cylinder(0.014, L.ll + 0.1, 16), onZ(CAM_X, CAM_Y, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.031, L.ll + 0.1, 24), onZ(0, 0, 0)) },
    { op: 'sub', geometry: each(L, (z) => xform(tube(DIM.jacketOuter, DIM.linerOuter - 0.0005, 0.155, 32), at(0, CROWN_TDC - 0.0115 - 0.155 / 2, z))) },
    { op: 'sub', geometry: each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(0.0095, 0.32, 12), at(PUSHROD_X, 0.25, z + dz))))) },
    { op: 'sub', geometry: each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(DIM.tappetR + 0.0008, 0.07, 16), at(PUSHROD_X, CAM_Y + 0.045, z + dz))))) },
    { op: 'sub', geometry: transfers(L, 0) },
    { op: 'sub', geometry: blockInlet(L, 0) },
  ]
  return csg(shell, ops)
}

/* ------------------------------ cooling passages ------------------------------ */

/** coolant transfer holes from the top of each liner's jacket, through the deck and gasket, into the head passage (engine frame) */
function transfers(L: EngineLayout, inset: number) {
  const y0 = CROWN_TDC - 0.0125
  const y1 = HEAD_Y + HEAD_PASSAGE.y0 + 0.002
  return each(L, (z) => merge(...[-1, 1].map((s) => xform(cylinder(0.0035 - inset, y1 - y0, 12), at(0, (y0 + y1) / 2, z + s * TRANSFER_R)))))
}
/** the water pump's way into cylinder 1's jacket, through the front wall of the block (engine frame) */
function blockInlet(L: EngineLayout, inset: number) {
  const z0 = L.front + TRANSFER_R - 0.002
  const z1 = inset ? L.lu / 2 - inset : L.lu / 2 + 0.01
  return xform(cylinder(BLOCK_INLET.r - inset, z1 - z0, 20), onZ(BLOCK_INLET.x, BLOCK_INLET.y, (z0 + z1) / 2))
}
/** transfer holes sit on the jacket's mid-radius, fore and aft of each bore */
const TRANSFER_R = (DIM.linerOuter + DIM.jacketOuter) / 2

/**
 * The head's cored water passage (head-local: deck at y = 0): one cavity along the head between the
 * deck and the top, round the ports, valve guides, injector and pushrod bosses, with the outlet
 * through the top at the front for the thermostat. `inset` shrinks it (the coolant inside it).
 */
function headPassage(L: EngineLayout, inset: number) {
  const P = HEAD_PASSAGE
  const x0 = HEAD_X0 + P.wall + inset
  const x1 = HEAD_X1 - P.wall - inset
  const cavity = xform(box(x1 - x0, P.y1 - P.y0 - 2 * inset, L.lu - 2 * P.wall - 2 * inset), at((x0 + x1) / 2, (P.y0 + P.y1) / 2, 0))
  const e = -inset
  const bosses = merge(
    each(L, (z) => xform(pipe(INLET_PORT, 0.0165 + P.boss + e, 0, 20, 12), at(0, 0, z))),
    each(L, (z) => xform(pipe(EXHAUST_PORT, 0.0145 + P.boss + e, 0, 20, 12), at(0, 0, z))),
    each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(0.011 + e, 0.2, 16), at(DIM.valveX, 0.05, z + dz))))),
    each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(0.0135 + e, 0.2, 16), at(PUSHROD_X, 0.05, z + dz))))),
    each(L, (z) => xform(cylinder(0.016 + e, 0.2, 16), injectorBore(z))),
  )
  // the outlet: through the top for the cut, flush with it for the coolant
  const oy0 = P.y1 - 0.002
  const oy1 = inset ? DIM.headHeight - inset : DIM.headHeight + 0.003
  const outlet = xform(cylinder(HEAD_OUTLET.r - inset, oy1 - oy0, 20), at(HEAD_OUTLET.x, (oy0 + oy1) / 2, L.front + HEAD_OUTLET.dz))
  return merge(csg(cavity, [{ op: 'sub', geometry: bosses }]), outlet)
}

/** injector bore placement in the head (head-local) */
function injectorBore(z: number) {
  return new THREE.Matrix4().compose(
    INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.08)).add(new THREE.Vector3(0, 0, z)),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), INJECTOR.dir),
    new THREE.Vector3(1, 1, 1),
  )
}

/** all the coolant in the engine: each liner's jacket, the transfer holes and the head passage (engine frame) */
function coolant(L: EngineLayout) {
  return merge(each(L, (z) => xform(jacketCoolant(), at(0, 0, z))), transfers(L, 0.0003), blockInlet(L, 0.0004), xform(headPassage(L, 0.0004), at(0, HEAD_Y, 0)))
}

function head(L: EngineLayout) {
  const H = DIM.headHeight
  const body = xform(box(HEAD_X1 - HEAD_X0, H, L.lu), at((HEAD_X0 + HEAD_X1) / 2, H / 2, 0))
  const seat = (r: number) => lathe([[0, -0.01], [r + 0.0005, -0.01], [r + 0.0005, 0.0008], [r - 0.004, 0.006], [0, 0.006]], 24)
  return csg(body, [
    { op: 'sub', geometry: headPassage(L, 0) },
    { op: 'sub', geometry: xform(transfers(L, 0), at(0, -HEAD_Y, 0)) },
    { op: 'sub', geometry: each(L, (z) => xform(pipe(INLET_PORT, 0.0165, 0, 20, 12), at(0, 0, z))) },
    { op: 'sub', geometry: each(L, (z) => xform(pipe(EXHAUST_PORT, 0.0145, 0, 20, 12), at(0, 0, z))) },
    { op: 'sub', geometry: each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(DIM.valveStemR + 0.0004, 0.2, 10), at(DIM.valveX, H / 2 + 0.03, z + dz))))) },
    { op: 'sub', geometry: each(L, (z) => merge(xform(seat(DIM.inletHeadR), at(DIM.valveX, 0, z + DIM.inletZ)), xform(seat(DIM.exhaustHeadR), at(DIM.valveX, 0, z + DIM.exhaustZ)))) },
    { op: 'sub', geometry: each(L, (z) => merge(...valveZ.map((dz) => xform(cylinder(0.0095, 0.3, 12), at(PUSHROD_X, H / 2, z + dz))))) },
    { op: 'sub', geometry: each(L, (z) => xform(cylinder(0.0095, 0.17, 14), injectorBore(z))) },
  ])
}

/** unit-height head gasket (scaled to the deck clearance), with fire rings and pushrod holes */
function gasket(L: EngineLayout) {
  const outline = roundedRect(HEAD_X1 - HEAD_X0, L.lu, 0.004, (HEAD_X0 + HEAD_X1) / 2, 0)
  // the shape's y becomes −z once laid flat
  for (const z of L.cylZ) {
    const bore = new THREE.Path()
    bore.absarc(0, -z, DIM.bore / 2 + 0.001, 0, PI * 2, true)
    outline.holes.push(bore)
    for (const dz of valveZ) {
      const h = new THREE.Path()
      h.absarc(PUSHROD_X, -(z + dz), 0.0095, 0, PI * 2, true)
      outline.holes.push(h)
    }
    for (const s of [-1, 1]) {
      const h = new THREE.Path()
      h.absarc(0, -(z + s * TRANSFER_R), 0.0035, 0, PI * 2, true)
      outline.holes.push(h)
    }
  }
  return xform(extrude(outline, 1, { curveSegments: 32 }), mat4.c(at(0, 0.5, 0), mat4.rx(-PI / 2)))
}

function rockerCover(L: EngineLayout) {
  const top = DIM.headHeight
  const h = 0.085
  const outer = xform(box(0.15, h, L.lu - 0.004), at(-0.04, top + h / 2, 0))
  const inner = xform(box(0.14, h, L.lu - 0.014), at(-0.04, top + h / 2 - 0.005, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function sump(L: EngineLayout) {
  const outer = xform(box(2 * CASE_X, 0.15, L.ll), at(0, SPLIT_Y - 0.075, 0))
  const inner = xform(box(2 * CASE_X - 0.012, 0.15, L.ll - 0.012), at(0, SPLIT_Y - 0.075 + 0.006, 0))
  return csg(outer, [{ op: 'sub', geometry: inner }])
}

function oil(L: EngineLayout) {
  return xform(box(2 * CASE_X - 0.0125, 0.05, L.ll - 0.0125), at(0, SPLIT_Y - 0.15 + 0.006 + 0.025 + 0.0002, 0))
}

/* ------------------------------ manifolds (head-local: deck at y = 0) ------------------------------ */

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const curve = (...pts: THREE.Vector3[]) => new THREE.CatmullRomCurve3(pts)

function inletManifold(L: EngineLayout) {
  const parts = L.cylZ.map((z) => pipe(curve(v(HEAD_X1 - 0.001, 0.064, z + DIM.inletZ + 0.01), v(0.115, 0.07, z + DIM.inletZ + 0.01), v(0.145, 0.085, z + 0.02)), 0.019, 0.016, 24, 20))
  parts.push(pipe(curve(v(0.15, 0.088, L.rear - 0.045), v(0.15, 0.088, L.front + 0.06)), 0.03, 0.026, 8, 28))
  // riser to the air cleaner at the front
  parts.push(pipe(curve(v(0.15, 0.088, L.front + 0.055), v(0.15, 0.13, L.front + 0.09), v(0.15, 0.24, L.front + 0.1)), 0.026, 0.022, 24, 24))
  return merge(...parts)
}

function exhaustManifold(L: EngineLayout) {
  const parts = L.cylZ.map((z) => pipe(curve(v(HEAD_X1 - 0.001, 0.042, z + DIM.exhaustZ - 0.01), v(0.12, 0.034, z + DIM.exhaustZ - 0.02), v(0.165, 0.005, z - 0.035)), 0.017, 0.014, 24, 20))
  parts.push(pipe(curve(v(0.17, 0.0, L.rear - 0.06), v(0.17, 0.0, L.front + 0.02)), 0.024, 0.02, 8, 24))
  // outlet: up past the manifold, towards the tractor's exhaust stack at the front
  parts.push(pipe(curve(v(0.17, 0.0, L.front + 0.015), v(0.2, 0.04, L.front + 0.06), v(0.215, 0.2, L.front + 0.07), v(0.215, 0.32, L.front + 0.07)), 0.022, 0.018, 32, 24))
  return merge(...parts)
}

/* ------------------------------ fuel ------------------------------ */

/** In-line injection pump on the side of the crankcase, engine-local. */
const PUMP = { x: 0.178, y: 0.175 }

function injectionPump(L: EngineLayout) {
  const body = xform(box(0.07, 0.09, (L.n - 1) * PITCH + 0.08), at(PUMP.x, PUMP.y, 0))
  const governor = xform(box(0.075, 0.11, 0.09), at(PUMP.x, PUMP.y + 0.01, L.rear - 0.11))
  const holders = each(L, (z) => xform(cylinder(0.009, 0.03, 16), at(PUMP.x, PUMP.y + 0.06, z)))
  return merge(body, governor, holders)
}

/** where each injector's fuel inlet sits, engine-local */
export function injectorTop(z: number) {
  return INJECTOR.tip.clone().add(INJECTOR.dir.clone().multiplyScalar(0.135)).add(v(0, HEAD_Y, z))
}

function hpPipes(L: EngineLayout) {
  return each(L, (z) => {
    const top = injectorTop(z)
    return pipe(curve(v(PUMP.x, PUMP.y + 0.074, z), v(PUMP.x + 0.01, HEAD_Y - 0.06, z + 0.012), v(0.2, HEAD_Y + 0.15, z + 0.012), v(top.x + 0.03, top.y + 0.02, z + 0.006), top), 0.0032, 0.0012, 48, 10)
  })
}

/* ------------------------------ crank & cam ------------------------------ */

/** a throw per cylinder on one shaft, pins placed so each cylinder reaches TDC at its firing angle */
function crankshaft(L: EngineLayout) {
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
  const throws = L.cylZ.map((z, i) => xform(throwG, mat4.c(at(0, 0, z), mat4.rz((-L.firing[i] * PI) / 180))))
  // main journals: front, between each pair of throws, and rear
  const mains = [xform(cylinder(0.03, 0.066, 40), onZ(0, 0, L.front + 0.062))]
  for (const z of L.mids) mains.push(xform(cylinder(0.03, PITCH - 0.058, 40), onZ(0, 0, z)))
  mains.push(xform(cylinder(0.03, 0.066, 40), onZ(0, 0, L.rear - 0.062)))
  const nose = xform(cylinder(0.02, 0.055, 32), onZ(0, 0, L.front + 0.12))
  const tail = xform(lathe([[0, 0], [0.04, 0], [0.04, 0.012], [0.03, 0.012], [0.03, 0.03], [0, 0.03]], 40), mat4.c(at(0, 0, L.rear - 0.095), mat4.rx(-PI / 2)))
  return merge(...throws, ...mains, nose, tail)
}

/** main-bearing shells in the bulkheads */
function mainBearings(L: EngineLayout) {
  const zs = [L.front + 0.062, ...L.mids, L.rear - 0.062]
  return merge(...zs.map((z) => xform(tube(0.0335, 0.0302, 0.03, 40), onZ(0, 0, z))))
}

/** lobes for every cylinder, each pre-turned by half its firing angle (the shaft turns at half speed) */
function camshaft(L: EngineLayout) {
  const shaft = xform(cylinder(0.0105, L.ll + 0.04, 24), onZ(0, 0, 0))
  const lobes = L.cylZ.map((z, i) =>
    merge(
      xform(cam(DIM.camBase, lobeLift('inlet'), 0.014), mat4.c(at(0, 0, z + DIM.inletZ), mat4.rz((L.firing[i] * PI) / 360))),
      xform(cam(DIM.camBase, lobeLift('exhaust'), 0.014), mat4.c(at(0, 0, z + DIM.exhaustZ), mat4.rz((L.firing[i] * PI) / 360))),
    ),
  )
  const jz = [L.front + 0.065, ...L.mids, L.rear - 0.065]
  const journals = merge(...jz.map((z) => xform(cylinder(0.0138, 0.016, 32), onZ(0, 0, z))))
  return { shaft, lobes: merge(...lobes), journals }
}

/* ------------------------------ valve gear (head-local) ------------------------------ */

function rockerGear(L: EngineLayout) {
  const shaft = xform(cylinder(0.0058, L.lu - 0.03, 24), onZ(DIM.rockerX, DIM.rockerY, 0))
  const pz = [L.front + PITCH / 2 - 0.01, ...L.mids, L.rear - PITCH / 2 + 0.01]
  const ped = rockerPedestal()
  const pedestals = merge(...pz.map((z) => xform(ped, at(DIM.rockerX, (DIM.headHeight + DIM.rockerY) / 2 - 0.004, z))))
  return { shaft, pedestals }
}

/* ------------------------------ all ------------------------------ */

/** Every part of the engine for one firing layout (default: the tractor's four, 1-3-4-2). */
export function buildStatic(args: { firing: number[] } = { firing: FIRING_4 }) {
  const L = engineLayout(args.firing)
  const rod = conRod()
  const inj = injector()
  const cs = camshaft(L)
  const rg = rockerGear(L)
  return {
    block: block(L),
    coolant: coolant(L),
    liner: liner(),
    mains: mainBearings(L),
    head: head(L),
    gasket: gasket(L),
    cover: rockerCover(L),
    sump: sump(L),
    oil: oil(L),
    inlet: inletManifold(L),
    exhaust: exhaustManifold(L),
    pump: injectionPump(L),
    hpPipes: hpPipes(L),
    injector: inj,
    /** for a spark-ignition engine: a plug in each injector bore */
    plug: sparkPlug({ seat: 0.012 }),
    crank: crankshaft(L),
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

export type EngineGeometry = ReturnType<typeof buildStatic>

const ready = new Map<string, EngineGeometry>()
const pending = new Map<string, Promise<EngineGeometry>>()
const keyOf = (firing: number[]) => firing.join(',')

/** Build one layout's geometry (in the worker) and keep it; safe to call often. */
export function prepareEngine(firing: number[] = FIRING_4) {
  const key = keyOf(firing)
  const hit = ready.get(key)
  if (hit) return Promise.resolve(hit)
  let p = pending.get(key)
  if (!p) {
    const args = { firing: [...firing] }
    p = import('@/geometry/build')
      .then(({ buildGeometry }) => buildGeometry('machines/engine', () => buildStatic(args), args))
      .then((g) => (ready.set(key, g), g))
    pending.set(key, p)
  }
  return p
}

/** the built geometry for a layout, if it is ready */
export const engineReady = (firing: number[] = FIRING_4) => ready.get(keyOf(firing)) ?? null
