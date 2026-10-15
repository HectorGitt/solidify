import * as THREE from 'three'
import { box, cam, csg, cylinder, gear, helixSpring, lathe, mat4, merge, pipe, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { torus } from '@/geometry/parts'
import { INJ, injectorHolder } from '@/parts/lib/engineFuel'
import { cylinderLiner, pistonAssembly } from '@/parts/lib/engine'
import { DIM, ELEMENT, ELEMENT_PHASE, ELEMENT_X, INJ_Y, LAYOUT } from './model'

const { PI } = Math
const alongX = mat4.rz(PI / 2)

/* ------------------------------ tank ------------------------------ */

function tankShell() {
  const t = LAYOUT.tank
  const w = t.x1 - t.x0
  const h = t.y1 - t.y0
  const cx = (t.x0 + t.x1) / 2
  const cy = (t.y0 + t.y1) / 2
  const wall = 0.003
  const outer = xform(box(w, h, 2 * t.z), mat4.t(cx, cy, 0))
  const inner = xform(box(w - 2 * wall, h - 2 * wall, 2 * t.z - 2 * wall), mat4.t(cx, cy, 0))
  const neck = xform(tube(0.026, 0.022, 0.03, 40), mat4.t(t.x0 + 0.09, t.y1 + 0.012, 0))
  const neckHole = xform(cylinder(0.022, 0.04, 40), mat4.t(t.x0 + 0.09, t.y1, 0))
  const outlet = xform(cylinder(0.008, 0.016, 24), mat4.t(t.x1 - 0.04, t.y0 - 0.006, 0))
  const outletHole = xform(cylinder(0.0035, 0.03, 16), mat4.t(t.x1 - 0.04, t.y0, 0))
  const ret = xform(cylinder(0.007, 0.014, 24), mat4.t(t.x0 + 0.2, t.y1 + 0.005, 0))
  const retHole = xform(cylinder(0.003, 0.03, 16), mat4.t(t.x0 + 0.2, t.y1, 0))
  return csg(outer, [
    { op: 'sub', geometry: inner },
    { op: 'add', geometry: neck },
    { op: 'sub', geometry: neckHole },
    { op: 'add', geometry: outlet },
    { op: 'sub', geometry: outletHole },
    { op: 'add', geometry: ret },
    { op: 'sub', geometry: retHole },
  ])
}

function tankFuel() {
  const t = LAYOUT.tank
  const w = t.x1 - t.x0 - 0.0066
  const h = (t.y1 - t.y0) * 0.62
  return xform(box(w, h, 2 * t.z - 0.0066), mat4.t((t.x0 + t.x1) / 2, t.y0 + 0.0033 + h / 2, 0))
}

function ventedCap() {
  // cap with a vent hole drilled through its top
  const cap = lathe([[0, 0], [0.03, 0], [0.03, 0.014], [0.012, 0.022], [0, 0.022]], 48)
  return csg(cap, [{ op: 'sub', geometry: xform(cylinder(0.0018, 0.06, 12), mat4.t(0.008, 0.01, 0)) }])
}

function tankStrainer() {
  // wire-gauze basket under the filler cap
  return lathe([[0.017, -0.06], [0.0205, -0.06], [0.0205, 0], [0.019, 0], [0.019, -0.058], [0.017, -0.058]], 40)
}

/* ------------------------------ sediment bowl (TB Fig 4.5b) ------------------------------ */

function bowlHead() {
  const y = LAYOUT.bowl.headY
  const body = lathe([[0, 0], [0.032, 0], [0.032, 0.026], [0.022, 0.03], [0, 0.03]], 48)
  const bosses = [-1, 1].map((s) => xform(cylinder(0.008, 0.026, 24), mat4.c(mat4.t(s * 0.036, 0.018, 0), alongX)))
  const ops: CsgOp[] = bosses.map((b) => ({ op: 'add' as const, geometry: b }))
  // inlet → centre down-pipe; outlet from the clean side under the cover
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0032, 0.05, 16), mat4.c(mat4.t(-0.03, 0.018, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0032, 0.024, 16), mat4.t(-0.012, 0.01, 0)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0032, 0.05, 16), mat4.c(mat4.t(0.03, 0.018, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0032, 0.024, 16), mat4.t(0.012, 0.01, 0)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0235, 0.012, 48), mat4.t(0, 0.002, 0)) })
  const g = csg(body, ops)
  return xform(g, mat4.t(LAYOUT.bowl.x, y, 0))
}

const BOWL_PROFILE_OUT: V2[] = [
  [0, -0.084],
  [0.012, -0.084],
  [0.022, -0.078],
  [0.026, -0.064],
  [0.026, -0.003],
]

function glassBowl() {
  const p: V2[] = [...BOWL_PROFILE_OUT, [0.0235, -0.003], [0.0235, -0.064], [0.0198, -0.075], [0.011, -0.0805], [0, -0.0805]]
  return xform(lathe(p, 56), mat4.t(LAYOUT.bowl.x, LAYOUT.bowl.headY, 0))
}

function bowlFuel() {
  const p: V2[] = [[0, -0.0765], [0.011, -0.0765], [0.0196, -0.0715], [0.0233, -0.062], [0.0233, -0.006], [0, -0.006]]
  return xform(lathe(p, 48), mat4.t(LAYOUT.bowl.x, LAYOUT.bowl.headY, 0))
}

function sediment() {
  const p: V2[] = [[0, -0.0803], [0.011, -0.0803], [0.0193, -0.0755], [0.0205, -0.0725], [0, -0.0725]]
  return xform(lathe(p, 40), mat4.t(LAYOUT.bowl.x, LAYOUT.bowl.headY, 0))
}

function bowlStrainer() {
  return xform(lathe([[0.004, -0.0085], [0.0232, -0.0085], [0.0232, -0.007], [0.004, -0.007]], 48), mat4.t(LAYOUT.bowl.x, LAYOUT.bowl.headY, 0))
}

function bowlGasket() {
  return xform(torus(0.0248, 0.0016, 10, 48), mat4.c(mat4.t(LAYOUT.bowl.x, LAYOUT.bowl.headY - 0.0016, 0), mat4.rx(PI / 2)))
}

function bail() {
  const x = LAYOUT.bowl.x
  const y = LAYOUT.bowl.headY
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(x - 0.033, y + 0.006, 0),
    new THREE.Vector3(x - 0.032, y - 0.04, 0),
    new THREE.Vector3(x - 0.02, y - 0.09, 0),
    new THREE.Vector3(x, y - 0.097, 0),
    new THREE.Vector3(x + 0.02, y - 0.09, 0),
    new THREE.Vector3(x + 0.032, y - 0.04, 0),
    new THREE.Vector3(x + 0.033, y + 0.006, 0),
  ])
  const wire = pipeSolid(path, 0.0014)
  const nut = xform(lathe([[0, 0], [0.007, 0], [0.007, 0.008], [0.004, 0.012], [0, 0.012]], 6), mat4.t(x, y - 0.1, 0))
  return { wire, nut }
}

/* ------------------------------ injection pump (TB §4.5.3) ------------------------------ */

const P = LAYOUT.pump

function pumpHousing() {
  const w = P.x1 - P.x0
  const outer = xform(box(w, P.y1 - P.y0, 2 * P.z), mat4.t(0, (P.y0 + P.y1) / 2, 0))
  const ops: CsgOp[] = []
  // cam chamber
  ops.push({ op: 'sub', geometry: xform(box(w - 0.014, 0.05, 2 * P.z - 0.012), mat4.t(0, 0.031, 0)) })
  // camshaft bearings through the end walls
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0105, w + 0.05, 32), mat4.c(mat4.t(0, LAYOUT.camY, 0), alongX)) })
  // rack bore along X
  ops.push({ op: 'sub', geometry: xform(box(w + 0.05, 0.0085, 0.0085), mat4.t(0, DIM.sleeveY, DIM.rackZ)) })
  // fuel gallery along X at port height, open at the feed-pump end
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0045, w, 24), mat4.c(mat4.t(0.012, DIM.portY, 0), alongX)) })
  for (const x of ELEMENT_X) {
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0128, 0.07, 40), mat4.t(x, 0.066, 0)) }) // tappet + spring + sleeve bore
    ops.push({ op: 'sub', geometry: xform(cylinder(DIM.barrelR + 0.0002, 0.08, 40), mat4.t(x, 0.13, 0)) }) // barrel bore
  }
  // inspection window on the rack side (shows sleeve pinions)
  return csg(outer, ops)
}

function galleryFuel() {
  const g = xform(cylinder(0.0044, P.x1 - P.x0 - 0.002, 24), mat4.c(mat4.t(0.011, DIM.portY, 0), alongX))
  return csg(
    g,
    ELEMENT_X.map((x) => ({ op: 'sub' as const, geometry: xform(cylinder(DIM.barrelR + 0.0012, 0.02, 32), mat4.t(x, DIM.portY, 0)) })),
  )
}

function barrel() {
  const y0 = 0.1
  const y1 = 0.142
  const r = DIM.barrelR
  const pr = ELEMENT.plungerD / 2 + 0.00002
  const body = lathe([[pr, y0], [r, y0], [r, y1 - 0.004], [r - 0.002, y1], [pr, y1]], 48)
  // inlet and spill ports, both in the x–y plane so the half section shows them
  const ports: CsgOp[] = [{ op: 'sub', geometry: xform(cylinder(DIM.portR, 0.03, 16), mat4.c(mat4.t(0, DIM.portY, 0), alongX)) }]
  // annular groove so the gallery reaches both ports
  ports.push({ op: 'sub', geometry: xform(tube(r + 0.001, r - 0.0012, 0.006, 48), mat4.t(0, DIM.portY, 0)) })
  return csg(body, ports)
}

/**
 * Plunger with its control helix. Local frame: axis +Y, bottom of the foot at y = 0. The helical
 * groove starts at the top on the vertical slot (local angle ψ = 0, facing +X) and descends
 * lead·ψ/2π as ψ grows, so turning the plunger by −θ (rack forward) puts a taller land under
 * the spill port.
 */
export function plungerGeometry() {
  const r = ELEMENT.plungerD / 2
  const L = DIM.plungerLen
  const body = lathe(
    [
      [0, 0],
      [0.006, 0],
      [0.006, 0.003],
      [r * 0.8, 0.0045],
      [r * 0.8, 0.012],
      [r, 0.013],
      [r, L],
      [0, L],
    ],
    48,
  )
  const ops: CsgOp[] = []
  // drive lug that engages the control-sleeve slot
  ops.push({ op: 'add', geometry: xform(box(0.016, 0.004, 0.003), mat4.t(0, 0.014, 0)) })
  const w = 0.0024
  const depth = 0.0014
  const n = 22
  const psiMax = ELEMENT.maxRotation + 0.25
  for (let k = 0; k <= n; k++) {
    const psi = -0.08 + (k / n) * (psiMax + 0.08)
    const d = Math.max(0, (ELEMENT.helixLead * psi) / (2 * PI))
    const arc = (r * (psiMax + 0.08)) / n
    const m = mat4.c(mat4.ry(psi), mat4.t(r + 0.0004 - depth / 2, L - d - w / 2, 0))
    ops.push({ op: 'sub', geometry: xform(box(depth + 0.0008, w, arc * 1.6), m) })
  }
  // vertical slot from the top into the groove
  ops.push({ op: 'sub', geometry: xform(box(depth + 0.0008, 0.004, 0.0016), mat4.t(r + 0.0004 - depth / 2, L - 0.002, 0)) })
  return csg(body, ops)
}

function tappet() {
  const R = DIM.tappetR
  const H = DIM.tappetH
  return lathe([[0, 0], [R, 0], [R, H], [0.0075, H], [0.0075, H - 0.004], [0, H - 0.004]], 40)
}

function controlSleeve() {
  const pr = ELEMENT.plungerD / 2 + 0.0003
  const sleeve = lathe([[pr, 0.072], [0.0068, 0.072], [0.0068, 0.1], [pr, 0.1]], 40)
  const slot = xform(box(0.03, 0.014, 0.0034), mat4.t(0, 0.079, 0))
  const pinion = xform(gear({ teeth: 18, module: 0.001, width: 0.006, bore: 0.0066 }), mat4.c(mat4.t(0, DIM.sleeveY, 0), mat4.rx(PI / 2)))
  return { sleeve: csg(sleeve, [{ op: 'sub', geometry: slot }]), pinion }
}

function rack() {
  const m = 0.001
  const L = P.x1 - P.x0 + 0.09
  const s = new THREE.Shape()
  const pitch = PI * m
  const nT = Math.floor(L / pitch)
  const x0 = -L / 2
  s.moveTo(x0, -0.006)
  s.lineTo(x0 + L, -0.006)
  s.lineTo(x0 + L, -m * 1.25)
  for (let i = nT - 1; i >= 0; i--) {
    const xc = x0 + (i + 0.5) * pitch
    s.lineTo(xc + pitch * 0.38, -m * 1.25)
    s.lineTo(xc + pitch * 0.2, m)
    s.lineTo(xc - pitch * 0.2, m)
    s.lineTo(xc - pitch * 0.38, -m * 1.25)
  }
  s.lineTo(x0, -m * 1.25)
  s.lineTo(x0, -0.006)
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false, curveSegments: 4 })
  g.translate(0, 0, -0.003)
  const bar = merge(xform(g, mat4.rx(PI / 2)))
  // teeth now face +Z; knob at the governor end
  const knob = xform(lathe([[0, 0], [0.006, 0], [0.006, 0.012], [0, 0.012]], 24), mat4.c(mat4.t(x0 - 0.012, 0, -0.003), alongX))
  return merge(bar, knob)
}

function deliveryHolder() {
  // screws into the housing above the barrel; carries the HP pipe nipple
  return lathe(
    [
      [0.0025, 0.142],
      [0.0105, 0.142],
      [0.0105, 0.162],
      [0.0085, 0.164],
      [0.0085, 0.176],
      [0.005, 0.176],
      [0.005, 0.186],
      [0.0025, 0.186],
      [0.0025, 0.16],
      [0.0055, 0.158],
      [0.0055, 0.148],
      [0.0025, 0.147],
    ],
    6,
  )
}

function deliveryValve() {
  // mushroom valve with its relief (retraction) collar
  return lathe([[0, 0.142], [0.0042, 0.142], [0.0042, 0.1465], [0.0028, 0.148], [0.0028, 0.15], [0, 0.15]], 32)
}

function camshaft() {
  const shaft = xform(cylinder(0.0085, 0.33, 32), mat4.c(mat4.t(0.015, 0, 0), alongX))
  const lift = (phi: number) => (ELEMENT.camLift / 2) * (1 - Math.cos(phi))
  const lobe = cam(DIM.camBase, lift, 0.012)
  // lobe i is turned by its firing phase, so element i lifts ELEMENT_PHASE[i] after element 1
  const lobes = ELEMENT_X.map((x, i) => xform(lobe, mat4.c(mat4.t(x, 0, 0), mat4.rx(ELEMENT_PHASE[i]), mat4.ry(PI / 2))))
  const ecc = xform(cylinder(0.012, 0.012, 32), mat4.c(mat4.t(LAYOUT.feed.x, 0.003, 0), alongX))
  const flange = xform(lathe([[0, 0], [0.03, 0], [0.03, 0.008], [0.012, 0.008], [0.012, 0.022], [0, 0.022]], 48), mat4.c(mat4.t(-0.15, 0, 0), mat4.rz(-PI / 2)))
  return { shaft, lobes: merge(...lobes), ecc, flange }
}

/* ------------------------------ feed (lift) pump on the pump end ------------------------------ */

const F = LAYOUT.feed

function feedPumpBody() {
  const base = xform(box(0.05, 0.05, 0.05), mat4.t(F.x, 0.026, 0))
  const barrelOut = xform(lathe([[0, 0.05], [0.014, 0.05], [0.014, 0.118], [0, 0.118]], 40), mat4.t(F.x, 0, 0))
  const ops: CsgOp[] = [
    { op: 'add', geometry: barrelOut },
    { op: 'sub', geometry: xform(box(0.04, 0.042, 0.04), mat4.t(F.x, 0.024, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.0085, 0.08, 32), mat4.c(mat4.t(F.x, LAYOUT.camY, 0), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0062, 0.07, 32), mat4.t(F.x, 0.08, 0)) },
    // suction and delivery ports with their valve pockets
    { op: 'sub', geometry: xform(cylinder(0.0028, 0.04, 16), mat4.c(mat4.t(F.x - 0.02, 0.1, 0), alongX)) },
    { op: 'sub', geometry: xform(cylinder(0.0028, 0.04, 16), mat4.c(mat4.t(F.x + 0.02, 0.1, 0), alongX)) },
  ]
  return csg(base, ops)
}

function feedPlunger() {
  return lathe([[0, 0], [0.0058, 0], [0.0058, 0.03], [0, 0.03]], 32)
}

function primer() {
  return lathe([[0, 0], [0.006, 0], [0.006, 0.02], [0.011, 0.022], [0.011, 0.032], [0, 0.034]], 32)
}

/* ------------------------------ filters ------------------------------ */

function filterHead(withOverflow: boolean) {
  const body = lathe([[0, 0], [0.046, 0], [0.046, 0.03], [0, 0.03]], 56)
  const ops: CsgOp[] = []
  ops.push({ op: 'add', geometry: xform(cylinder(0.009, 0.104, 24), mat4.c(mat4.t(0, 0.016, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0034, 0.05, 16), mat4.c(mat4.t(-0.032, 0.016, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0034, 0.018, 16), mat4.t(-0.024, 0.008, 0)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0034, 0.05, 16), mat4.c(mat4.t(0.032, 0.016, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0045, 0.03, 16), mat4.t(0, 0.008, 0)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.0034, 0.022, 16), mat4.c(mat4.t(0.011, 0.016, 0), alongX)) })
  if (withOverflow) {
    ops.push({ op: 'add', geometry: xform(lathe([[0, 0], [0.008, 0], [0.008, 0.026], [0, 0.026]], 32), mat4.t(0.024, 0.026, 0)) })
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0045, 0.03, 24), mat4.t(0.024, 0.04, 0)) })
    ops.push({ op: 'sub', geometry: xform(cylinder(0.002, 0.03, 16), mat4.t(0.024, 0.018, 0)) })
    ops.push({ op: 'sub', geometry: xform(cylinder(0.0022, 0.02, 16), mat4.c(mat4.t(0.03, 0.046, 0), alongX)) })
  }
  return csg(body, ops)
}

function filterBowl() {
  return lathe([[0, -0.172], [0.03, -0.172], [0.041, -0.165], [0.042, -0.002], [0.0395, -0.002], [0.0395, -0.163], [0.03, -0.169], [0, -0.169]], 56)
}

function filterElement() {
  // pleated paper element approximated by fine axial ribs on the outer face
  const base = lathe([[0.0155, -0.155], [0.032, -0.155], [0.032, -0.008], [0.0155, -0.008]], 72)
  const caps = merge(
    lathe([[0.006, -0.159], [0.034, -0.159], [0.034, -0.155], [0.006, -0.155]], 56),
    lathe([[0.0062, -0.008], [0.034, -0.008], [0.034, -0.004], [0.0062, -0.004]], 56),
  )
  const core = lathe([[0.0062, -0.155], [0.0155, -0.155], [0.0155, -0.008], [0.0062, -0.008]], 40)
  return { element: base, caps, core }
}

function filterFuel(water: boolean) {
  const yTop = -0.006
  if (water) {
    return {
      fuel: lathe([[0.0322, -0.142], [0.0393, -0.142], [0.0393, yTop], [0.0322, yTop]], 48),
      water: lathe([[0, -0.1688], [0.0298, -0.1688], [0.0392, -0.1625], [0.0393, -0.142], [0, -0.142]], 48),
    }
  }
  return { fuel: lathe([[0, -0.1688], [0.0298, -0.1688], [0.0392, -0.1625], [0.0393, yTop], [0.0322, yTop], [0.0322, -0.159], [0, -0.159]], 48), water: null }
}

/* ------------------------------ injector (TB Fig 4.9): shared library ------------------------------ */

export { INJ }

/* ------------------------------ head stub with piston ------------------------------ */

function headStub() {
  const I = LAYOUT.injector
  const body = xform(box(0.16, 0.085, 0.15), mat4.t(I.x, I.y + 0.045, 0))
  // injector bore: the nozzle shoulder (local y ≈ 0.0125) seats on the step; nozzle passes through
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(cylinder(0.0108, 0.2, 40), mat4.t(I.x, INJ_Y + 0.0125 + 0.1, 0)) },
    { op: 'sub', geometry: xform(cylinder(0.0048, 0.03, 24), mat4.t(I.x, I.y + 0.005, 0)) },
  ]
  return csg(body, ops)
}

function linerStub() {
  const I = LAYOUT.injector
  return cylinderLiner({ bore: 0.1, outer: 0.0662, y0: I.y + 0.0025 - 0.11, y1: I.y + 0.0025 })
}

/** The library piston (re-entrant bowl, rings, pin) with its crown 13 mm below the injector tip, near TDC. */
function pistonStub() {
  const I = LAYOUT.injector
  const comp = 0.062
  const p = pistonAssembly({ bore: 0.1, comp, skirt: 0.03 })
  const m = mat4.t(I.x, I.y - 0.013 - comp, 0)
  return { body: xform(p.body, m), rings: xform(merge(p.rings.compression, p.rings.oil!), m), pin: xform(p.pin, m) }
}

/* ------------------------------ helpers ------------------------------ */

function pipeSolid(curve: THREE.Curve<THREE.Vector3>, r: number) {
  return pipe(curve, r, 0, 64, 8)
}

/* ------------------------------ build all ------------------------------ */

export function buildStatic() {
  const cs = camshaft()
  const sl = controlSleeve()
  const fe = filterElement()
  const b = bail()
  const ff1 = filterFuel(true)
  const ff2 = filterFuel(false)
  const inj = injectorHolder()
  const pist = pistonStub()
  return {
    tankShell: tankShell(),
    tankFuel: tankFuel(),
    ventedCap: ventedCap(),
    tankStrainer: tankStrainer(),
    bowlHead: bowlHead(),
    glassBowl: glassBowl(),
    bowlFuel: bowlFuel(),
    sediment: sediment(),
    bowlStrainer: bowlStrainer(),
    bowlGasket: bowlGasket(),
    bail: b.wire,
    jamNut: b.nut,
    housing: pumpHousing(),
    gallery: galleryFuel(),
    barrel: barrel(),
    plunger: plungerGeometry(),
    tappet: tappet(),
    spring: helixSpring(0.0092, 0.0011, 1, 6),
    sleeve: sl.sleeve,
    pinion: sl.pinion,
    rack: rack(),
    holder: deliveryHolder(),
    dValve: deliveryValve(),
    camshaft: cs.shaft,
    camLobes: cs.lobes,
    eccentric: cs.ecc,
    flange: cs.flange,
    feedBody: feedPumpBody(),
    feedPlunger: feedPlunger(),
    feedSpring: helixSpring(0.0045, 0.0007, 1, 6),
    primer: primer(),
    headPrimary: filterHead(false),
    headSecondary: filterHead(true),
    filterBowl: filterBowl(),
    element: fe.element,
    elementCaps: fe.caps,
    elementCore: fe.core,
    fuelPrimary: ff1.fuel,
    waterPrimary: ff1.water!,
    fuelSecondary: ff2.fuel,
    overflowBall: lathe(
      Array.from({ length: 9 }, (_, i) => {
        const a = -PI / 2 + (i / 8) * PI
        return [0.0034 * Math.cos(a), 0.0034 * Math.sin(a)] as V2
      }),
      20,
    ),
    overflowSpring: helixSpring(0.0028, 0.0005, 1, 5),
    injBody: inj.body,
    needle: inj.needle,
    spindle: inj.spindle,
    injSpring: inj.spring,
    screw: inj.screw,
    headStub: headStub(),
    liner: linerStub(),
    piston: pist.body,
    pistonRings: pist.rings,
    pistonPin: pist.pin,
  }
}

export type StaticFuelGeometry = ReturnType<typeof buildStatic>

let ready: StaticFuelGeometry | null = null

/** Build (in the worker) and keep; 'low' priority is a background pre-build. */
export async function prepareFuelGeometry(priority: 'normal' | 'low' = 'normal') {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/diesel-fuel', buildStatic, undefined, priority)
  return ready
}

export function buildFuelGeometry(): StaticFuelGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

