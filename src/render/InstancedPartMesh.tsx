import type { ThreeEvent } from '@react-three/fiber'
import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { getMaterial, type Highlight, type MaterialKey, type Variant } from '@/render/materials'
import { usePartContext } from '@/render/Part'
import { isKept, useView } from '@/render/view'

/**
 * The instanced counterpart of <PartMesh/> (which only draws single meshes): many copies of one
 * geometry (chain rollers, balls, plates) in one draw call, with the same view-state aware
 * material, selection and cut behaviour as PartMesh. Set the instance matrices through the ref.
 */
export const InstancedPartMesh = forwardRef<THREE.InstancedMesh, { geometry: THREE.BufferGeometry; count: number; material?: MaterialKey }>(
  function InstancedPartMesh({ geometry, count, material }, ref) {
    const ctx = usePartContext()
    const id = ctx.id
    const selectedId = useView((s) => s.selectedId)
    const hoveredId = useView((s) => s.hoveredId)
    const isolatedId = useView((s) => s.isolatedId)
    const hidden = useView((s) => s.hidden)
    const xray = useView((s) => s.xray)
    const cut = useView((s) => s.cut)
    const select = useView((s) => s.select)
    const hover = useView((s) => s.hover)

    const isHidden = ctx.path.some((p) => hidden.includes(p))
    const outOfIsolation = isolatedId !== null && !ctx.path.includes(isolatedId)
    const sectioned =
      cut.enabled && (ctx.cut === true || (ctx.cut !== false && (ctx.role === 'housing' || ctx.role === 'static' || ctx.role === 'fluid' || cut.sectionMoving)))
    const variant: Variant = xray && ctx.role === 'housing' ? 'xray' : sectioned ? 'cut' : 'solid'
    const highlight: Highlight = selectedId && ctx.path.includes(selectedId) ? 'select' : hoveredId === id ? 'hover' : 'none'
    const mat = getMaterial(material ?? ctx.material, { variant, highlight, intersection: cut.intersection })

    const raycast = useMemo(() => {
      if (variant !== 'cut') return THREE.InstancedMesh.prototype.raycast
      const cutState = cut
      return function (this: THREE.InstancedMesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
        const tmp: THREE.Intersection[] = []
        THREE.InstancedMesh.prototype.raycast.call(this, raycaster, tmp)
        for (const hit of tmp) if (isKept(hit.point, cutState)) intersects.push(hit)
      }
    }, [variant, cut])

    return (
      <instancedMesh
        ref={ref}
        args={[geometry, mat, count]}
        material={mat}
        visible={!isHidden && !outOfIsolation}
        castShadow={variant !== 'xray'}
        receiveShadow
        frustumCulled={false}
        raycast={raycast}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          if (!id) return
          e.stopPropagation()
          if (e.delta > 4) return
          
          const view = useView.getState()
          if (view.caliperMode) {
            const p = e.point
            let nextPts = [...view.caliperPoints, [p.x, p.y, p.z] as [number, number, number]]
            if (nextPts.length > 2) nextPts = [nextPts[nextPts.length - 1]]
            view.setCaliperPoints(nextPts)
            return
          }
          
          select(id)
        }}
        onPointerOver={(e: ThreeEvent<PointerEvent>) => {
          if (!id) return
          e.stopPropagation()
          hover(id)
        }}
        onPointerOut={() => {
          if (id && useView.getState().hoveredId === id) hover(null)
        }}
      />
    )
  },
)

/** Write a static set of instance matrices (e.g. balls in a race) once. */
export function setInstances(mesh: THREE.InstancedMesh | null, mats: THREE.Matrix4[]) {
  if (!mesh) return
  mats.forEach((m, i) => mesh.setMatrixAt(i, m))
  mesh.count = mats.length
  mesh.instanceMatrix.needsUpdate = true
  mesh.computeBoundingSphere()
}
