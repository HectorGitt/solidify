import * as THREE from 'three'
import { cutPlanes, getCustomMaterial } from '@/render/materials'

/**
 * Layout and material helpers for the farm-structures scenes. The building parts (walls, roofs,
 * trusses, columns, slabs, silos) live in the parts library, src/parts/lib/structures.ts.
 */

export type { Opening, Side } from '@/parts/lib/structures'

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
