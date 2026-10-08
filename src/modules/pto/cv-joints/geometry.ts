import * as THREE from 'three'
import { box, csg, cylinder, lathe, mat4, merge, pipe, xform, type CsgOp, type V2 } from '@/geometry'
import { helixSpring } from '@/geometry'
import { CV } from './dims'

/**
 * CV-joint solids. Lathe solids are built along +Y and turned onto +X (the shaft axis).
 * Every joint is drawn with its input member on the −X side and the joint centre at the origin.
 */
const { PI, sqrt } = Math
const AXIS_X = mat4.rz(-PI / 2)
const alongX = (profile: V2[], seg = 64) => xform(lathe(profile, seg), AXIS_X)

/** Points on a sphere-of-radius-R arc in the (r, y) half-plane from y0 to y1. */
function arc(R: number, y0: number, y1: number, n = 16): V2[] {
  const pts: V2[] = []
  for (let i = 0; i <= n; i++) {
    const y = y0 + ((y1 - y0) * i) / n
    pts.push([sqrt(Math.max(0, R * R - y * y)), y])
  }
  return pts
}

/** Solid sphere (closed lathe). */
export function sphere(r: number, seg = 24) {
  const pts: V2[] = []
  for (let i = 0; i <= 12; i++) {
    const a = -PI / 2 + (PI * i) / 12
    pts.push([r * Math.cos(a), r * Math.sin(a)])
  }
  return lathe(pts, seg)
}

/** Ball-track groove: a solid tube along a circular arc of radius R in the meridian plane at angle ψ. */
function grooveArc(R: number, tubeR: number, psi: number, halfSpan: number) {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 24; i++) {
    const t = -halfSpan + (2 * halfSpan * i) / 24
    pts.push(new THREE.Vector3(R * Math.sin(t), R * Math.cos(t) * Math.cos(psi), R * Math.cos(t) * Math.sin(psi)))
  }
  return pipe(new THREE.CatmullRomCurve3(pts), tubeR, 0, 32, 16)
}

/* ------------------------------ Rzeppa / Birfield ------------------------------ */

function rzeppaCup() {
  const { Rb, cupIn, cupOut } = CV.rz
  const rimY = 0.016
  const prof: V2[] = [
    [0, -0.12],
    [0.017, -0.12],
    [0.017, -0.052],
    [cupOut, -0.046],
    [cupOut, rimY - 0.003],
    [cupOut - 0.004, rimY],
    ...arc(cupIn, rimY, -cupIn, 24).slice(0, -1),
    [0, -cupIn],
  ]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, CV.rz.ballR + 0.0004, (k * PI) / 3, 0.75) })
  return csg(body, ops)
}

function rzeppaInner() {
  const { Rb, innerR } = CV.rz
  const h = 0.0135
  const prof: V2[] = [[0, -h], ...arc(innerR, -h, h, 16), [0.012, h], [0.012, 0.13], [0, 0.13]]
  const body = alongX(prof, 64)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, CV.rz.ballR + 0.0004, (k * PI) / 3, 0.6) })
  return csg(body, ops)
}

function rzeppaCage() {
  const { cageIn, cageOut, Rb, ballR } = CV.rz
  const h = 0.0135
  const prof: V2[] = [...arc(cageOut, -h, h, 12), ...arc(cageIn, h, -h, 12)]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 6; k++) {
    const psi = (k * PI) / 3
    ops.push({ op: 'sub', geometry: xform(box(2 * ballR + 0.001, 0.03, 2 * ballR + 0.006), mat4.c(mat4.rx(psi), mat4.t(0, Rb, 0))) })
  }
  return csg(body, ops)
}

/* ------------------------------ Weiss / Bendix ------------------------------ */

function weissYoke() {
  const { Rb, ballR, prongR, prongIn, prongHalf } = CV.weiss
  const shell = alongX([...arc(prongR, -0.03, 0.013, 16), ...arc(prongIn, 0.013, -0.03, 10)], 64)
  const ops: CsgOp[] = [
    { op: 'and', geometry: box(0.2, 0.2, 2 * prongHalf) },
  ]
  for (let k = 0; k < 4; k++) ops.push({ op: 'sub', geometry: grooveArc(Rb, ballR + 0.0004, PI / 4 + (k * PI) / 2, 0.8) })
  const prongs = csg(shell, ops)
  const hub = alongX([[0, -0.11], [0.016, -0.11], [0.016, -0.045], [prongR, -0.042], [prongR, -0.029], [0, -0.029]], 64)
  return merge(prongs, hub)
}

/* ------------------------------ Tracta ------------------------------ */

function tractaSpigot() {
  const R = CV.tracta.R
  const half = alongX([[0, -R], ...arc(R, -R, -0.002, 16).slice(1), [0, -0.002]], 48)
  const tongue = xform(box(0.018, 0.04, 0.0075), mat4.t(0.005, 0, 0))
  const trunnions = merge(...[1, -1].map((s) => xform(cylinder(0.0085, 0.014, 24), mat4.t(0, s * (R + 0.002), 0))))
  return { body: csg(half, [{ op: 'add', geometry: tongue }]), trunnions }
}

function tractaSlotted() {
  const R = CV.tracta.R
  const half = alongX([[0, 0.002], ...arc(R, 0.002, R, 16).slice(0, -1), [0, R]], 48)
  const slot = xform(box(0.04, 0.044, 0.0085), mat4.t(0, 0, 0))
  const trunnions = merge(...[1, -1].map((s) => xform(cylinder(0.0085, 0.014, 24), mat4.t(0, s * (R + 0.002), 0))))
  return { body: csg(half, [{ op: 'sub', geometry: slot }]), trunnions }
}

/* ------------------------------ Tripode ------------------------------ */

function tripodePot() {
  const { legR, rollerR, potOut } = CV.tri
  const prof: V2[] = [
    [0, -0.12],
    [0.018, -0.12],
    [0.018, -0.056],
    [potOut, -0.05],
    [potOut, 0.04],
    [0.019, 0.04],
    [0.019, -0.03],
    [0, -0.03],
  ]
  const body = alongX(prof, 72)
  const ops: CsgOp[] = []
  for (let k = 0; k < 3; k++) {
    const a = (2 * PI * k) / 3
    ops.push({ op: 'sub', geometry: xform(cylinder(rollerR + 0.0006, 0.08, 32), mat4.c(mat4.rx(a), mat4.t(0.006, legR, 0), AXIS_X)) })
  }
  return csg(body, ops)
}

function tripodeSpider() {
  const { legR } = CV.tri
  const hub = alongX([[0.0, -0.011], [0.014, -0.011], [0.014, 0.011], [0.0, 0.011]], 40)
  const legs = [0, 1, 2].map((k) => xform(cylinder(0.0056, legR + 0.004, 20), mat4.c(mat4.rx((2 * PI * k) / 3), mat4.t(0, (legR + 0.004) / 2, 0))))
  const shaft = alongX([[0, 0.011], [0.0115, 0.011], [0.0115, 0.14], [0, 0.14]], 32)
  return merge(hub, ...legs, shaft)
}

function tripodeRoller() {
  const r = CV.tri.rollerR
  const h = 0.0062
  return lathe([[0.0062, -h], ...arc(r, -h, h, 10), [0.0062, h]], 32)
}

/* ------------------------------ build ------------------------------ */

export function buildStatic() {
  const spig = tractaSpigot()
  const slot = tractaSlotted()
  return {
    rzCup: rzeppaCup(),
    rzInner: rzeppaInner(),
    rzCage: rzeppaCage(),
    rzBall: sphere(CV.rz.ballR),
    weissYoke: weissYoke(),
    weissBall: sphere(CV.weiss.ballR),
    weissCentre: sphere(CV.weiss.centreR),
    tractaSpigot: spig.body,
    tractaSpigotTrunnions: spig.trunnions,
    tractaSlotted: slot.body,
    tractaSlottedTrunnions: slot.trunnions,
    triPot: tripodePot(),
    triSpider: tripodeSpider(),
    triRoller: tripodeRoller(),
    centreBall: sphere(0.018),
    centreSocket: alongX([[0.0185, -0.02], [0.026, -0.02], [0.026, 0.012], [0.0185, 0.012]], 40),
    centreSpring: xform(helixSpring(0.012, 0.0022, 0.05, 6), AXIS_X),
  }
}

export type CVGeometry = ReturnType<typeof buildStatic>

let ready: CVGeometry | null = null

export async function prepareCVGeometry() {
  if (ready) return ready
  const { buildGeometry } = await import('@/geometry/build')
  ready = await buildGeometry('pto/cv-joints', buildStatic)
  return ready
}

export function buildCVGeometry(): CVGeometry {
  if (!ready) ready = buildStatic()
  return ready
}
