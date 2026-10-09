import * as THREE from 'three'
import { box, extrude, mat4, merge, xform } from '@/geometry'
import { cutPlanes, getCustomMaterial } from '@/render/materials'

/** Shared geometry helpers for the farm-structures scenes (M15). Main-thread, cheap. */

export type Side = '+x' | '-x' | '+z' | '-z'
export interface Opening {
  side: Side
  /** centre offset along the wall from its midpoint (m) */
  at: number
  width: number
  height: number
  /** sill height (0 for doors) */
  sill?: number
}

/** Closed polygon (CCW) as a Shape. */
export function poly(pts: [number, number][]) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

/**
 * Four walls of a w × d building (local X across w, Z along d), base at y = 0, wall thickness t.
 * The ±z walls run the full width; the ±x walls fit between them. Openings leave gaps with a
 * lintel above (and a sill wall below windows). Every piece is a closed box.
 */
export function walls(w: number, d: number, h: number, t: number, openings: Opening[] = []) {
  const parts: THREE.BufferGeometry[] = []
  const run = (side: Side) => {
    const alongX = side === '+z' || side === '-z'
    const len = alongX ? w : d - 2 * t
    const ops = openings.filter((o) => o.side === side).sort((a, b) => a.at - b.at)
    const place = (a: number, b: number, y0: number, y1: number) => {
      if (b - a < 1e-3 || y1 - y0 < 1e-3) return
      const c = (a + b) / 2
      const g = alongX ? box(b - a, y1 - y0, t) : box(t, y1 - y0, b - a)
      const sgn = side[0] === '+' ? 1 : -1
      const pos = alongX ? mat4.t(c, (y0 + y1) / 2, sgn * (d / 2 - t / 2)) : mat4.t(sgn * (w / 2 - t / 2), (y0 + y1) / 2, c)
      parts.push(xform(g, pos))
    }
    let cur = -len / 2
    for (const o of ops) {
      const a = Math.max(-len / 2, o.at - o.width / 2)
      const b = Math.min(len / 2, o.at + o.width / 2)
      place(cur, a, 0, h)
      place(a, b, Math.min(h, o.height), h)
      if (o.sill) place(a, b, 0, o.sill)
      cur = b
    }
    place(cur, len / 2, 0, h)
  }
  ;(['+z', '-z', '+x', '-x'] as Side[]).forEach(run)
  return merge(...parts)
}

/**
 * Gable roof shell spanning `span` (across X) with the ridge along Z, eaves at y = 0.
 * Extruded inverted-V of thickness t with `overhang` beyond the walls.
 */
export function gableRoof(span: number, length: number, pitchDeg: number, overhang = 0.4, t = 0.08) {
  const th = (pitchDeg * Math.PI) / 180
  const a = span / 2 + overhang
  const h = a * Math.tan(th)
  const dx = t / Math.sin(th)
  const dy = t / Math.cos(th)
  const s = poly([
    [-a, -overhang * Math.tan(th)],
    [-a + dx, -overhang * Math.tan(th)],
    [0, h - dy - overhang * Math.tan(th)],
    [a - dx, -overhang * Math.tan(th)],
    [a, -overhang * Math.tan(th)],
    [0, h - overhang * Math.tan(th)],
  ])
  return { geometry: extrude(s, length + 2 * overhang), rise: h - overhang * Math.tan(th) }
}

/** Flat annulus (ring) in the XZ plane, thickness h, base at y = 0. */
export function ringFlat(rOuter: number, rInner: number, h: number, seg = 96) {
  const s = new THREE.Shape()
  s.absarc(0, 0, rOuter, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  hole.absarc(0, 0, rInner, 0, Math.PI * 2, true)
  s.holes.push(hole)
  return xform(extrude(s, h, { curveSegments: seg }), mat4.c(mat4.t(0, h / 2, 0), mat4.rx(-Math.PI / 2)))
}

/** Flat disc in the XZ plane, thickness h, base at y = 0. */
export function discFlat(r: number, h: number, seg = 96) {
  const s = new THREE.Shape()
  s.absarc(0, 0, r, 0, Math.PI * 2, false)
  return xform(extrude(s, h, { curveSegments: seg }), mat4.c(mat4.t(0, h / 2, 0), mat4.rx(-Math.PI / 2)))
}

/** A coloured, cut-aware standard material (zones, plumes, polythene). */
export function tint(id: string, color: string, opacity = 1, emissive = 0) {
  return getCustomMaterial(`structures:${id}`, () => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, transparent: opacity < 1, opacity, emissive: color, emissiveIntensity: emissive, side: THREE.DoubleSide, depthWrite: opacity >= 1 })
    m.clippingPlanes = cutPlanes
    return m
  })
}

/** Plan point (east, north) to scene [x, y, z]: X east, Z south. */
export const P = (east: number, north: number, y = 0): [number, number, number] => [east, y, -north]
