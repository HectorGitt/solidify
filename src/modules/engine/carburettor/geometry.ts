import * as THREE from 'three'
import { box, csg, cylinder, extrude, helixSpring, lathe, mat4, merge, pipe, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { valve } from '@/parts/lib/engine'
import { FLOAT_ARM, L } from './model'

const { PI } = Math
const alongX = mat4.rz(PI / 2)
const alongZ = mat4.rx(PI / 2)
const at = (x: number, y: number, z = 0) => mat4.t(x, y, z)

/* ------------------------------ tank & sediment bowl ------------------------------ */

function tankShell() {
  const t = L.tank
  const cx = (t.x0 + t.x1) / 2
  const cy = (t.y0 + t.y1) / 2
  const w = t.x1 - t.x0
  const h = t.y1 - t.y0
  return csg(xform(box(w, h, 2 * t.z), at(cx, cy)), [
    { op: 'sub', geometry: xform(box(w - 0.006, h - 0.006, 2 * t.z - 0.006), at(cx, cy)) },
    { op: 'add', geometry: xform(tube(0.024, 0.02, 0.03, 40), at(t.x0 + 0.07, t.y1 + 0.012)) },
    { op: 'sub', geometry: xform(cylinder(0.02, 0.04, 40), at(t.x0 + 0.07, t.y1)) },
    { op: 'add', geometry: xform(cylinder(0.008, 0.016, 24), at(t.x1 - 0.04, t.y0 - 0.006)) },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.03, 16), at(t.x1 - 0.04, t.y0)) },
  ])
}

function tankFuel() {
  const t = L.tank
  const h = (t.y1 - t.y0) * 0.55
  return xform(box(t.x1 - t.x0 - 0.0066, h, 2 * t.z - 0.0066), at((t.x0 + t.x1) / 2, t.y0 + 0.0033 + h / 2))
}

function ventedCap() {
  const cap = lathe([[0, 0], [0.028, 0], [0.028, 0.012], [0.01, 0.02], [0, 0.02]], 40)
  return csg(cap, [{ op: 'sub', geometry: xform(cylinder(0.0016, 0.05, 12), at(0.008, 0.01)) }])
}

/** Fuel tap under the tank outlet. */
function tap() {
  const body = xform(box(0.02, 0.016, 0.016), at(0, 0))
  const lever = xform(box(0.004, 0.004, 0.03), at(0, 0, 0.022))
  return csg(body, [
    { op: 'add', geometry: lever },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.03, 16), at(0, 0)) },
  ])
}

function bowlParts() {
  const { x, y } = L.bowl
  const head = csg(lathe([[0, 0], [0.032, 0], [0.032, 0.026], [0.022, 0.03], [0, 0.03]], 48), [
    { op: 'add', geometry: xform(cylinder(0.008, 0.026, 24), mat4.c(at(-0.036, 0.018), alongX)) },
    { op: 'add', geometry: xform(cylinder(0.008, 0.026, 24), mat4.c(at(0.036, 0.018), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.05, 16), mat4.c(at(-0.03, 0.018), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.024, 16), at(-0.012, 0.01)) },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.05, 16), mat4.c(at(0.03, 0.018), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0032, 0.024, 16), at(0.012, 0.01)) },
    { op: 'sub', geometry: xform(cylinder(0.0235, 0.012, 48), at(0, 0.002)) },
  ])
  const glass = lathe([[0, -0.08], [0.012, -0.08], [0.022, -0.074], [0.026, -0.06], [0.026, -0.003], [0.0235, -0.003], [0.0235, -0.06], [0.0198, -0.071], [0.011, -0.0765], [0, -0.0765]], 56)
  const fuel = lathe([[0, -0.0725], [0.011, -0.0725], [0.0196, -0.0675], [0.0233, -0.058], [0.0233, -0.006], [0, -0.006]], 48)
  const sediment = lathe([[0, -0.0763], [0.011, -0.0763], [0.0193, -0.0715], [0.0205, -0.069], [0, -0.069]], 40)
  const gauze = lathe([[0.004, -0.0085], [0.0232, -0.0085], [0.0232, -0.007], [0.004, -0.007]], 48)
  const bail = pipe(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.033, 0.006, 0),
      new THREE.Vector3(-0.032, -0.04, 0),
      new THREE.Vector3(-0.02, -0.086, 0),
      new THREE.Vector3(0, -0.093, 0),
      new THREE.Vector3(0.02, -0.086, 0),
      new THREE.Vector3(0.032, -0.04, 0),
      new THREE.Vector3(0.033, 0.006, 0),
    ]),
    0.0014,
    0,
    64,
    8,
  )
  const m = at(x, y)
  return { head: xform(head, m), glass: xform(glass, m), fuel: xform(fuel, m), sediment: xform(sediment, m), gauze: xform(gauze, m), bail: xform(bail, m) }
}

/* ------------------------------ engine block stub & camshaft ------------------------------ */

function blockStub() {
  const outer = xform(box(0.16, 0.11, 0.1), at(0.01, -0.035))
  return csg(outer, [
    { op: 'sub', geometry: xform(box(0.1, 0.104, 0.07), at(0.012, -0.03)) },
    { op: 'sub', geometry: xform(cylinder(0.0085, 0.2, 24), mat4.c(at(L.cam.x, L.cam.y), alongZ)) },
  ])
}

function camshaft() {
  const shaft = xform(cylinder(0.008, 0.14, 24), alongZ)
  const ecc = xform(cylinder(L.eccR, 0.016, 40), mat4.c(at(0, L.ecc), alongZ))
  const lobe = xform(cylinder(0.0145, 0.012, 32), mat4.c(at(0, 0, 0.032), alongZ))
  return merge(shaft, ecc, lobe)
}

/* ------------------------------ diaphragm lift pump (TB Fig 4.6) ------------------------------ */

function pumpLower() {
  const shell = lathe(
    [
      [0, 0.03],
      [0.036, 0.03],
      [0.036, 0.094],
      [0.042, 0.094],
      [0.042, 0.1],
      [0.031, 0.1],
      [0.031, 0.035],
      [0, 0.035],
    ],
    48,
  )
  const ops: CsgOp[] = [
    { op: 'add', geometry: xform(box(0.08, 0.01, 0.06), at(-0.0, 0.025)) },
    // slot for the rocker arm to reach the eccentric
    { op: 'sub', geometry: xform(box(0.034, 0.03, 0.016), at(0.024, 0.03)) },
  ]
  return xform(csg(shell, ops), at(L.pumpX, 0))
}

function pumpUpper() {
  const y0 = L.diaphragmY + 0.001
  const body = lathe([[0, y0], [0.042, y0], [0.042, y0 + 0.006], [0.036, y0 + 0.008], [0.036, y0 + 0.034], [0, y0 + 0.034]], 48)
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(cylinder(0.03, 0.012, 48), at(0, y0)) },
    { op: 'add', geometry: xform(cylinder(0.006, 0.02, 20), mat4.c(at(-0.039, y0 + 0.025), alongX)) },
    { op: 'add', geometry: xform(cylinder(0.006, 0.02, 20), mat4.c(at(0.039, y0 + 0.025), alongX)) },
  ]
  for (const dx of [-0.015, 0.015]) ops.push({ op: 'sub', geometry: xform(cylinder(0.007, 0.024, 24), at(dx, y0 + 0.016)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0028, 0.04, 16), mat4.c(at(-0.032, y0 + 0.025), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0028, 0.04, 16), mat4.c(at(0.032, y0 + 0.025), alongX)) })
  return xform(csg(body, ops), at(L.pumpX, 0))
}

function pumpCover() {
  return xform(lathe([[0, 0], [0.037, 0], [0.037, 0.004], [0.03, 0.012], [0, 0.014]], 48), at(L.pumpX, L.diaphragmY + 0.035))
}

function diaphragm() {
  return xform(lathe([[0.013, 0], [0.042, 0], [0.042, 0.001], [0.013, 0.001]], 48), at(L.pumpX, L.diaphragmY))
}

/** Centre plates + pull rod, local: plates centred on y = 0 (diaphragm level). */
function diaphragmPlates() {
  const plates = lathe([[0, -0.003], [0.015, -0.003], [0.015, 0.004], [0, 0.004]], 40)
  const rod = xform(cylinder(0.0025, 0.055, 16), at(0, -0.03))
  const eye = xform(tube(0.005, 0.0025, 0.008, 20), mat4.c(at(0, -0.057), alongZ))
  return merge(plates, rod, eye)
}

/** Rocker arm in XY about its pivot: pad on the eccentric, hook on the pull rod. */
function rockerArm() {
  const E = new THREE.Vector2(L.cam.x - L.pivot.x, L.cam.y + L.eccR - L.pivot.y)
  const Lk = new THREE.Vector2(L.pumpX - L.pivot.x, 0)
  const s = new THREE.Shape()
  s.moveTo(Lk.x - 0.004, 0.004)
  s.lineTo(Lk.x - 0.004, -0.004)
  s.lineTo(-0.004, -0.006)
  s.lineTo(E.x - 0.008, E.y + 0.002)
  s.lineTo(E.x - 0.006, E.y)
  s.lineTo(E.x + 0.008, E.y)
  s.lineTo(E.x + 0.008, E.y + 0.006)
  s.lineTo(0.006, 0.002)
  s.lineTo(0.0, 0.007)
  s.lineTo(Lk.x - 0.004, 0.004)
  const hole = new THREE.Path()
  hole.absarc(0, 0, 0.0026, 0, PI * 2, true)
  s.holes.push(hole)
  return extrude(s, 0.01, { curveSegments: 12 })
}

function primingLever() {
  const s = new THREE.Shape()
  s.moveTo(0, -0.003)
  s.lineTo(-0.035, -0.002)
  s.lineTo(-0.035, 0.003)
  s.lineTo(0, 0.004)
  return merge(extrude(s, 0.004), xform(cylinder(0.004, 0.008, 16), alongZ))
}

/* ------------------------------ downdraught carburettor (TB Fig 4.7) ------------------------------ */

/** Air passage of the barrel (r, y): air horn, choke, venturi (throat at L.throatY), throttle. */
export const BORE: V2[] = [
  [0, 0.05],
  [0.016, 0.05],
  [0.016, 0.105],
  [0.0135, 0.128],
  [0.012, 0.142],
  [0.0128, 0.152],
  [0.016, 0.18],
  [0.016, 0.215],
  [0.022, 0.236],
  [0, 0.236],
]

function carbBody() {
  const X = L.barrelX
  const CX = L.chamberX
  const barrel = xform(lathe([[0, 0.058], [0.036, 0.058], [0.036, 0.066], [0.024, 0.068], [0.024, 0.222], [0.027, 0.23], [0, 0.23]], 48), at(X, 0))
  const ops: CsgOp[] = [
    { op: 'add', geometry: xform(cylinder(0.03, 0.078, 48), at(CX, 0.131)) },
    { op: 'add', geometry: xform(box(0.06, 0.078, 0.04), at((CX + X) / 2, 0.131)) },
    { op: 'sub', geometry: xform(lathe(BORE, 48), at(X, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.026, 0.07, 48), at(CX, L.floorY + 0.035)) },
    // main jet hole → channel → well → nozzle bore
    { op: 'sub', geometry: xform(cylinder(0.0018, 0.014, 16), at(CX, 0.11)) },
    { op: 'sub', geometry: xform(cylinder(0.0018, 0.04, 16), mat4.c(at(CX + 0.019, 0.106), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0025, 0.04, 16), at(0.274, 0.124)) },
    { op: 'sub', geometry: xform(cylinder(0.0018, 0.02, 16), mat4.c(at(0.283, L.throatY), alongX)) },
    // idle (slow-running) circuit to the port just below the throttle
    { op: 'sub', geometry: xform(cylinder(0.0012, 0.018, 12), at(0.252, 0.108)) },
    { op: 'sub', geometry: xform(cylinder(0.0012, 0.03, 12), mat4.c(at(0.266, 0.1), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0012, 0.024, 12), at(0.28, 0.089)) },
    { op: 'sub', geometry: xform(cylinder(0.0012, 0.012, 12), mat4.c(at(0.285, 0.0785), alongX)) },
    // butterfly spindles
    { op: 'sub', geometry: xform(cylinder(0.0026, 0.08, 16), mat4.c(at(X, L.throttleY), alongZ)) },
    { op: 'sub', geometry: xform(cylinder(0.0026, 0.08, 16), mat4.c(at(X, L.chokeY), alongZ)) },
  ]
  return csg(barrel, ops)
}

function chamberCover() {
  const CX = L.chamberX
  const cover = xform(lathe([[0, 0.17], [0.03, 0.17], [0.03, 0.18], [0, 0.18]], 48), at(CX, 0))
  return csg(cover, [
    { op: 'add', geometry: xform(cylinder(0.006, 0.026, 20), mat4.c(at(CX - 0.037, 0.175), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0016, 0.05, 12), mat4.c(at(CX - 0.025, 0.175), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0018, 0.012, 16), at(CX, 0.171)) },
    { op: 'sub', geometry: xform(cylinder(0.0012, 0.03, 12), at(CX + 0.016, 0.175)) },
  ])
}

function butterfly() {
  const disc = cylinder(0.0157, 0.0015, 48)
  const spindle = xform(cylinder(0.0025, 0.07, 16), alongZ)
  const arm = xform(box(0.004, 0.022, 0.003), at(0, 0.009, 0.037))
  return { disc, spindle: merge(spindle, arm) }
}

function needleValve() {
  return lathe([[0, 0], [0.0015, 0], [0.0015, 0.013], [0.0006, 0.0165], [0, 0.017]], 20)
}

/** Float, lever and needle tab in the lever frame (pivot at the origin). */
function floatAssembly() {
  const f = FLOAT_ARM
  const fl = xform(lathe([[0, -0.008], [0.011, -0.008], [0.013, -0.006], [0.013, 0.006], [0.011, 0.008], [0, 0.008]], 40), at(f.cx, f.cy))
  const lever = new THREE.Shape()
  lever.moveTo(0.003, 0.0)
  lever.lineTo(f.tabX - 0.003, -0.006)
  lever.lineTo(f.cx + 0.003, f.cy + 0.008)
  lever.lineTo(f.cx - 0.002, f.cy + 0.008)
  lever.lineTo(f.tabX - 0.004, -0.0095)
  lever.lineTo(0.003, -0.004)
  lever.lineTo(0.003, 0.0)
  const leverG = extrude(lever, 0.004)
  const tab = xform(box(0.006, 0.0015, 0.006), at(f.tabX, f.tabY - 0.00075))
  const hinge = xform(tube(0.0028, 0.0013, 0.012, 16), alongZ)
  return { float: fl, lever: merge(leverG, tab, hinge) }
}

function mainJet() {
  return lathe([[0.0005, 0.104], [0.0019, 0.104], [0.0019, 0.115], [0.0005, 0.115]], 24)
}

function nozzle() {
  return xform(tube(0.0016, 0.0008, 0.017, 20), mat4.c(at(0.2915, L.throatY), alongX))
}

/* ------------------------------ manifold & head stub ------------------------------ */

export const MANIFOLD = new THREE.CatmullRomCurve3(
  [new THREE.Vector3(L.barrelX, 0.06, 0), new THREE.Vector3(L.barrelX, 0.02, 0), new THREE.Vector3(L.barrelX + 0.025, -0.03, 0), new THREE.Vector3(L.barrelX + 0.09, -0.045, 0), new THREE.Vector3(L.barrelX + 0.15, -0.045, 0)],
  false,
  'catmullrom',
  0.3,
)

function headStub() {
  const x0 = L.barrelX + 0.15
  const body = xform(box(0.12, 0.1, 0.1), at(x0 + 0.06, -0.05))
  return csg(body, [
    { op: 'sub', geometry: xform(cylinder(0.016, 0.06, 32), mat4.c(at(x0 + 0.02, -0.045), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.016, 0.07, 32), at(x0 + 0.05, -0.07)) },
  ])
}

function inletValve() {
  return valve({ headR: 0.017, stemR: 0.004, length: 0.06 })
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const b = bowlParts()
  const bf = butterfly()
  const fa = floatAssembly()
  return {
    tankShell: tankShell(),
    tankFuel: tankFuel(),
    ventedCap: ventedCap(),
    tap: tap(),
    bowlHead: b.head,
    bowlGlass: b.glass,
    bowlFuel: b.fuel,
    sediment: b.sediment,
    gauze: b.gauze,
    bail: b.bail,
    block: blockStub(),
    camshaft: camshaft(),
    pumpLower: pumpLower(),
    pumpUpper: pumpUpper(),
    pumpCover: pumpCover(),
    diaphragm: diaphragm(),
    plates: diaphragmPlates(),
    pumpSpring: helixSpring(0.011, 0.0012, 1, 6),
    valveDisc: lathe([[0, 0], [0.0065, 0], [0.0065, 0.0015], [0, 0.0015]], 24),
    valveSpring: helixSpring(0.0035, 0.0005, 1, 4),
    rocker: rockerArm(),
    pin: xform(cylinder(0.0025, 0.066, 16), alongZ),
    primingLever: primingLever(),
    body: carbBody(),
    cover: chamberCover(),
    disc: bf.disc,
    spindle: bf.spindle,
    needle: needleValve(),
    float: fa.float,
    lever: fa.lever,
    jet: mainJet(),
    nozzle: nozzle(),
    chamberFuel: lathe([[0, 0], [0.0258, 0], [0.0258, 1], [0, 1]], 40),
    manifold: pipe(MANIFOLD, 0.02, 0.016, 48, 24),
    head: headStub(),
    inletValve: inletValve(),
  }
}

export type CarbGeometry = ReturnType<typeof buildStatic>

let ready: CarbGeometry | null = null

export async function prepareCarbGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/carburettor', buildStatic)
  return ready
}

export function buildCarbGeometry(): CarbGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
