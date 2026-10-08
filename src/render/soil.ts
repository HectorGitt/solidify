/**
 * Deformable soil heightfield shared by tillage, traction and field scenes.
 *
 * A regular grid over X (length) × Z (width) storing surface height (m) and a "disturbance"
 * value 0…1 (0 = firm untilled, 1 = freshly worked) used to shade the soil. Pure data + ops,
 * no three.js, so it is unit-testable and worker-safe. <SoilSurface/> renders it.
 */
export interface SoilGrid {
  /** world X of the first column */
  x0: number
  /** world Z of the first row */
  z0: number
  /** cell size (m) */
  cell: number
  nx: number
  nz: number
  height: Float32Array
  disturbed: Float32Array
  /** "compacted" marker 0…1 for wheel ruts / tread prints */
  compacted: Float32Array
  /** incremented whenever the grid changes (renderer re-uploads when it differs) */
  version: number
}

export function createSoil(length: number, width: number, cell = 0.02, x0 = -length / 2, z0 = -width / 2): SoilGrid {
  const nx = Math.max(2, Math.round(length / cell) + 1)
  const nz = Math.max(2, Math.round(width / cell) + 1)
  return {
    x0,
    z0,
    cell,
    nx,
    nz,
    height: new Float32Array(nx * nz),
    disturbed: new Float32Array(nx * nz),
    compacted: new Float32Array(nx * nz),
    version: 0,
  }
}

const idx = (g: SoilGrid, i: number, k: number) => k * g.nx + i

/** Bilinear surface height at world (x, z); outside the grid returns the nearest edge value. */
export function heightAt(g: SoilGrid, x: number, z: number) {
  const fx = Math.min(g.nx - 1.0001, Math.max(0, (x - g.x0) / g.cell))
  const fz = Math.min(g.nz - 1.0001, Math.max(0, (z - g.z0) / g.cell))
  const i = Math.floor(fx)
  const k = Math.floor(fz)
  const u = fx - i
  const v = fz - k
  const h00 = g.height[idx(g, i, k)]
  const h10 = g.height[idx(g, i + 1, k)]
  const h01 = g.height[idx(g, i, k + 1)]
  const h11 = g.height[idx(g, i + 1, k + 1)]
  return (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v
}

/** Seed a gently uneven surface (deterministic). */
export function roughen(g: SoilGrid, amplitude = 0.006, seed = 1) {
  let s = seed
  const rand = () => {
    s = (s * 16807) % 2147483647
    return s / 2147483647
  }
  const phases = Array.from({ length: 6 }, () => [rand() * 6.28, rand() * 6.28, 0.6 + rand() * 3] as const)
  for (let k = 0; k < g.nz; k++) {
    for (let i = 0; i < g.nx; i++) {
      const x = g.x0 + i * g.cell
      const z = g.z0 + k * g.cell
      let h = 0
      for (const [px, pz, f] of phases) h += Math.sin(x * f + px) * Math.cos(z * f * 1.3 + pz)
      g.height[idx(g, i, k)] = (h / phases.length) * amplitude + (rand() - 0.5) * amplitude * 0.4
    }
  }
  g.version++
}

/**
 * Apply a cross-section profile along a straight run in X between xa and xb (a furrow, ridge,
 * harrow pass, …). `profile(dz)` returns the target height relative to the original surface for
 * a lateral offset dz from `zc` (NaN = leave untouched). `blend` 0…1 mixes towards the target.
 */
export function stampRun(
  g: SoilGrid,
  xa: number,
  xb: number,
  zc: number,
  halfWidth: number,
  profile: (dz: number) => number,
  opts: { blend?: number; disturb?: number; mode?: 'set' | 'add' | 'min' | 'max' } = {},
) {
  const blend = opts.blend ?? 1
  const disturb = opts.disturb ?? 1
  const mode = opts.mode ?? 'set'
  const lo = Math.min(xa, xb)
  const hi = Math.max(xa, xb)
  const i0 = Math.max(0, Math.floor((lo - g.x0) / g.cell))
  const i1 = Math.min(g.nx - 1, Math.ceil((hi - g.x0) / g.cell))
  const k0 = Math.max(0, Math.floor((zc - halfWidth - g.z0) / g.cell))
  const k1 = Math.min(g.nz - 1, Math.ceil((zc + halfWidth - g.z0) / g.cell))
  let changed = false
  for (let k = k0; k <= k1; k++) {
    const dz = g.z0 + k * g.cell - zc
    if (Math.abs(dz) > halfWidth) continue
    const target = profile(dz)
    if (!Number.isFinite(target)) continue
    for (let i = i0; i <= i1; i++) {
      const j = idx(g, i, k)
      const h = g.height[j]
      let next = h
      if (mode === 'set') next = h + (target - h) * blend
      else if (mode === 'add') next = h + target * blend
      else if (mode === 'min') next = Math.min(h, target)
      else next = Math.max(h, target)
      if (next !== h) {
        g.height[j] = next
        changed = true
      }
      if (disturb > 0) g.disturbed[j] = Math.max(g.disturbed[j], disturb)
    }
  }
  if (changed || disturb > 0) g.version++
}

/** Press a wheel/track print into the soil (sinkage below the current surface, marks compaction). */
export function pressPrint(g: SoilGrid, x: number, z: number, halfLength: number, halfWidth: number, sinkage: number, compaction = 1) {
  const i0 = Math.max(0, Math.floor((x - halfLength - g.x0) / g.cell))
  const i1 = Math.min(g.nx - 1, Math.ceil((x + halfLength - g.x0) / g.cell))
  const k0 = Math.max(0, Math.floor((z - halfWidth - g.z0) / g.cell))
  const k1 = Math.min(g.nz - 1, Math.ceil((z + halfWidth - g.z0) / g.cell))
  for (let k = k0; k <= k1; k++) {
    for (let i = i0; i <= i1; i++) {
      const j = idx(g, i, k)
      const target = -sinkage
      // never raise; ruts only get deeper
      if (g.height[j] > target) g.height[j] = target
      g.compacted[j] = Math.max(g.compacted[j], compaction)
    }
  }
  g.version++
}

/** Standard furrow-slice profiles (dz measured across the run). */
export const PROFILES = {
  /** open furrow of depth d and width w, with the turned slice heaped beside it */
  mouldboard: (depth: number, width: number) => (dz: number) => {
    if (dz < -width / 2) return NaN
    if (dz < width / 2) return -depth
    const t = (dz - width / 2) / width
    if (t > 1.2) return NaN
    return depth * 0.6 * Math.sin(Math.min(1, t) * Math.PI) * (t < 1 ? 1 : 0)
  },
  /** ridge of height h and base width w (ridger / earthing-up) */
  ridge: (height: number, base: number) => (dz: number) => (Math.abs(dz) > base / 2 ? -height * 0.35 : height * Math.cos((dz / base) * Math.PI)),
  /** harrowed tilth: shallow, slightly lowered, fine ripples */
  tilth: (depth: number, wave: number) => (dz: number) => -depth + depth * 0.25 * Math.sin((dz / wave) * Math.PI * 2),
  /** narrow tine slot (chisel / subsoiler / planter opener) */
  slot: (depth: number, width: number) => (dz: number) => (Math.abs(dz) < width / 2 ? -depth : Math.abs(dz) < width ? depth * 0.15 : NaN),
}
