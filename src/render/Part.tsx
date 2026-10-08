import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Citation } from '@/content/citations'
import { nextOrder, partObjects, useParts, type PartInfo, type PartRole } from '@/parts/registry'
import { getMaterial, type Highlight, type MaterialKey, type Variant } from './materials'
import { isKept, useView } from './view'

interface PartCtx {
  id: string | null
  path: string[]
  material: MaterialKey
  role: PartRole
  /** explicit cut override inherited from ancestors */
  cut?: boolean
}

const Ctx = createContext<PartCtx>({ id: null, path: [], material: 'steel', role: 'static' })
export const usePartContext = () => useContext(Ctx)

type GroupProps = ThreeElements['group']

export interface PartProps extends Omit<GroupProps, 'id'> {
  id: string
  name: string
  material?: MaterialKey
  role?: PartRole
  info?: PartInfo
  cites?: Citation[]
  beyondNotes?: boolean
  /** local offset applied at full explode */
  explode?: [number, number, number]
  /** force sectioning on/off for this part and its children */
  cut?: boolean
  children?: ReactNode
}

/**
 * A named, inspectable component of an assembly. Nest Parts to build the assembly tree
 * shown in the parts panel. Geometry goes in <PartMesh/> children.
 */
export function Part({ id, name, material, role, info, cites, beyondNotes, explode, cut, children, ...group }: PartProps) {
  const parent = useContext(Ctx)
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const register = useParts((s) => s.register)
  const unregister = useParts((s) => s.unregister)
  const order = useMemo(() => nextOrder(), [])

  const ctx = useMemo<PartCtx>(
    () => ({
      id,
      path: [...parent.path, id],
      material: material ?? parent.material,
      role: role ?? parent.role,
      cut: cut ?? parent.cut,
    }),
    [id, parent.path, parent.material, parent.role, parent.cut, material, role, cut],
  )

  useLayoutEffect(() => {
    register({ id, name, parentId: parent.id, material: ctx.material, role: ctx.role, info, cites, beyondNotes, order })
    if (outer.current) partObjects.set(id, outer.current)
    return () => {
      unregister(id)
      partObjects.delete(id)
    }
    // info/cites are static content; re-register only on identity changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, name, parent.id, ctx.material, ctx.role])

  useFrame((_, dt) => {
    if (!explode || !inner.current) return
    const target = useView.getState().explode
    const g = inner.current
    const k = 1 - Math.exp(-dt * 10)
    g.position.x += (explode[0] * target - g.position.x) * k
    g.position.y += (explode[1] * target - g.position.y) * k
    g.position.z += (explode[2] * target - g.position.z) * k
  })

  return (
    <group ref={outer} {...group}>
      <group ref={inner}>
        <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
      </group>
    </group>
  )
}

type MeshProps = ThreeElements['mesh']

export interface PartMeshProps extends Omit<MeshProps, 'material'> {
  geometry: THREE.BufferGeometry
  material?: MaterialKey
  /** custom material (e.g. animated gas colour); still receives cut planes if `clipped` */
  customMaterial?: THREE.Material
}

/** A mesh belonging to the nearest enclosing <Part/>, with view-state aware material. */
export function PartMesh({ geometry, material, customMaterial, ...rest }: PartMeshProps) {
  const ctx = useContext(Ctx)
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
  const visible = !isHidden && !outOfIsolation

  const sectioned =
    cut.enabled &&
    (ctx.cut === true || (ctx.cut !== false && (ctx.role === 'housing' || ctx.role === 'static' || ctx.role === 'fluid' || cut.sectionMoving)))

  const variant: Variant = xray && ctx.role === 'housing' ? 'xray' : sectioned ? 'cut' : 'solid'
  const highlight: Highlight = selectedId && ctx.path.includes(selectedId) ? 'select' : hoveredId === id ? 'hover' : 'none'
  const mat = customMaterial ?? getMaterial(material ?? ctx.material, { variant, highlight, intersection: cut.intersection })

  const raycast = useMemo(() => {
    if (variant !== 'cut') return undefined
    const cutState = cut
    return function (this: THREE.Mesh, raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
      const tmp: THREE.Intersection[] = []
      THREE.Mesh.prototype.raycast.call(this, raycaster, tmp)
      for (const hit of tmp) if (isKept(hit.point, cutState)) intersects.push(hit)
    }
  }, [variant, cut])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!id) return
    e.stopPropagation()
    if (e.delta > 4) return // was a drag
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
    <mesh
      geometry={geometry}
      material={mat}
      visible={visible}
      castShadow={variant !== 'xray'}
      receiveShadow
      raycast={raycast ?? THREE.Mesh.prototype.raycast}
      onClick={onClick}
      onPointerOver={onOver}
      onPointerOut={onOut}
      {...rest}
    />
  )
}
