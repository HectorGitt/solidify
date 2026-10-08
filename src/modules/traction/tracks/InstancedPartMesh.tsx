import type { ThreeEvent } from '@react-three/fiber'
import { forwardRef } from 'react'
import * as THREE from 'three'
import { getMaterial, type Highlight, type MaterialKey, type Variant } from '@/render/materials'
import { usePartContext } from '@/render/Part'
import { useView } from '@/render/view'

/**
 * An <instancedMesh> that behaves like <PartMesh>: it takes the enclosing Part's material,
 * highlight, x-ray, isolation and cut state, and selects the Part when clicked.
 * (Local copy — a shared version would belong in src/render.)
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

    const onClick = (e: ThreeEvent<MouseEvent>) => {
      if (!id) return
      e.stopPropagation()
      if (e.delta > 4) return
      select(id)
    }
    const onOver = (e: ThreeEvent<PointerEvent>) => {
      if (!id) return
      e.stopPropagation()
      hover(id)
    }
    const onOut = () => {
      if (id && useView.getState().hoveredId === id) hover(null)
    }

    return (
      <instancedMesh
        ref={ref}
        args={[undefined, undefined, count]}
        geometry={geometry}
        material={mat}
        visible={!isHidden && !outOfIsolation}
        castShadow={variant !== 'xray'}
        receiveShadow
        frustumCulled={false}
        onClick={onClick}
        onPointerOver={onOver}
        onPointerOut={onOut}
      />
    )
  },
)
