import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'

/**
 * Construction-line helpers shared by the linkage, draft-control and PTO-shaft scenes:
 * a segment between two points, an arrow and a marker dot, all updated every frame from a
 * callback (no React state). Unlit, not clipped by section planes.
 */
const UP = new THREE.Vector3(0, 1, 0)
const tmp = new THREE.Vector3()

export type V3 = [number, number, number]

export function Seg({ get, radius = 0.006, color, opacity = 1 }: { get: () => [V3, V3] | null; radius?: number; color: string; opacity?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1), [])
  useSimFrame(() => {
    const m = ref.current
    if (!m) return
    const p = get()
    if (!p) {
      m.visible = false
      return
    }
    const a = new THREE.Vector3(...p[0])
    const b = new THREE.Vector3(...p[1])
    tmp.subVectors(b, a)
    const L = tmp.length()
    if (!(L > 1e-6) || !Number.isFinite(L)) {
      m.visible = false
      return
    }
    m.visible = true
    m.position.copy(a).addScaledVector(tmp, 0.5)
    m.quaternion.setFromUnitVectors(UP, tmp.normalize())
    m.scale.set(radius, L, radius)
  })
  return (
    <mesh ref={ref} geometry={geo} frustumCulled={false} renderOrder={2}>
      <meshBasicMaterial color={color} toneMapped={false} transparent={opacity < 1} opacity={opacity} depthTest={opacity >= 1} />
    </mesh>
  )
}

/** Arrow from `from` along `dir` with length `len` (m); hidden when len ≈ 0. */
export function Arrow({ get, color, radius = 0.012 }: { get: () => { from: V3; dir: V3; len: number } | null; color: string; radius?: number }) {
  const shaft = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const g = useMemo(() => ({ c: new THREE.CylinderGeometry(1, 1, 1, 10, 1), h: new THREE.ConeGeometry(1, 1, 14) }), [])
  useSimFrame(() => {
    const s = shaft.current
    const h = head.current
    if (!s || !h) return
    const a = get()
    const ok = !!a && a.len > 1e-4 && Number.isFinite(a.len)
    s.visible = h.visible = ok
    if (!ok || !a) return
    const d = new THREE.Vector3(...a.dir).normalize()
    const hl = Math.min(a.len * 0.4, radius * 7)
    const o = new THREE.Vector3(...a.from)
    const sl = Math.max(1e-4, a.len - hl)
    s.position.copy(o).addScaledVector(d, sl / 2)
    s.quaternion.setFromUnitVectors(UP, d)
    s.scale.set(radius, sl, radius)
    h.position.copy(o).addScaledVector(d, sl + hl / 2)
    h.quaternion.setFromUnitVectors(UP, d)
    h.scale.set(radius * 3, hl, radius * 3)
  })
  return (
    <group>
      <mesh ref={shaft} geometry={g.c} frustumCulled={false}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh ref={head} geometry={g.h} frustumCulled={false}>
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  )
}

export function Dot({ get, color, radius = 0.03 }: { get: () => V3 | null; color: string; radius?: number }) {
  const ref = useRef<THREE.Mesh>(null)
  useSimFrame(() => {
    const m = ref.current
    if (!m) return
    const p = get()
    m.visible = !!p && p.every(Number.isFinite)
    if (p && m.visible) m.position.set(...p)
  })
  return (
    <mesh ref={ref} frustumCulled={false} renderOrder={3}>
      <sphereGeometry args={[radius, 20, 14]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

/** Orient a group so its local +X runs from a to b (scaling X to the length when `stretch`). */
export function orientX(o: THREE.Object3D | null, a: THREE.Vector3, b: THREE.Vector3, stretch = false) {
  if (!o) return
  tmp.subVectors(b, a)
  const L = tmp.length()
  o.position.copy(a)
  o.quaternion.setFromUnitVectors(X_AXIS, tmp.normalize())
  if (stretch) o.scale.set(L, 1, 1)
}
const X_AXIS = new THREE.Vector3(1, 0, 0)
