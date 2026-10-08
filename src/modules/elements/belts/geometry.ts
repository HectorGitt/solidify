import * as THREE from 'three'
import { box, cylinder, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import { SECTIONS, type Section } from './model'

const { PI } = Math
/** Lathe solids are built about Y; pulleys turn about Z. */
const toZ = (g: THREE.BufferGeometry) => xform(g, mat4.rx(PI / 2))

const HUB_L = 0.07

/** Crowned flat-belt pulley: rim, hub, and arms (large) or a web (small). Axis along Z. */
export function flatPulley(R: number, W: number, bore = 0.02) {
  const rimT = Math.max(0.006, R * 0.06)
  const crown = Math.min(0.003, R * 0.01)
  const hubR = Math.max(bore * 2, R * 0.22)
  const rim = lathe(
    [
      [R - rimT, -W / 2],
      [R, -W / 2],
      [R + crown, 0],
      [R, W / 2],
      [R - rimT, W / 2],
    ],
    96,
  )
  const hub = lathe(
    [
      [bore, -HUB_L / 2],
      [hubR, -HUB_L / 2],
      [hubR, HUB_L / 2],
      [bore, HUB_L / 2],
    ],
    40,
  )
  const parts = [toZ(rim), toZ(hub)]
  if (R > 0.14) {
    // six arms, elliptical in practice — drawn as tapered boxes
    const len = R - rimT - hubR + 0.004
    for (let i = 0; i < 6; i++) {
      const a = (i * PI) / 3
      const arm = xform(box(len, Math.max(0.014, R * 0.09), Math.min(W * 0.45, 0.05)), mat4.c(mat4.rz(a), mat4.t(hubR + len / 2 - 0.002, 0, 0)))
      parts.push(arm)
    }
  } else {
    const web = lathe(
      [
        [hubR - 0.001, -W * 0.15],
        [R - rimT + 0.001, -W * 0.15],
        [R - rimT + 0.001, W * 0.15],
        [hubR - 0.001, W * 0.15],
      ],
      64,
    )
    parts.push(toZ(web))
  }
  return merge(...parts)
}

/** Multi-groove V-sheave with pitch radius Rp. Axis along Z, grooves centred on z = 0. */
export function vSheave(Rp: number, grooves: number, section: Section, groove: number, bore = 0.02) {
  const s = SECTIONS[section]
  const ro = Rp + s.h * 0.35 // outside radius: belt top runs about flush with the rim
  const depth = s.h + 0.004
  const wTop = s.top + 0.001
  const wBot = wTop - 2 * depth * Math.tan(groove / 2)
  const edge = s.e * 0.65
  const W = (grooves - 1) * s.e + 2 * edge
  const rimIn = Math.max(bore * 2.2, ro - depth - Math.max(0.008, Rp * 0.1))
  const prof: V2[] = [[rimIn, -W / 2], [ro, -W / 2]]
  for (let g = 0; g < grooves; g++) {
    const zc = -W / 2 + edge + g * s.e
    prof.push([ro, zc - wTop / 2], [ro - depth, zc - wBot / 2], [ro - depth, zc + wBot / 2], [ro, zc + wTop / 2])
  }
  prof.push([ro, W / 2], [rimIn, W / 2])
  const rim = lathe(prof, 96)
  const hubR = Math.max(bore * 2, Math.min(rimIn - 0.004, Rp * 0.3))
  const hub = lathe([[bore, -Math.max(W, HUB_L) / 2], [hubR, -Math.max(W, HUB_L) / 2], [hubR, Math.max(W, HUB_L) / 2], [bore, Math.max(W, HUB_L) / 2]], 40)
  const parts = [toZ(rim), toZ(hub)]
  if (rimIn - hubR > 0.02) {
    const len = rimIn - hubR + 0.004
    for (let i = 0; i < 5; i++) {
      const a = (i * 2 * PI) / 5
      parts.push(xform(box(len, Math.max(0.012, Rp * 0.1), W * 0.5), mat4.c(mat4.rz(a), mat4.t(hubR + len / 2 - 0.002, 0, 0))))
    }
  }
  return { geometry: merge(...parts), width: W, outside: ro }
}

/** Plain idler pulley with a flanged rim. */
export function idlerPulley(R: number, W: number) {
  return toZ(
    lathe(
      [
        [0.012, -W / 2 - 0.004],
        [R * 0.35, -W / 2 - 0.004],
        [R * 0.35, -W / 2],
        [R, -W / 2],
        [R, W / 2],
        [R * 0.35, W / 2],
        [R * 0.35, W / 2 + 0.004],
        [0.012, W / 2 + 0.004],
      ],
      48,
    ),
  )
}

/** Key and keyway marker on a hub so rotation reads clearly. */
export function hubKey(boreR: number, len: number) {
  return xform(box(boreR * 0.5, boreR * 0.5, len), mat4.t(0, boreR * 1.05, 0))
}

/** Foot-mounted induction motor: finned frame along −Z from z = 0, shaft axis on the origin. */
export function motor(R = 0.1, L = 0.3) {
  const fins: V2[] = [[0, 0], [R * 0.75, 0], [R * 0.75, 0.02]]
  const n = 12
  for (let i = 0; i < n; i++) {
    const y0 = 0.03 + (i * (L - 0.07)) / n
    const y1 = y0 + (L - 0.07) / n
    fins.push([R, y0], [R, y0 + (y1 - y0) * 0.45], [R * 0.9, y0 + (y1 - y0) * 0.55], [R * 0.9, y1])
  }
  fins.push([R * 0.8, L - 0.035], [R * 0.75, L], [0, L])
  const body = xform(lathe(fins, 48), mat4.rx(-PI / 2))
  const terminal = xform(box(R * 0.7, R * 0.4, R * 0.8), mat4.t(0, R + R * 0.15, -L * 0.45))
  return merge(body, terminal)
}

/** A shaft along Z from z0 to z1. */
export const shaft = (r: number, z0: number, z1: number) => xform(cylinder(r, z1 - z0, 24), mat4.c(mat4.t(0, 0, (z0 + z1) / 2), mat4.rx(PI / 2)))

/** Pillow-block (plummer) bearing housing: base on y = −h, bore on the origin, axis Z. */
export function pillowBlock(boreR: number, h: number) {
  const body = lathe([[boreR, -0.025], [boreR * 2.2, -0.025], [boreR * 2.2, 0.025], [boreR, 0.025]], 32)
  const foot = xform(box(boreR * 6, 0.016, 0.05), mat4.t(0, -h + 0.008, 0))
  const web = xform(box(boreR * 2.2, h - boreR * 1.5, 0.04), mat4.t(0, -h / 2 - boreR * 0.4, 0))
  return merge(toZ(body), foot, web)
}

/** Belt marker (painted chevron) — a small block placed on the belt's outer face. */
export const marker = (w: number) => box(0.01, 0.0016, w * 0.8)
