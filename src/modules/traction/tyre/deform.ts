import * as THREE from 'three'
import type { InflationState } from '@/physics/tyres'

/**
 * Squash the tyre onto the ground for a given deflection (lathe frame: axis +Y, φ = 0 at the
 * ground, x = r sin φ, z = r cos φ, ground plane z = R − δ). A visual model of TT Fig 9:
 * - correct: the tread lies flat across its width and the sidewalls bulge a little;
 * - over-inflated: the crown stays round so only the centre of the tread touches;
 * - under-inflated: the centre buckles up, the shoulders carry the load, the sidewalls bulge.
 * Normals are left as they are (small deformation).
 */
export interface DeformOpts {
  R: number
  r0: number
  hw: number
  delta: number
  /** half contact length (m) */
  halfLen: number
  state: InflationState
}

export function deformTyre(src: THREE.BufferGeometry, o: DeformOpts): THREE.BufferGeometry {
  const g = src.clone()
  if (o.delta <= 1e-5) return g
  const pos = g.getAttribute('position') as THREE.BufferAttribute
  const phiW = Math.min(1.3, 2.2 * Math.asin(Math.min(0.95, o.halfLen / o.R)) + 0.2)
  const ground = o.R - o.delta
  const h = o.R - o.r0
  const bulgeK = (o.state === 'under' ? 0.55 : 0.3) * (o.delta / h)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    if (r < 1e-6) continue
    const phi = Math.atan2(x, z)
    if (Math.abs(phi) >= phiW) continue
    const w = Math.cos((phi / phiW) * (Math.PI / 2)) ** 2
    const gr = Math.min(1, Math.max(0, (r - o.r0) / h))
    const u = Math.max(-1.2, Math.min(1.2, y / o.hw))
    let extra = 0
    if (o.state === 'over') extra = 0.6 * o.delta * u * u
    else if (o.state === 'under') extra = 0.3 * o.delta * Math.max(0, 1 - 1.6 * u * u)
    const rn = r - (o.delta * Math.pow(gr, 0.7) + extra * gr * gr * gr) * w
    let nx = rn * Math.sin(phi)
    let nz = rn * Math.cos(phi)
    if (nz > ground) {
      const k = ground / nz
      nz = ground
      nx = nx * (0.5 + 0.5 * k)
    }
    pos.setXYZ(i, nx, y * (1 + bulgeK * w * Math.sin(Math.PI * gr)), nz)
  }
  pos.needsUpdate = true
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}
