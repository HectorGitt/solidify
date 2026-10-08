import * as THREE from 'three'
import { cylinder, extrude, lathe, mat4, merge, tube, xform, type V2 } from '@/geometry'

/**
 * Cheap, parametric crank-train parts shared by the multi-cylinder and lubrication scenes.
 * No CSG: everything here is built from closed lathe / extrude solids, so it is fast enough
 * to rebuild on the main thread when the cylinder count or firing order changes.
 *
 * Frame: crank axis = Z, crank pin at +Y in the throw's local frame.
 */

const { PI } = Math
const alongZ = mat4.rx(PI / 2)

export interface CrankSpec {
  /** crank radius (half stroke), m */
  r: number
  pinR: number
  journalR: number
  /** web thickness (along Z) */
  webT: number
  /** counterweight radius */
  cwR: number
  /** pin length between the webs */
  pinLen: number
}

/** One web: counterweight arc opposite the pin, boss round the pin. Lies in XY, thickness along Z (centred). */
function web(s: CrankSpec) {
  const sh = new THREE.Shape()
  const a0 = PI / 2 + PI - 0.95
  const a1 = PI / 2 + PI + 0.95
  const boss = s.pinR * 1.25
  sh.absarc(0, 0, s.cwR, a0, a1, false)
  sh.lineTo(boss * Math.cos(0.35), s.r + boss * Math.sin(0.35))
  sh.absarc(0, s.r, boss, 0.35, PI - 0.35, false)
  sh.lineTo(s.cwR * Math.cos(a0), s.cwR * Math.sin(a0))
  return xform(extrude(sh, s.webT, { curveSegments: 24 }), mat4.t(0, 0, -s.webT / 2))
}

/** A single throw (two webs + pin), pin at +Y, centred on z = 0. */
export function crankThrow(s: CrankSpec) {
  const w = web(s)
  const off = s.pinLen / 2 + s.webT / 2
  const pin = xform(cylinder(s.pinR, s.pinLen + 0.002, 32), mat4.c(mat4.t(0, s.r, 0), alongZ))
  return merge(xform(w, mat4.t(0, 0, off)), xform(w, mat4.t(0, 0, -off)), pin)
}

export interface ThrowPlacement {
  z: number
  /** firing angle φ (deg). The pin sits at −φ so that the piston reaches TDC when the crank has turned φ. */
  firingDeg: number
}

/**
 * Whole crankshaft: throws, main journals between and outside them, a nose for the pulley (+Z)
 * and a flange for the flywheel (−Z).
 */
export function crankshaft(s: CrankSpec, throws: ThrowPlacement[], pitch: number) {
  const t = crankThrow(s)
  const parts: THREE.BufferGeometry[] = []
  for (const th of throws) parts.push(xform(t, mat4.c(mat4.t(0, 0, th.z), mat4.rz((-th.firingDeg * PI) / 180))))
  const zs = throws.map((th) => th.z).sort((a, b) => a - b)
  const span = s.pinLen / 2 + s.webT
  const jLen = pitch - 2 * span + 0.004
  for (let i = 0; i <= zs.length; i++) {
    const z = i === 0 ? zs[0] - pitch / 2 : i === zs.length ? zs[zs.length - 1] + pitch / 2 : (zs[i - 1] + zs[i]) / 2
    parts.push(xform(cylinder(s.journalR, jLen, 36), mat4.c(mat4.t(0, 0, z), alongZ)))
  }
  const front = zs[zs.length - 1] + pitch / 2 + jLen / 2
  const back = zs[0] - pitch / 2 - jLen / 2
  parts.push(xform(cylinder(s.journalR * 0.75, 0.06, 32), mat4.c(mat4.t(0, 0, front + 0.03), alongZ)))
  parts.push(xform(cylinder(s.journalR * 1.6, 0.012, 40), mat4.c(mat4.t(0, 0, back - 0.006), alongZ)))
  return { geometry: merge(...parts), front: front + 0.06, back: back - 0.012 }
}

/** Main-journal z positions for a crank laid out with `crankshaft()`. */
export function mainJournalZ(throwZ: number[], pitch: number) {
  const zs = [...throwZ].sort((a, b) => a - b)
  const out: number[] = [zs[0] - pitch / 2]
  for (let i = 1; i < zs.length; i++) out.push((zs[i - 1] + zs[i]) / 2)
  out.push(zs[zs.length - 1] + pitch / 2)
  return out
}

export interface PistonSpec {
  bore: number
  /** gudgeon pin to crown */
  comp: number
  /** gudgeon pin to skirt bottom */
  skirt: number
}

/** Piston with ring grooves and a hollow skirt; origin at the gudgeon-pin centre. */
export function piston(p: PistonSpec) {
  const R = p.bore / 2 - 0.0003
  const top = p.comp
  const bottom = -p.skirt
  const wall = Math.max(0.003, p.bore * 0.06)
  const grooves = [top - p.bore * 0.1, top - p.bore * 0.18, top - p.bore * 0.27]
  const gw = p.bore * 0.03
  const d = p.bore * 0.045
  const prof: V2[] = [
    [0, top - p.bore * 0.33],
    [R - wall, top - p.bore * 0.36],
    [R - wall, bottom],
    [R, bottom],
  ]
  for (const gy of grooves) prof.push([R, gy - gw / 2], [R - d, gy - gw / 2], [R - d, gy + gw / 2], [R, gy + gw / 2])
  prof.push([R, top], [0, top])
  const body = lathe(prof, 48)
  const pin = xform(tube(p.bore * 0.14, p.bore * 0.08, 2 * (R - 0.001), 24), alongZ)
  return { body, pin }
}

/** Connecting rod (body and cap as one solid with both eyes), big end at the origin, small end at +Y·L. */
export function conRod(L: number, bigBore: number, smallBore: number, width: number) {
  const big = bigBore * 1.45
  const small = smallBore * 1.55
  const w = small * 0.6 // half-width of the shank
  const aBig = Math.acos(w / big) // big-end junction angle (right side)
  const aSmall = Math.atan2(-Math.sqrt(small * small - w * w), w) // small-end junction (right, below centre)
  const s = new THREE.Shape()
  s.moveTo(-w, Math.sqrt(big * big - w * w))
  s.absarc(0, 0, big, PI - aBig, aBig + 2 * PI, false)
  s.lineTo(w, L + small * Math.sin(aSmall))
  s.absarc(0, L, small, aSmall, PI - aSmall, false)
  s.lineTo(-w, Math.sqrt(big * big - w * w))
  const h1 = new THREE.Path()
  h1.absarc(0, 0, bigBore, 0, PI * 2, true)
  const h2 = new THREE.Path()
  h2.absarc(0, L, smallBore, 0, PI * 2, true)
  s.holes.push(h1, h2)
  return xform(extrude(s, width, { curveSegments: 32 }), mat4.t(0, 0, -width / 2))
}
