import * as THREE from 'three'
import { box, csg, cylinder, extrude, extrudeTwisted, gear, helixSpring, lathe, mat4, merge, tube, xform, type CsgOp, type V2 } from '@/geometry'
import { flywheel as libFlywheel } from '@/parts/lib/engine'
import { CRANK_Y, DR, GOV, GY, OB } from './model'

const { PI } = Math
const alongX = mat4.rz(-PI / 2)
const at = (x: number, y: number, z = 0) => mat4.t(x, y, z)

/* ------------------------------ oil-bath air cleaner (TB Fig 4.4) ------------------------------ */

function oilBathBody() {
  const shell = lathe(
    [
      [0.086, 0.11],
      [0.09, 0.11],
      [0.09, 0.3],
      [0.06, 0.33],
      [0.036, 0.336],
      [0.036, 0.331],
      [0.058, 0.325],
      [0.086, 0.297],
    ],
    64,
  )
  return xform(
    csg(shell, [
      { op: 'add', geometry: xform(cylinder(0.028, 0.08, 40), mat4.c(at(0.12, 0.285), alongX)) },
      { op: 'sub', geometry: xform(cylinder(0.024, 0.11, 40), mat4.c(at(0.12, 0.285), alongX)) },
    ]),
    at(OB.x, 0),
  )
}

function oilBathParts() {
  const m = at(OB.x, 0)
  const tubeG = xform(tube(0.036, 0.032, OB.tubeTop - 0.075, 48), at(0, (OB.tubeTop + 0.075) / 2))
  const mesh = lathe([[0.0362, 0.15], [0.0858, 0.15], [0.0858, 0.27], [0.0362, 0.27]], 64)
  const tray = lathe([[0.0362, 0.142], [0.0858, 0.142], [0.0858, 0.147], [0.0362, 0.147]], 64)
  const cup = lathe([[0, 0], [0.094, 0], [0.094, 0.122], [0.0905, 0.122], [0.0905, 0.004], [0, 0.004]], 64)
  // inner baffle cup that keeps the oil round the tube mouth
  const baffle = lathe([[0.05, 0.004], [0.053, 0.004], [0.053, 0.068], [0.05, 0.068]], 48)
  const clamps = merge(...[-1, 1].map((s) => xform(box(0.012, 0.03, 0.02), at(s * 0.097, 0.11))))
  const oil = lathe([[0, 0], [0.0903, 0], [0.0903, 1], [0, 1]], 64)
  const sludge = lathe([[0, 0], [0.0903, 0], [0.0903, 1], [0, 1]], 48)
  return {
    tube: xform(tubeG, m),
    mesh: xform(mesh, m),
    tray: xform(tray, m),
    cup: xform(cup, m),
    baffle: xform(baffle, m),
    clamps: xform(clamps, m),
    oil,
    sludge,
  }
}

/** Unit-height intake stack, pre-cleaner (screen, vanes, cap) built at the origin. */
function stackParts() {
  const stack = tube(0.036, 0.032, 1, 48)
  stack.translate(0, 0.5, 0)
  const screen = tube(0.055, 0.053, 0.05, 48)
  screen.translate(0, 0.03, 0)
  const cap = lathe([[0, 0.055], [0.064, 0.055], [0.064, 0.06], [0.03, 0.075], [0, 0.077]], 48)
  const base = lathe([[0.032, 0], [0.056, 0], [0.056, 0.005], [0.032, 0.005]], 48)
  const vanes = merge(
    ...Array.from({ length: 8 }, (_, i) => {
      const v = xform(box(0.016, 0.044, 0.002), mat4.c(mat4.ry((i / 8) * 2 * PI), at(0.042, 0.03), mat4.ry(0.6)))
      return v
    }),
  )
  return { stack, screen, cap: merge(cap, base), vanes }
}

/* ------------------------------ dry element cleaner (TB Fig 4.3) ------------------------------ */

function dryHousing() {
  const shell = lathe(
    [
      [0.066, 0.06],
      [0.07, 0.06],
      [0.07, 0.25],
      [0.022, 0.256],
      [0.022, 0.252],
      [0.066, 0.246],
    ],
    64,
  )
  return xform(
    csg(shell, [
      { op: 'add', geometry: xform(cylinder(0.02, 0.12, 32), mat4.c(at(-0.046, 0.215, -0.06), mat4.rx(PI / 2))) },
      { op: 'sub', geometry: xform(cylinder(0.0165, 0.13, 32), mat4.c(at(-0.046, 0.215, -0.06), mat4.rx(PI / 2))) },
    ]),
    at(DR.x, 0),
  )
}

function dryParts() {
  const m = at(DR.x, 0)
  const n = 40
  const pts: THREE.Vector2[] = []
  for (let i = 0; i < 2 * n; i++) {
    const a = (i / (2 * n)) * 2 * PI
    const r = i % 2 === 0 ? 0.058 : 0.037
    pts.push(new THREE.Vector2(r * Math.cos(a), r * Math.sin(a)))
  }
  const hole: THREE.Vector2[] = []
  for (let i = 0; i < 40; i++) {
    const a = -(i / 40) * 2 * PI
    hole.push(new THREE.Vector2(0.033 * Math.cos(a), 0.033 * Math.sin(a)))
  }
  const pleats = xform(extrudeTwisted(pts, [hole], 0.13), mat4.c(at(0, 0.14), mat4.rx(-PI / 2)))
  const caps = merge(lathe([[0.03, 0.069], [0.061, 0.069], [0.061, 0.075], [0.03, 0.075]], 48), lathe([[0.022, 0.205], [0.061, 0.205], [0.061, 0.211], [0.022, 0.211]], 48))
  const inner = tube(0.032, 0.0305, 0.13, 32)
  inner.translate(0, 0.14, 0)
  const baffle = tube(0.064, 0.062, 0.05, 64)
  baffle.translate(0, 0.222, 0)
  const outlet = tube(0.022, 0.019, 0.1, 40)
  outlet.translate(0, 0.258, 0)
  const cup = lathe([[0.012, 0], [0.072, 0], [0.072, 0.066], [0.069, 0.066], [0.069, 0.004], [0.012, 0.004]], 64)
  const unloader = lathe([[0, -0.03], [0.004, -0.03], [0.012, 0], [0.012, 0.004], [0, 0.004]], 32)
  const dust = lathe([[0.012, 0], [0.0688, 0], [0.0688, 1], [0.012, 1]], 48)
  return {
    pleats: xform(pleats, m),
    caps: xform(caps, m),
    inner: xform(inner, m),
    baffle: xform(baffle, m),
    outlet: xform(outlet, m),
    cup: xform(cup, m),
    unloader: xform(unloader, m),
    dust,
  }
}

/* ------------------------------ governor (TB Fig 4.10) ------------------------------ */

function engineBlock() {
  const b = xform(box(0.15, 0.17, 0.14), at(0.065, -0.0))
  return csg(b, [{ op: 'sub', geometry: xform(cylinder(0.022, 0.4, 32), mat4.c(at(0.1, CRANK_Y), alongX)) }])
}

function crankParts() {
  const shaft = xform(cylinder(0.02, 0.46, 32), mat4.c(at(0.33, 0), alongX))
  // library flywheel (with its starter ring gear), flat face at x = 0.38, disc towards +X
  const fw = libFlywheel({ r: 0.15, width: 0.045, boreR: 0.02 })
  const onX = mat4.c(at(0.38, 0), mat4.ry(-PI / 2))
  const flywheel = xform(fw.disc, onX)
  const ring = xform(fw.ring, onX)
  const drum = xform(lathe([[0.02, 0], [0.085, 0], [0.085, 0.045], [0.078, 0.045], [0.078, 0.008], [0.02, 0.008]], 72), mat4.c(at(0.48, 0), alongX))
  const crankGear = xform(gear({ teeth: 30, module: 0.003, width: 0.02, bore: 0.02 }), mat4.ry(PI / 2))
  return { shaft: merge(shaft, flywheel), ring, drum, crankGear }
}

/** Prony-type brake on the drum: shoes, arm along +Z and a hanging unit weight (scaled with the load). */
function brakeParts() {
  const band = xform(tube(0.093, 0.086, 0.04, 72), mat4.c(at(0.502, CRANK_Y), alongX))
  const arm = xform(box(0.02, 0.016, 0.34), at(0.502, CRANK_Y + 0.1, 0.17))
  const strut = xform(box(0.02, 0.02, 0.02), at(0.502, CRANK_Y + 0.093, 0))
  const hanger = xform(cylinder(0.002, 0.12, 8), at(0.502, CRANK_Y + 0.04, 0.33))
  const weight = lathe([[0, -0.5], [0.5, -0.5], [0.5, 0.5], [0, 0.5]], 24)
  return { brake: merge(band, arm, strut, hanger), weight }
}

function governorHousing() {
  const shell = lathe(
    [
      [0.007, 0],
      [0.095, 0],
      [0.095, 0.165],
      [0.007, 0.165],
      [0.007, 0.159],
      [0.089, 0.159],
      [0.089, 0.006],
      [0.007, 0.006],
    ],
    64,
  )
  const g = xform(shell, mat4.c(at(0.17, GY), alongX))
  const ops: CsgOp[] = [
    { op: 'sub', geometry: xform(box(0.12, 0.05, 0.03), at(0.26, GY + 0.085)) },
  ]
  // pivot brackets: a pair of cheeks either side of each lever
  for (const p of [GOV.forkPivot, GOV.leverPivot]) for (const z of [-0.0185, 0.0185]) ops.push({ op: 'add', geometry: xform(box(0.016, 0.024, 0.013), at(p.x, p.y - 0.006, z)) })
  return csg(g, ops)
}

function spindleParts() {
  const spindle = xform(cylinder(0.006, 0.26, 24), mat4.c(at(0.25, 0), alongX))
  const govGear = xform(gear({ teeth: 60, module: 0.003, width: 0.02, bore: 0.006 }), mat4.c(at(GOV.gearX, 0), mat4.ry(PI / 2)))
  const carrier = xform(lathe([[0.006, 0], [0.045, 0], [0.045, 0.008], [0.006, 0.008]], 48), mat4.c(at(0.186, 0), alongX))
  const lugs = merge(...[1, -1].map((s) => xform(box(0.012, 0.016, 0.022), at(0.196, s * 0.035))))
  return { spindle, govGear, carrier: merge(carrier, lugs) }
}

/** One flyweight bell crank in its pivot frame: weight arm along +X (b = 50 mm), toe along −Y (c = 25 mm). */
function flyweight() {
  const block = xform(box(0.036, 0.03, 0.04), at(0.05, 0.006))
  const arm = xform(box(0.04, 0.008, 0.012), at(0.022, 0))
  const toe = xform(box(0.008, 0.026, 0.012), at(0, -0.012))
  const roller = xform(cylinder(0.003, 0.014, 16), mat4.c(at(0, -0.025), mat4.rx(PI / 2)))
  const hub = xform(cylinder(0.0055, 0.016, 20), mat4.rx(PI / 2))
  return { body: merge(block, arm, toe, hub), roller }
}

function sleeve() {
  const L = GOV.sleeveLen
  return xform(
    lathe([[0.0065, 0], [0.016, 0], [0.016, 0.011], [0.012, 0.012], [0.012, 0.018], [0.016, 0.019], [0.016, L], [0.0065, L]], 48),
    alongX,
  )
}

function springSeat() {
  return xform(lathe([[0.0065, 0], [0.02, 0], [0.02, 0.004], [0.012, 0.005], [0.012, 0.03], [0.0065, 0.03]], 48), alongX)
}

/** Lever pivoted at the origin: fork down (length L), arm up (length up). */
function lever(L: number, up: number, knob = false) {
  const s = new THREE.Shape()
  s.moveTo(-0.004, up)
  s.lineTo(0.004, up)
  s.lineTo(0.005, 0)
  s.lineTo(0.004, -L + 0.012)
  s.lineTo(-0.004, -L + 0.012)
  s.lineTo(-0.005, 0)
  s.lineTo(-0.004, up)
  const bar = extrude(s, 0.008)
  const fork = merge(...[-1, 1].map((sg) => xform(box(0.006, 0.014, 0.004), at(0, -L + 0.006, sg * 0.014))), xform(box(0.006, 0.006, 0.032), at(0, -L + 0.015)))
  const hub = xform(cylinder(0.006, 0.014, 20), mat4.rx(PI / 2))
  const parts = [bar, fork, hub]
  if (knob) parts.push(xform(cylinder(0.007, 0.024, 20), at(0, up + 0.01)))
  return merge(...parts)
}

function pumpStub() {
  const body = xform(box(0.12, 0.05, 0.06), at(0.06, GY + 0.145))
  return csg(body, [{ op: 'sub', geometry: xform(box(0.14, 0.009, 0.009), at(0.06, GY + 0.145)) }])
}

function rackBar() {
  // rack bar along X with teeth on top (unit used in local coordinates, right end at x = 0)
  const bar = xform(box(0.15, 0.008, 0.008), at(-0.075, 0))
  const teeth = merge(...Array.from({ length: 24 }, (_, i) => xform(box(0.002, 0.003, 0.008), at(-0.12 + i * 0.0045, 0.0055))))
  const eye = xform(tube(0.005, 0.0022, 0.008, 16), mat4.rx(PI / 2))
  return merge(bar, teeth, eye)
}

function controlRod() {
  // unit-length rod along +X
  return xform(cylinder(0.0025, 1, 12), mat4.c(at(0.5, 0), alongX))
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const ob = oilBathParts()
  const st = stackParts()
  const dr = dryParts()
  const cr = crankParts()
  const br = brakeParts()
  const sp = spindleParts()
  const fw = flyweight()
  return {
    obBody: oilBathBody(),
    obTube: ob.tube,
    obMesh: ob.mesh,
    obTray: ob.tray,
    obCup: ob.cup,
    obBaffle: ob.baffle,
    obClamps: ob.clamps,
    obOil: ob.oil,
    obSludge: ob.sludge,
    stack: st.stack,
    screen: st.screen,
    cap: st.cap,
    vanes: st.vanes,
    dash: xform(box(0.32, 0.003, 0.2), at(OB.x + 0.06, 0)),
    dryHousing: dryHousing(),
    pleats: dr.pleats,
    dryCaps: dr.caps,
    dryInner: dr.inner,
    dryBaffle: dr.baffle,
    dryOutlet: dr.outlet,
    dryCup: dr.cup,
    unloader: dr.unloader,
    dryDust: dr.dust,
    block: engineBlock(),
    crank: cr.shaft,
    flywheelRing: cr.ring,
    drum: cr.drum,
    crankGear: cr.crankGear,
    brake: br.brake,
    weight: br.weight,
    govHousing: governorHousing(),
    spindle: sp.spindle,
    govGear: sp.govGear,
    carrier: sp.carrier,
    flyweight: fw.body,
    roller: fw.roller,
    sleeve: sleeve(),
    govSpring: xform(helixSpring(0.0145, 0.0026, 1, 7), alongX),
    springSeat: springSeat(),
    forkLever: lever(GOV.forkLen, GOV.forkTop),
    speedLever: lever(0.085, 0.07, true),
    pump: pumpStub(),
    rack: rackBar(),
    rod: controlRod(),
  }
}

export type AirGovGeometry = ReturnType<typeof buildStatic>

let ready: AirGovGeometry | null = null

export async function prepareAirGovGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('engine/air-governor', buildStatic)
  return ready
}

export function buildAirGovGeometry(): AirGovGeometry {
  if (!ready) ready = buildStatic()
  return ready
}

export type { V2 }
