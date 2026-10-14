import { box, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import { flatPulley, idlerPulley, parallelKey, pillowBlock, shaftAlongZ, vSheave as sheave } from '@/parts/lib/elements'
import { SECTIONS, type Section } from './model'

/** Pulleys, keys, shafts and pillow blocks come from the shared parts library (src/parts/lib/elements.ts). */
export { flatPulley, idlerPulley, pillowBlock }

const { PI } = Math

/** Multi-groove V-sheave for a classical section (Z, A, B): the library's `vSheave`. Axis along Z. */
export const vSheave = (Rp: number, grooves: number, section: Section, groove: number, bore = 0.02) => sheave(Rp, grooves, SECTIONS[section], groove, bore)

/** Key and keyway marker on a hub so rotation reads clearly. */
export const hubKey = (boreR: number, len: number) => parallelKey(boreR, len)

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
export const shaft = (r: number, z0: number, z1: number) => shaftAlongZ(r, z0, z1)

/** Belt marker (painted chevron) — a small block placed on the belt's outer face. */
export const marker = (w: number) => box(0.01, 0.0016, w * 0.8)
