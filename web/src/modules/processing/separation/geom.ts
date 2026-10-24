import * as THREE from 'three'

const { PI, cos, sin } = Math

/**
 * Separation-scene helpers. The machine parts (sieves, shaker, screen cleaner, fans, cyclone,
 * airlock) live in the parts library, src/parts/lib/processing.ts.
 */

/**
 * Generate 3D helical vortex curve for particle trajectory visualization.
 * - Outer vortex: spirals down with decreasing radius from rStart to rEnd.
 * - Inner vortex: spirals tightly up with increasing or constant radius.
 */
export function createVortexCurve(
  rStart: number,
  rEnd: number,
  yStart: number,
  yEnd: number,
  turns: number,
  pointsCount = 140,
  reverseDirection = false,
) {
  const pts: THREE.Vector3[] = []
  const dir = reverseDirection ? -1 : 1
  for (let i = 0; i <= pointsCount; i++) {
    const t = i / pointsCount
    const angle = dir * turns * 2 * PI * t
    const r = rStart + (rEnd - rStart) * t
    const y = yStart + (yEnd - yStart) * t
    const x = r * cos(angle)
    const z = r * sin(angle)
    pts.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.CatmullRomCurve3(pts)
}
