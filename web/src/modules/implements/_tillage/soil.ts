import type { SoilGrid } from '@/render/soil'

/**
 * Treadmill soil for close-up views: the implement stays still and the soil strip scrolls past it
 * towards −X. Whole cells are shifted; fresh, untilled soil enters at the +X end.
 */
export interface Treadmill {
  /** distance not yet shifted (m) */
  acc: number
  /** total distance travelled (m), used to seed fresh soil */
  x: number
}

const noise = (x: number, z: number, a: number) =>
  a * (0.55 * Math.sin(x * 2.1 + 1.3) * Math.cos(z * 2.7 + 0.4) + 0.3 * Math.sin(x * 5.3 + z * 3.1) + 0.15 * Math.sin(x * 11.7 - z * 7.9))

export function treadmill(g: SoilGrid, t: Treadmill, dist: number, amplitude = 0.006) {
  t.acc += dist
  t.x += dist
  let shifted = 0
  while (t.acc >= g.cell) {
    t.acc -= g.cell
    shifted++
    const { nx, nz } = g
    for (let k = 0; k < nz; k++) {
      const row = k * nx
      g.height.copyWithin(row, row + 1, row + nx)
      g.disturbed.copyWithin(row, row + 1, row + nx)
      g.compacted.copyWithin(row, row + 1, row + nx)
      const j = row + nx - 1
      const xw = t.x + (nx - 1) * g.cell
      g.height[j] = noise(xw, g.z0 + k * g.cell, amplitude)
      g.disturbed[j] = 0
      g.compacted[j] = 0
    }
  }
  if (shifted) g.version++
  return shifted
}

/** Fill the whole grid with fresh untilled soil (same noise the treadmill feeds in). */
export function freshSoil(g: SoilGrid, t: Treadmill, amplitude = 0.006) {
  for (let k = 0; k < g.nz; k++)
    for (let i = 0; i < g.nx; i++) {
      const j = k * g.nx + i
      g.height[j] = noise(t.x + i * g.cell, g.z0 + k * g.cell, amplitude)
      g.disturbed[j] = 0
      g.compacted[j] = 0
    }
  g.version++
}
