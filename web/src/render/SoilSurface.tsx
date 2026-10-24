import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { cutPlanes } from './materials'
import type { SoilGrid } from './soil'

export interface SoilSurfaceProps {
  grid: SoilGrid
  /** firm soil colour */
  color?: string
  /** freshly worked soil colour (darker, moister) */
  tilled?: string
  /** compacted / tread-print colour */
  compactedColor?: string
  /** extra depth of the soil block below the surface, so cut views show a solid section */
  depth?: number
  /** respect the active cut planes */
  clipped?: boolean
}

/**
 * Renders a SoilGrid as a vertex-coloured surface that updates when the grid's version changes,
 * with a skirt down to `depth` so it reads as a solid block in section views.
 */
export function SoilSurface({ grid, color = '#7a5a3c', tilled = '#4e3725', compactedColor = '#5f4a36', depth = 0.4, clipped = true }: SoilSurfaceProps) {
  const lastVersion = useRef(-1)
  const geo = useMemo(() => {
    const { nx, nz } = grid
    const g = new THREE.BufferGeometry()
    const vCount = nx * nz
    const pos = new Float32Array(vCount * 3)
    const col = new Float32Array(vCount * 3)
    for (let k = 0; k < nz; k++)
      for (let i = 0; i < nx; i++) {
        const j = k * nx + i
        pos[j * 3] = grid.x0 + i * grid.cell
        pos[j * 3 + 2] = grid.z0 + k * grid.cell
      }
    const index: number[] = []
    for (let k = 0; k < nz - 1; k++)
      for (let i = 0; i < nx - 1; i++) {
        const a = k * nx + i
        const b = a + 1
        const c = a + nx
        const d = c + 1
        index.push(a, c, b, b, c, d)
      }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setIndex(index)
    return g
  }, [grid])

  const skirt = useMemo(() => {
    const L = (grid.nx - 1) * grid.cell
    const W = (grid.nz - 1) * grid.cell
    const g = new THREE.BoxGeometry(L, depth, W)
    g.translate(grid.x0 + L / 2, -depth / 2 - 0.002, grid.z0 + W / 2)
    return g
  }, [grid, depth])

  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 })
    if (clipped) m.clippingPlanes = cutPlanes
    return m
  }, [clipped])
  const skirtMat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: tilled, roughness: 1 })
    if (clipped) m.clippingPlanes = cutPlanes
    return m
  }, [clipped, tilled])

  const cFirm = useMemo(() => new THREE.Color(color), [color])
  const cTill = useMemo(() => new THREE.Color(tilled), [tilled])
  const cComp = useMemo(() => new THREE.Color(compactedColor), [compactedColor])
  const tmp = useMemo(() => new THREE.Color(), [])

  useFrame(() => {
    if (grid.version === lastVersion.current) return
    lastVersion.current = grid.version
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const col = geo.getAttribute('color') as THREE.BufferAttribute
    const n = grid.nx * grid.nz
    for (let j = 0; j < n; j++) {
      pos.array[j * 3 + 1] = grid.height[j]
      tmp.copy(cFirm).lerp(cTill, grid.disturbed[j]).lerp(cComp, grid.compacted[j] * 0.7)
      // subtle per-vertex variation so the surface isn't flat-coloured
      const n01 = ((j * 2654435761) % 1000) / 1000
      tmp.multiplyScalar(0.92 + n01 * 0.12)
      col.array[j * 3] = tmp.r
      col.array[j * 3 + 1] = tmp.g
      col.array[j * 3 + 2] = tmp.b
    }
    pos.needsUpdate = true
    col.needsUpdate = true
    geo.computeVertexNormals()
    geo.computeBoundingSphere()
  })

  return (
    <group>
      <mesh geometry={geo} material={mat} receiveShadow />
      <mesh geometry={skirt} material={skirtMat} receiveShadow />
    </group>
  )
}
