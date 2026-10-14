import { useFrame, type ThreeElements, type ThreeEvent } from '@react-three/fiber'
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import type { Citation } from '@/content/citations'
import { faultsFor } from '@/content/faults'
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
  /** see-through in x-ray whatever the role (inherited) */
  xray?: boolean
  /** system colour (inherited), shown when the view colours by system */
  tint?: string
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
  /**
   * local offset applied at full explode. Without one, a part nested in another part is pushed
   * out from its parent's centre automatically; pass `false` to keep it in place.
   */
  explode?: [number, number, number] | false
  /** force sectioning on/off for this part and its children */
  cut?: boolean
  /**
   * go see-through in x-ray even if not a housing (e.g. liners and coolant that hide the pistons);
   * null puts this branch back to the default (housings only)
   */
  xray?: boolean | null
  /** system colour for this part and everything in it (colour-by-system views) */
  tint?: string
  children?: ReactNode
}

/**
 * A named, inspectable component of an assembly. Nest Parts to build the assembly tree
 * shown in the parts panel. Geometry goes in <PartMesh/> children.
 */
export function Part({ id, name, material, role, info, cites, beyondNotes, explode, cut, xray, tint, children, ...group }: PartProps) {
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
      xray: xray === null ? undefined : (xray ?? parent.xray),
      tint: tint ?? parent.tint,
    }),
    [id, parent.path, parent.material, parent.role, parent.cut, parent.xray, parent.tint, material, role, cut, xray, tint],
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

  const auto = useRef<[number, number, number] | null>(null)
  useFrame((_, dt) => {
    const g = inner.current
    if (!g || explode === false) return
    // with a scope set, only that assembly's sub-parts move
    const st = useView.getState()
    const depth = st.explodeScope ? ctx.path.length - 1 - ctx.path.indexOf(st.explodeScope) : 0
    const inScope = !!st.explodeScope && ctx.path.includes(st.explodeScope) && id !== st.explodeScope && (st.explodeDepth === null || depth <= st.explodeDepth)
    const target = st.explodeScope ? (inScope ? st.explode : 0) : st.explode
    let e = explode
    if (!e) {
      // nothing to do until the view is exploded (or still easing back)
      if (target <= 0 && g.position.lengthSq() < 1e-10) return
      // top-level parts (grounds, landscapes, whole machines) stay where they are
      if (!parent.id) return
      auto.current ??= autoExplode(outer.current, partObjects.get(parent.id))
      e = auto.current
    }
    const k = 1 - Math.exp(-dt * 10)
    g.position.x += (e[0] * target - g.position.x) * k
    g.position.y += (e[1] * target - g.position.y) * k
    g.position.z += (e[2] * target - g.position.z) * k
  })

  return (
    <group ref={outer} {...group}>
      <group ref={inner}>
        <Ctx.Provider value={ctx}>{children}</Ctx.Provider>
      </group>
    </group>
  )
}

const _cb = new THREE.Box3()
const _tb = new THREE.Box3()
const _pb = new THREE.Box3()
const _cc = new THREE.Vector3()
const _pc = new THREE.Vector3()
const _cs = new THREE.Vector3()
const _ps = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

/**
 * Default exploded-view offset: away from the parent assembly's centre, a quarter of its size
 * (nested offsets add up, so it stays modest). Parts nearly as big as their parent (housings, ground slabs) and parts centred on it
 * (shafts on the axis) stay put. Computed once, in the parent's frame at the moment of the call.
 */
function autoExplode(part: THREE.Object3D | null, parentObj: THREE.Object3D | undefined): [number, number, number] {
  if (!part || !parentObj || !part.parent) return [0, 0, 0]
  _cb.setFromObject(part)
  _pb.makeEmpty()
  _pb.union(_tb.setFromObject(parentObj))
  if (_cb.isEmpty() || _pb.isEmpty()) return [0, 0, 0]
  _cb.getCenter(_cc)
  _pb.getCenter(_pc)
  _cb.getSize(_cs)
  _pb.getSize(_ps)
  const pSize = Math.max(_ps.x, _ps.y, _ps.z)
  if (Math.max(_cs.x, _cs.y, _cs.z) > 0.85 * pSize) return [0, 0, 0]
  const dir = _cc.sub(_pc)
  if (dir.length() < 0.02 * pSize) return [0, 0, 0]
  // never push down: parts below the assembly centre would sink into the floor or the ground
  if (dir.y < 0) dir.y = 0
  if (dir.length() < 0.02 * pSize) return [0, 0, 0]
  dir.normalize().multiplyScalar(0.25 * pSize)
  // into the frame the offset is applied in (the part's parent object)
  part.parent.getWorldQuaternion(_q).invert()
  part.parent.getWorldScale(_s)
  dir.applyQuaternion(_q).divide(_s)
  return [dir.x, dir.y, dir.z]
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
  const faultMode = useView((s) => s.faultMode)
  const tints = useView((s) => s.tints)
  const partName = useParts((s) => (id ? s.parts[id]?.name : undefined))
  const faulty = useMemo(() => !!id && !!partName && faultsFor({ id, name: partName }).length > 0, [id, partName])

  const isHidden = ctx.path.some((p) => hidden.includes(p))
  const outOfIsolation = isolatedId !== null && !ctx.path.includes(isolatedId)
  const visible = !isHidden && !outOfIsolation

  const sectioned =
    cut.enabled &&
    (ctx.cut === true || (ctx.cut !== false && (ctx.role === 'housing' || ctx.role === 'static' || ctx.role === 'fluid' || cut.sectionMoving)))

  const variant: Variant = xray && (ctx.xray ?? ctx.role === 'housing') ? 'xray' : sectioned ? 'cut' : 'solid'
  const highlight: Highlight = selectedId && ctx.path.includes(selectedId) ? 'select' : hoveredId === id || (faultMode && faulty) ? 'hover' : 'none'
  const mat = customMaterial ?? getMaterial(material ?? ctx.material, { variant, highlight, intersection: cut.intersection, tint: tints ? ctx.tint : undefined })

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
    
    const view = useView.getState()
    if (view.caliperMode) {
      const p = e.point
      let nextPts = [...view.caliperPoints, [p.x, p.y, p.z] as [number, number, number]]
      if (nextPts.length > 2) nextPts = [nextPts[nextPts.length - 1]]
      view.setCaliperPoints(nextPts)
      return
    }
    
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
