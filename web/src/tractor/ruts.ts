import { mobilityNumber, rutDepth } from '@/physics/traction'
import { pressTyre, type SoilGrid } from '@/render/soil'
import { TRACTOR } from './dims'

/** Tyre data for the mobility number (rear 14.9-28, front 7.50-16; deflections typical). */
const REAR = { b: 0.378, d: 1.32, h: 0.304, delta: 0.035 }
const FRONT = { b: 0.19, d: 0.78, h: 0.19, delta: 0.025 }
const g = 9.81

/** Static axle loads of the Farmland tractor, N. */
export const STATIC_REAR = TRACTOR.mass * g * (1 - TRACTOR.cgX / TRACTOR.wheelbase)
export const STATIC_FRONT = TRACTOR.mass * g * (TRACTOR.cgX / TRACTOR.wheelbase)

/** Rut depths (m) under the rear and front tyres for axle loads (N), soil cone index (Pa) and slip. */
export function rutDepths(Vr: number, Vf: number, CI: number, slip: number) {
  const BnR = mobilityNumber(CI, REAR.b, REAR.d, Math.max(1, Vr / 2), REAR.delta, REAR.h)
  const BnF = mobilityNumber(CI, FRONT.b, FRONT.d, Math.max(1, Vf / 2), FRONT.delta, FRONT.h)
  return { rear: rutDepth(BnR, slip), front: rutDepth(BnF, 0) * 0.8 }
}

/**
 * Press all four tyres of the tractor into the soil. (x, z) is the point under the rear-axle
 * centre and h the heading; depths from rutDepths().
 */
export function pressTractor(grid: SoilGrid, x: number, z: number, h: number, d: { rear: number; front: number }, slip: number, scale = 1) {
  const rearTrack = TRACTOR.rear.track * scale
  const frontTrack = TRACTOR.front.track * scale
  const ch = Math.cos(h)
  const sh = Math.sin(h)
  const rx = sh
  const rz = ch
  for (const s of [1, -1]) {
    pressTyre(grid, x + s * rx * (rearTrack / 2), z + s * rz * (rearTrack / 2), h, 0.16 * scale, (TRACTOR.rear.width / 2) * scale, d.rear, { slip, lugPitch: 0.24 * scale, chevron: true, berm: 0.3 })
    const fx = x + TRACTOR.wheelbase * scale * ch
    const fz = z - TRACTOR.wheelbase * scale * sh
    pressTyre(grid, fx + s * rx * (frontTrack / 2), fz + s * rz * (frontTrack / 2), h, 0.09 * scale, (TRACTOR.front.width / 2) * scale, d.front, { lugPitch: 0, berm: 0.2, compaction: 0.6 })
  }
}
