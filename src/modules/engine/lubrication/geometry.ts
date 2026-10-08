import * as THREE from 'three'
import { box, cam, csg, cylinder, extrude, gear, helixSpring, lathe, mat4, merge, pipe, tube, xform, type CsgOp } from '@/geometry'
import { BREATHER, CAM, CYL_X, DECK, FILTER, GALLERY, GAUGE, MAIN_X, PISTON_COMP, PUMP, R, RELIEF, ROCKER, ROD, SUMP_OIL_Y } from './model'

const { PI } = Math
const alongX = mat4.rz(-PI / 2)
const at = (x: number, y: number, z = 0) => mat4.t(x, y, z)
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const path = (pts: THREE.Vector3[], t = 0.15) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)

const X0 = -0.335
const X1 = 0.3
const XM = (X0 + X1) / 2
const W = X1 - X0

/* ------------------------------ castings ------------------------------ */

function block() {
  const outer = xform(box(W, DECK + 0.04, 0.2), at(XM, (DECK - 0.04) / 2))
  const ops: CsgOp[] = []
  for (const x of CYL_X) ops.push({ op: 'sub', geometry: xform(cylinder(0.05, 0.3, 48), at(x, DECK - 0.1)) })
  ops.push({ op: 'sub', geometry: xform(box(W - 0.05, 0.17, 0.155), at(XM - 0.005, 0.035, 0.0075)) })
  for (const x of MAIN_X) ops.push({ op: 'add', geometry: xform(box(0.022, 0.17, 0.15), at(x, 0.035, 0.005)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.032, W + 0.1, 40), mat4.c(at(XM, 0), alongX)) })
  ops.push({ op: 'sub', geometry: xform(cylinder(0.024, W + 0.1, 32), mat4.c(at(XM, CAM.y, CAM.z), alongX)) })
  ops.push({ op: 'sub', geometry: xform(box(W - 0.05, 0.05, 0.05), at(XM - 0.005, CAM.y + 0.02, CAM.z)) })
  // pump drive-shaft passage
  ops.push({ op: 'sub', geometry: xform(cylinder(0.009, 0.3, 16), at(PUMP.x, 0, PUMP.z)) })
  return csg(outer, ops)
}

function head() {
  const h = xform(box(W, 0.085, 0.2), at(XM, DECK + 0.0475))
  return csg(h, [
    ...CYL_X.map((x) => ({ op: 'sub' as const, geometry: xform(cylinder(0.04, 0.02, 32), at(x, DECK + 0.005)) })),
    { op: 'sub', geometry: xform(cylinder(0.006, 0.2, 16), at(0.27, DECK + 0.05, ROCKER.z)) },
  ])
}

function rockerCover() {
  const y0 = DECK + 0.09
  const o = xform(box(W - 0.01, 0.075, 0.17), at(XM, y0 + 0.0375))
  const i = xform(box(W - 0.022, 0.075, 0.158), at(XM, y0 + 0.0315))
  return csg(o, [
    { op: 'sub', geometry: i },
    { op: 'add', geometry: xform(cylinder(0.012, 0.03, 24), at(0.2, y0 + 0.08, -0.05)) },
    { op: 'sub', geometry: xform(cylinder(0.008, 0.06, 24), at(0.2, y0 + 0.07, -0.05)) },
  ])
}

function sump() {
  const o = xform(box(W, 0.18, 0.2), at(XM, -0.13))
  const i = xform(box(W - 0.012, 0.18, 0.188), at(XM, -0.124))
  return csg(o, [{ op: 'sub', geometry: i }])
}

function sumpOil() {
  const h = SUMP_OIL_Y - (-0.214)
  return xform(box(W - 0.0125, h, 0.1875), at(XM, -0.214 + h / 2))
}

/* ------------------------------ moving parts ------------------------------ */

function crankshaft() {
  const parts: THREE.BufferGeometry[] = []
  for (const x of MAIN_X) parts.push(xform(cylinder(0.03, 0.028, 40), mat4.c(at(x, 0), alongX)))
  parts.push(xform(cylinder(0.025, 0.08, 32), mat4.c(at(X0 + 0.03, 0), alongX)))
  const web = new THREE.Shape()
  const cw = 0.072
  const a0 = PI / 2 + PI - 0.95
  const a1 = PI / 2 + PI + 0.95
  web.absarc(0, 0, cw, a0, a1, false)
  web.lineTo(0.032 * Math.cos(0.35), R + 0.032 * Math.sin(0.35))
  web.absarc(0, R, 0.032, 0.35, PI - 0.35, false)
  web.lineTo(cw * Math.cos(a0), cw * Math.sin(a0))
  const webG = xform(extrude(web, 0.016, { curveSegments: 24 }), mat4.ry(PI / 2))
  const throws = [0, PI, PI, 0]
  CYL_X.forEach((x, i) => {
    const rot = mat4.rx(throws[i])
    parts.push(xform(webG, mat4.c(at(x - 0.032, 0), rot)))
    parts.push(xform(webG, mat4.c(at(x + 0.032, 0), rot)))
    parts.push(xform(cylinder(0.027, 0.05, 32), mat4.c(rot, at(x, R), alongX)))
  })
  return merge(...parts)
}

/** Oil drillings inside the crankshaft (main journal → web → crank pin), crank-local, as fluid. */
function crankDrillings() {
  const parts: THREE.BufferGeometry[] = []
  const throws = [0, PI, PI, 0]
  CYL_X.forEach((x, i) => {
    const c = path([V(x - 0.06, 0, 0), V(x - 0.035, R * 0.45, 0), V(x, R, 0)], 0)
    parts.push(xform(pipe(c, 0.0035, 0, 16, 8), mat4.rx(throws[i])))
  })
  return merge(...parts)
}

/** Connecting rod along +Y from the big end (origin) to the small end (y = ROD); dipper below the cap. */
function conRod() {
  const big = xform(tube(0.042, 0.0272, 0.03, 40), alongX)
  const small = xform(tube(0.019, 0.0135, 0.03, 32), mat4.c(at(0, ROD), alongX))
  const shank = new THREE.Shape()
  shank.moveTo(-0.016, 0.03)
  shank.lineTo(0.016, 0.03)
  shank.lineTo(0.01, ROD - 0.016)
  shank.lineTo(-0.01, ROD - 0.016)
  shank.lineTo(-0.016, 0.03)
  const sh = xform(extrude(shank, 0.022), mat4.ry(PI / 2))
  const shells = xform(tube(0.0272, 0.0262, 0.028, 40), alongX)
  const dipper = merge(xform(box(0.012, 0.035, 0.012), at(0, -0.055, 0)), xform(box(0.02, 0.006, 0.02), at(0, -0.073, 0.004)))
  return { body: merge(big, small, sh), shells, dipper }
}

function piston() {
  const r = 0.0495
  const top = PISTON_COMP
  return lathe(
    [
      [0, top - 0.012],
      [0.04, top - 0.012],
      [r - 0.005, top - 0.02],
      [r - 0.005, -0.045],
      [r, -0.045],
      [r, top - 0.03],
      [r - 0.003, top - 0.03],
      [r - 0.003, top - 0.026],
      [r, top - 0.026],
      [r, top - 0.019],
      [r - 0.003, top - 0.019],
      [r - 0.003, top - 0.016],
      [r, top - 0.016],
      [r, top],
      [0, top],
    ],
    48,
  )
}

function camshaft() {
  const shaft = xform(cylinder(0.012, W - 0.03, 24), mat4.c(at(XM - 0.005, 0), alongX))
  const journals = merge(...MAIN_X.map((x) => xform(cylinder(0.021, 0.022, 32), mat4.c(at(x, 0), alongX))))
  const lobe = cam(0.016, (p) => 0.007 * Math.max(0, Math.cos(p / 1)) ** 3, 0.014)
  const lobes: THREE.BufferGeometry[] = []
  CYL_X.forEach((x, i) => {
    for (const [dx, ph] of [
      [-0.025, 0],
      [0.025, PI / 2],
    ] as const)
      lobes.push(xform(lobe, mat4.c(at(x + dx, 0), mat4.rx(ph + i * PI * 0.5), mat4.ry(PI / 2))))
  })
  const skew = xform(gear({ teeth: 14, module: 0.0028, width: 0.022, helixDeg: 45, bore: 0.012 }), mat4.c(at(PUMP.x, 0), mat4.ry(PI / 2)))
  const timing = xform(gear({ teeth: 40, module: 0.003, width: 0.018, bore: 0.012 }), mat4.c(at(X0 - 0.012, 0), mat4.ry(PI / 2)))
  return { shaft: merge(shaft, journals), lobes: merge(...lobes), gears: merge(skew, timing) }
}

/* ------------------------------ oil pump, relief valve, filter ------------------------------ */

function pumpBody() {
  const b = xform(box(0.105, 0.04, 0.07), at(PUMP.x + PUMP.idleDx / 2, PUMP.y, PUMP.z))
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(cylinder(0.0265, 0.03, 40), at(PUMP.x, PUMP.y, PUMP.z)) },
    { op: 'sub', geometry: xform(cylinder(0.0265, 0.03, 40), at(PUMP.x + PUMP.idleDx, PUMP.y, PUMP.z)) },
    { op: 'sub', geometry: xform(cylinder(0.009, 0.06, 16), at(PUMP.x, PUMP.y + 0.02, PUMP.z)) },
    { op: 'sub', geometry: xform(cylinder(0.006, 0.03, 16), at(PUMP.x + PUMP.idleDx / 2, PUMP.y - 0.02, PUMP.z + 0.02)) },
    { op: 'sub', geometry: xform(cylinder(0.006, 0.03, 16), at(PUMP.x + PUMP.idleDx / 2, PUMP.y + 0.02, PUMP.z - 0.02)) },
  ]
  return csg(b, ops)
}

function pumpGears() {
  const g = gear({ teeth: 11, module: 0.004, width: 0.028, bore: 0.004 })
  return xform(g, mat4.rx(PI / 2))
}

function pumpShaft() {
  return xform(cylinder(0.006, CAM.y - PUMP.y + 0.012, 16), at(0, (CAM.y + PUMP.y) / 2 - PUMP.y, 0))
}

function skewPinion() {
  return xform(gear({ teeth: 14, module: 0.0028, width: 0.022, helixDeg: 45, bore: 0.006 }), mat4.rx(PI / 2))
}

function strainer() {
  const gauze = lathe([[0.006, -0.008], [0.032, -0.008], [0.032, 0.008], [0.006, 0.008]], 40)
  const cap = lathe([[0.006, 0.008], [0.034, 0.008], [0.034, 0.011], [0.006, 0.011]], 40)
  return { gauze, cap }
}

/** Relief valve body (along Y), local origin at the valve seat. */
function reliefBody() {
  const body = lathe([[0.004, -0.012], [0.012, -0.012], [0.012, 0.04], [0.004, 0.04], [0.004, 0.036], [0.0085, 0.036], [0.0085, 0.0], [0.004, -0.002]], 32)
  return csg(body, [{ op: 'sub', geometry: xform(cylinder(0.004, 0.03, 16), mat4.c(at(0.012, 0.012), alongX)) }])
}

function filter() {
  const can = lathe([[0, -0.11], [0.04, -0.11], [0.044, -0.104], [0.044, 0.0], [0.0405, 0.0], [0.0405, -0.105], [0, -0.107]], 48)
  const head = lathe([[0.008, 0], [0.046, 0], [0.046, 0.022], [0.008, 0.022]], 48)
  const element = lathe([[0.012, -0.1], [0.033, -0.1], [0.033, -0.006], [0.012, -0.006]], 48)
  const oil = lathe([[0, -0.104], [0.0402, -0.104], [0.0402, -0.002], [0, -0.002]], 40)
  return { can, head: csg(head, [{ op: 'add', geometry: xform(box(0.03, 0.02, 0.06), at(0, 0.012, 0.045)) }]), element, oil }
}

/* ------------------------------ oil paths (shared by the oil-filled tubes and the flows) ------------------------------ */

export const PATHS = (() => {
  const gy = GALLERY.y
  const gz = GALLERY.z
  const inlet = path([V(PUMP.x + PUMP.idleDx / 2, -0.2, PUMP.z + 0.02), V(PUMP.x + PUMP.idleDx / 2, -0.17, PUMP.z + 0.02), V(PUMP.x + PUMP.idleDx / 2, PUMP.y - 0.012, PUMP.z + 0.02)])
  const pumpGears = path([V(PUMP.x + 0.022, PUMP.y, PUMP.z + 0.02), V(PUMP.x - 0.03, PUMP.y, PUMP.z), V(PUMP.x + 0.022, PUMP.y, PUMP.z - 0.02), V(PUMP.x + 0.074, PUMP.y, PUMP.z), V(PUMP.x + 0.022, PUMP.y, PUMP.z + 0.02)], 0.5)
  const delivery = path([V(PUMP.x + 0.022, PUMP.y + 0.012, PUMP.z - 0.02), V(PUMP.x + 0.022, -0.08, PUMP.z - 0.02), V(PUMP.x + 0.03, -0.06, -0.115), V(-0.24, -0.05, -0.16), V(FILTER.x - 0.035, 0.0, FILTER.z + 0.004), V(FILTER.x - 0.03, 0.012, FILTER.z)])
  const throughFilter = path([V(FILTER.x - 0.03, 0.012, FILTER.z), V(FILTER.x - 0.036, -0.01, FILTER.z), V(FILTER.x - 0.037, -0.11, FILTER.z), V(FILTER.x - 0.02, -0.115, FILTER.z), V(FILTER.x, -0.11, FILTER.z), V(FILTER.x, 0.0, FILTER.z), V(FILTER.x, 0.012, FILTER.z)], 0.05)
  const toGallery = path([V(FILTER.x, 0.012 + 0.0, FILTER.z), V(FILTER.x, gy, FILTER.z + 0.03), V(FILTER.x, gy, gz)])
  const gallery = path([V(FILTER.x, gy, gz), V(GALLERY.x0 + 0.02, gy, gz)], 0)
  const galleryRear = path([V(FILTER.x, gy, gz), V(GALLERY.x1, gy, gz)], 0)
  const mains = MAIN_X.map((x) => path([V(x, gy, gz), V(x, 0.022, -0.05), V(x, 0.0, -0.031)]))
  const cams = MAIN_X.map((x) => path([V(x, gy, gz), V(x, 0.06, gz + 0.002), V(x, CAM.y - 0.021, CAM.z)], 0))
  const riser = path([V(GALLERY.x1, gy, gz), V(GALLERY.x1, 0.2, gz), V(GALLERY.x1, DECK + 0.02, -0.05), V(GALLERY.x1, ROCKER.y, ROCKER.z)])
  const rockerShaft = path([V(GALLERY.x1, ROCKER.y, ROCKER.z), V(X0 + 0.04, ROCKER.y, ROCKER.z)], 0)
  const drains = CYL_X.map((x) => path([V(x + 0.03, ROCKER.y - 0.01, ROCKER.z), V(x + 0.03, DECK + 0.04, -0.07), V(x + 0.03, 0.2, -0.085), V(x + 0.03, 0.05, -0.09), V(x + 0.035, SUMP_OIL_Y + 0.005, -0.09)]))
  const gaugeLine = path([V(GALLERY.x0 + 0.02, gy, gz), V(GALLERY.x0 - 0.02, gy, gz), V(GAUGE.x + 0.02, 0.1, GAUGE.z - 0.02), V(GAUGE.x, GAUGE.y - 0.045, GAUGE.z - 0.01)])
  const reliefBranch = path([V(PUMP.x + 0.022, -0.1, PUMP.z - 0.02), V(RELIEF.x - 0.02, -0.112, RELIEF.z), V(RELIEF.x, -0.112, RELIEF.z), V(RELIEF.x, RELIEF.y - 0.004, RELIEF.z)])
  const spill = path([V(RELIEF.x, RELIEF.y + 0.004, RELIEF.z), V(RELIEF.x, RELIEF.y + 0.012, RELIEF.z), V(RELIEF.x + 0.016, RELIEF.y + 0.012, RELIEF.z), V(RELIEF.x + 0.03, RELIEF.y - 0.01, RELIEF.z), V(RELIEF.x + 0.035, SUMP_OIL_Y + 0.004, RELIEF.z)])
  const troughFeed = path([V(PUMP.x + 0.022, -0.08, PUMP.z - 0.02), V(-0.24, -0.095, -0.06), V(0.22, -0.095, -0.06)], 0.1)
  const breather = path([V(0.2, DECK + 0.19, -0.05), V(0.2, DECK + 0.23, -0.05), V(BREATHER.x - 0.03, DECK + 0.23, BREATHER.z), V(BREATHER.x, BREATHER.y + 0.03, BREATHER.z), V(BREATHER.x, BREATHER.y - 0.05, BREATHER.z), V(BREATHER.x, 0.12, BREATHER.z), V(BREATHER.x + 0.02, 0.05, BREATHER.z)])
  return { inlet, pumpGears, delivery, throughFilter, toGallery, gallery, galleryRear, mains, cams, riser, rockerShaft, drains, gaugeLine, reliefBranch, spill, troughFeed, breather }
})()

function oilTubes() {
  const P = PATHS
  const solid = (c: THREE.Curve<THREE.Vector3>, r = 0.0042) => pipe(c, r, 0, 48, 10)
  return {
    pressure: merge(solid(P.inlet), solid(P.delivery), solid(P.reliefBranch, 0.0035), solid(P.toGallery), solid(P.gallery, 0.006), solid(P.galleryRear, 0.006), ...P.mains.map((c) => solid(c, 0.0035)), ...P.cams.map((c) => solid(c, 0.003)), solid(P.riser, 0.0035), solid(P.gaugeLine, 0.003)),
    rockerOil: solid(P.rockerShaft, 0.006),
    troughFeed: solid(P.troughFeed, 0.004),
    breather: pipe(P.breather, 0.009, 0.0065, 64, 16),
  }
}

function rockerGear() {
  const shaft = xform(tube(0.0095, 0.0065, W - 0.06, 32), mat4.c(at(XM - 0.01, 0), alongX))
  const arms: THREE.BufferGeometry[] = []
  for (const x of CYL_X)
    for (const dx of [-0.025, 0.025]) {
      const s = new THREE.Shape()
      s.moveTo(-0.03, -0.004)
      s.lineTo(0.04, -0.006)
      s.lineTo(0.042, 0.004)
      s.lineTo(0, 0.012)
      s.lineTo(-0.03, 0.006)
      s.lineTo(-0.03, -0.004)
      arms.push(xform(extrude(s, 0.01), mat4.c(at(x + dx, 0, 0), mat4.ry(-PI / 2))))
    }
  const pedestals = merge(...[-0.24, 0, 0.24].map((x) => xform(box(0.016, 0.03, 0.02), at(x, -0.02, 0))))
  return { shaft, arms: merge(...arms), pedestals }
}

function troughs() {
  const parts: THREE.BufferGeometry[] = []
  const oil: THREE.BufferGeometry[] = []
  for (const x of CYL_X) {
    const t = xform(box(0.05, 0.022, 0.06), at(x, -0.12, 0))
    parts.push(csg(t, [{ op: 'sub', geometry: xform(box(0.044, 0.022, 0.054), at(x, -0.114, 0)) }]))
    oil.push(xform(box(0.0435, 0.012, 0.0535), at(x, -0.1215, 0)))
  }
  return { troughs: merge(...parts), oil: merge(...oil) }
}

function gauge() {
  const body = lathe([[0, -0.012], [0.045, -0.012], [0.047, 0.0], [0.045, 0.004], [0, 0.004]], 48)
  const face = lathe([[0, 0.0], [0.041, 0.0], [0.041, 0.0045], [0, 0.0045]], 48)
  const ticks = merge(
    ...Array.from({ length: 7 }, (_, i) => {
      const a = PI * 1.25 - (i / 6) * PI * 1.5
      return xform(box(0.002, 0.008, 0.001), mat4.c(at(0.033 * Math.cos(a), 0.033 * Math.sin(a), 0.005), mat4.rz(a - PI / 2)))
    }),
  )
  const needle = xform(box(0.0022, 0.032, 0.0015), at(0, 0.014, 0.0065))
  const R2 = mat4.rx(PI / 2)
  return { body: xform(body, R2), face: xform(face, R2), ticks, needle }
}

function breatherCan() {
  return lathe([[0, -0.04], [0.025, -0.04], [0.03, -0.03], [0.03, 0.03], [0.025, 0.04], [0, 0.04]], 40)
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const rod = conRod()
  const cs = camshaft()
  const st = strainer()
  const fl = filter()
  const tubes = oilTubes()
  const rk = rockerGear()
  const tr = troughs()
  const ga = gauge()
  return {
    block: block(),
    head: head(),
    rockerCover: rockerCover(),
    sump: sump(),
    sumpOil: sumpOil(),
    mainShells: merge(...MAIN_X.map((x) => xform(tube(0.0322, 0.0302, 0.024, 40), mat4.c(at(x, 0), alongX)))),
    camBearings: merge(...MAIN_X.map((x) => xform(tube(0.0235, 0.0212, 0.02, 32), mat4.c(at(x, CAM.y, CAM.z), alongX)))),
    crankshaft: crankshaft(),
    crankOil: crankDrillings(),
    rod: rod.body,
    rodShells: rod.shells,
    dipper: rod.dipper,
    piston: piston(),
    camshaft: cs.shaft,
    camLobes: cs.lobes,
    camGears: cs.gears,
    pumpBody: pumpBody(),
    pumpGear: pumpGears(),
    pumpShaft: pumpShaft(),
    skewPinion: skewPinion(),
    gauze: st.gauze,
    gauzeCap: st.cap,
    reliefBody: reliefBody(),
    reliefPlunger: lathe([[0, 0], [0.008, 0], [0.008, 0.008], [0.004, 0.012], [0, 0.012]], 24),
    reliefSpring: helixSpring(0.0055, 0.0008, 1, 6),
    filterCan: fl.can,
    filterHead: fl.head,
    filterElement: fl.element,
    filterOil: fl.oil,
    oilPressure: tubes.pressure,
    oilRocker: tubes.rockerOil,
    oilTroughFeed: tubes.troughFeed,
    breatherPipe: tubes.breather,
    breatherCan: breatherCan(),
    rockerShaft: rk.shaft,
    rockerArms: rk.arms,
    rockerPedestals: rk.pedestals,
    troughs: tr.troughs,
    troughOil: tr.oil,
    gaugeBody: ga.body,
    gaugeFace: ga.face,
    gaugeTicks: ga.ticks,
    gaugeNeedle: ga.needle,
  }
}

export type LubeGeometry = ReturnType<typeof buildStatic>

let ready: LubeGeometry | null = null

export async function prepareLubeGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/lubrication', buildStatic)
  return ready
}

export function buildLubeGeometry(): LubeGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
