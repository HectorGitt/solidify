import * as THREE from 'three'
import { box, csg, cylinder, gear, helixSpring, lathe, mat4, merge, pipe, xform, type CsgOp } from '@/geometry'
import { FIRING_4, PITCH, engineLayout } from '@/machines/layout'
import { BREATHER, CAM, CAM_JX, CYL_X, DECK, FILTER, GALLERY, GAUGE, MAIN_X, PUMP, R, RELIEF, ROCKER, SUMP_OIL_Y, TROUGH } from './model'

/**
 * The oil system laid over the shared engine (worker-safe: no React, no DOM): pump and strainer,
 * relief valve, full-flow filter, the gallery and every drilled oilway, crankshaft drillings, splash
 * troughs and dippers, gauge and breather. Scene frame (see model.ts) except where marked.
 */

const { PI } = Math
const alongX = mat4.rz(-PI / 2)
const at = (x: number, y: number, z = 0) => mat4.t(x, y, z)
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
const path = (pts: THREE.Vector3[], t = 0.15) => new THREE.CatmullRomCurve3(pts, false, 'catmullrom', t)

/** the pump's two gear centres (drive on the cam shaft line, idler beside it towards −z) and the mesh line between them */
const DRIVE_Z = PUMP.z
const IDLE_Z = PUMP.z - PUMP.idleDz
const MESH_Z = (DRIVE_Z + IDLE_Z) / 2
/** inlet and outlet ports either side of the mesh, along the crank */
const IN_X = PUMP.x - 0.02
const OUT_X = PUMP.x + 0.02
/** crossed helical (skew) gears between camshaft and pump shaft, sized to their 38 mm centre distance */
const SKEW = { teeth: 14, module: 0.0019, width: 0.02, helixDeg: 45 }
/** where the skew gear sits on the camshaft (engine-frame z: between cylinder 1's lobes and the front journal) */
export const SKEW_Z = 0.245

/* ------------------------------ moving parts (engine frame) ------------------------------ */

/** Oil drillings inside the crankshaft (main journal → web → crank pin), engine frame, as fluid. */
export const CRANK_DRILLINGS = (() => {
  const E = engineLayout(FIRING_4)
  return E.cylZ.map((z, i) => {
    const f = (FIRING_4[i] * PI) / 180
    const s = Math.sin(f)
    const c = Math.cos(f)
    return path([V(0, 0, z + PITCH / 2), V(0.45 * R * s, 0.45 * R * c, z + 0.035), V(R * s, R * c, z)], 0)
  })
})()

/** dipper (scoop) under a big-end cap, rod frame: big-end centre at the origin, cap bottom at y = −0.043 */
function dipper() {
  return merge(xform(box(0.01, 0.014, 0.01), at(0, -0.049, 0)), xform(box(0.018, 0.004, 0.018), at(0, -0.056, 0.003)))
}

/** skew gear on the camshaft (camshaft frame: axis along Z) */
function camSkewGear() {
  return xform(gear({ ...SKEW, bore: 0.012 }), mat4.t(0, 0, SKEW_Z))
}

/* ------------------------------ oil pump, relief valve, filter ------------------------------ */

function pumpBody() {
  const b = xform(box(0.06, 0.04, PUMP.idleDz + 0.062), at(PUMP.x, PUMP.y, MESH_Z))
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(cylinder(0.0265, 0.03, 40), at(PUMP.x, PUMP.y, DRIVE_Z)) },
    { op: 'sub', geometry: xform(cylinder(0.0265, 0.03, 40), at(PUMP.x, PUMP.y, IDLE_Z)) },
    { op: 'sub', geometry: xform(cylinder(0.009, 0.06, 16), at(PUMP.x, PUMP.y + 0.02, DRIVE_Z)) },
    { op: 'sub', geometry: xform(cylinder(0.006, 0.03, 16), at(IN_X, PUMP.y - 0.02, MESH_Z)) },
    { op: 'sub', geometry: xform(cylinder(0.006, 0.03, 16), at(OUT_X, PUMP.y + 0.02, MESH_Z)) },
  ]
  return csg(b, ops)
}

function pumpGears() {
  return xform(gear({ teeth: 11, module: 0.004, width: 0.028, bore: 0.004 }), mat4.rx(PI / 2))
}

function pumpShaft() {
  return xform(cylinder(0.006, CAM.y - PUMP.y + 0.012, 16), at(0, (CAM.y + PUMP.y) / 2 - PUMP.y, 0))
}

function skewPinion() {
  return xform(gear({ ...SKEW, bore: 0.006 }), mat4.rx(PI / 2))
}

function strainer() {
  const gauze = lathe([[0.006, -0.008], [0.03, -0.008], [0.03, 0.008], [0.006, 0.008]], 40)
  const cap = lathe([[0.006, 0.008], [0.032, 0.008], [0.032, 0.011], [0.006, 0.011]], 40)
  return { gauze, cap }
}
/** strainer centre, under the pump inlet */
export const STRAINER = { x: PUMP.x, y: -0.16, z: MESH_Z }

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
  // the head's mounting pad reaches back to the crankcase wall
  return { can, head: csg(head, [{ op: 'add', geometry: xform(box(0.03, 0.02, 0.06), at(0, 0.012, 0.045)) }]), element, oil }
}

/* ------------------------------ oil paths (shared by the oil-filled tubes and the flows) ------------------------------ */

export const PATHS = (() => {
  const gy = GALLERY.y
  const gz = GALLERY.z
  const inlet = path([V(STRAINER.x, STRAINER.y, STRAINER.z), V(IN_X, STRAINER.y + 0.005, MESH_Z), V(IN_X, PUMP.y - 0.012, MESH_Z)])
  // round the outside of each gear, inlet side (−x) to outlet side (+x)
  const pumpGears = path([V(IN_X, PUMP.y, MESH_Z), V(PUMP.x, PUMP.y, DRIVE_Z + 0.03), V(OUT_X, PUMP.y, MESH_Z), V(PUMP.x, PUMP.y, IDLE_Z - 0.03), V(IN_X, PUMP.y, MESH_Z)], 0.5)
  const delivery = path([V(OUT_X, PUMP.y + 0.012, MESH_Z), V(OUT_X, PUMP.y + 0.024, -0.1), V(OUT_X + 0.01, -0.07, -0.122), V(FILTER.x - 0.07, -0.04, -0.16), V(FILTER.x - 0.035, 0.0, FILTER.z + 0.004), V(FILTER.x - 0.03, 0.012, FILTER.z)])
  const throughFilter = path([V(FILTER.x - 0.03, 0.012, FILTER.z), V(FILTER.x - 0.036, -0.01, FILTER.z), V(FILTER.x - 0.037, -0.11, FILTER.z), V(FILTER.x - 0.02, -0.115, FILTER.z), V(FILTER.x, -0.11, FILTER.z), V(FILTER.x, 0.0, FILTER.z), V(FILTER.x, 0.012, FILTER.z)], 0.05)
  const toGallery = path([V(FILTER.x, 0.012, FILTER.z), V(FILTER.x, gy, FILTER.z + 0.03), V(FILTER.x, gy, gz)])
  const gallery = path([V(FILTER.x, gy, gz), V(GALLERY.x0 + 0.02, gy, gz)], 0)
  const galleryRear = path([V(FILTER.x, gy, gz), V(GALLERY.x1, gy, gz)], 0)
  const mains = MAIN_X.map((x) => path([V(x, gy, gz), V(x, 0.022, -0.06), V(x, 0.0, -0.031)]))
  const cams = CAM_JX.map((x) => path([V(x, gy, gz), V(x, 0.06, CAM.z - 0.012), V(x, CAM.y - 0.014, CAM.z)], 0))
  const riser = path([V(GALLERY.x1, gy, gz), V(GALLERY.x1, 0.12, gz), V(GALLERY.x1, 0.2, -0.098), V(GALLERY.x1, DECK + 0.02, -0.08), V(GALLERY.x1, ROCKER.y, ROCKER.z)])
  const rockerShaft = path([V(GALLERY.x1, ROCKER.y, ROCKER.z), V(-GALLERY.x1, ROCKER.y, ROCKER.z)], 0)
  // back to the sump down beside each exhaust pushrod
  const drains = CYL_X.map((cx) => {
    const x = cx + 0.024
    return path([V(x, ROCKER.y - 0.02, -0.07), V(x, DECK + 0.03, -0.078), V(x, CAM.y + 0.06, -0.078), V(x, CAM.y + 0.02, -0.1), V(x, 0.0, -0.11), V(x, SUMP_OIL_Y + 0.005, -0.11)])
  })
  const gaugeLine = path([V(GALLERY.x0 + 0.02, gy, gz), V(GALLERY.x0 - 0.02, gy, gz), V(GAUGE.x + 0.02, 0.1, GAUGE.z - 0.02), V(GAUGE.x, GAUGE.y - 0.045, GAUGE.z - 0.01)])
  const reliefBranch = path([V(OUT_X, PUMP.y + 0.024, -0.095), V(RELIEF.x - 0.01, RELIEF.y - 0.02, RELIEF.z), V(RELIEF.x, RELIEF.y - 0.004, RELIEF.z)])
  const spill = path([V(RELIEF.x, RELIEF.y + 0.004, RELIEF.z), V(RELIEF.x, RELIEF.y + 0.012, RELIEF.z), V(RELIEF.x + 0.016, RELIEF.y + 0.012, RELIEF.z), V(RELIEF.x + 0.03, RELIEF.y - 0.01, RELIEF.z), V(RELIEF.x + 0.035, SUMP_OIL_Y + 0.004, RELIEF.z)])
  const troughFeed = path([V(OUT_X, PUMP.y + 0.02, MESH_Z), V(PUMP.x + 0.04, TROUGH.y - 0.014, -0.045), V(CYL_X[3] + 0.03, TROUGH.y - 0.014, -0.045)], 0.1)
  const coverTop = DECK + 0.18
  const breather = path([V(0.2, coverTop - 0.005, -0.04), V(0.2, coverTop + 0.04, -0.04), V(BREATHER.x - 0.03, coverTop + 0.04, BREATHER.z), V(BREATHER.x, BREATHER.y + 0.03, BREATHER.z), V(BREATHER.x, BREATHER.y - 0.05, BREATHER.z), V(BREATHER.x, 0.12, BREATHER.z), V(BREATHER.x + 0.02, 0.05, BREATHER.z)])
  return { inlet, pumpGears, delivery, throughFilter, toGallery, gallery, galleryRear, mains, cams, riser, rockerShaft, drains, gaugeLine, reliefBranch, spill, troughFeed, breather }
})()

function oilTubes() {
  const P = PATHS
  const solid = (c: THREE.Curve<THREE.Vector3>, r = 0.0042) => pipe(c, r, 0, 48, 10)
  return {
    pressure: merge(solid(P.inlet), solid(P.delivery), solid(P.reliefBranch, 0.0035), solid(P.toGallery), solid(P.gallery, 0.006), solid(P.galleryRear, 0.006), ...P.mains.map((c) => solid(c, 0.0035)), ...P.cams.map((c) => solid(c, 0.003)), solid(P.riser, 0.0035), solid(P.gaugeLine, 0.003)),
    // inside the hollow rocker shaft
    rockerOil: solid(P.rockerShaft, 0.0045),
    troughFeed: solid(P.troughFeed, 0.004),
    breather: pipe(P.breather, 0.009, 0.0065, 64, 16),
    crankOil: merge(...CRANK_DRILLINGS.map((c) => pipe(c, 0.0035, 0, 16, 8))),
  }
}

function troughs() {
  const parts: THREE.BufferGeometry[] = []
  const oil: THREE.BufferGeometry[] = []
  const { y, h, w, d } = TROUGH
  for (const x of CYL_X) {
    const t = xform(box(w, h, d), at(x, y, 0))
    parts.push(csg(t, [{ op: 'sub', geometry: xform(box(w - 0.006, h, d - 0.006), at(x, y + 0.003, 0)) }]))
    oil.push(xform(box(w - 0.0065, h * 0.55, d - 0.0065), at(x, y - h / 2 + 0.003 + (h * 0.55) / 2, 0)))
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
  const st = strainer()
  const fl = filter()
  const tubes = oilTubes()
  const tr = troughs()
  const ga = gauge()
  return {
    crankOil: tubes.crankOil,
    dipper: dipper(),
    camSkew: camSkewGear(),
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
