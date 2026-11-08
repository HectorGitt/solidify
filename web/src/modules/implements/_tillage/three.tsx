import { Html } from '@/render/Html'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'

/**
 * Small per-frame overlay helpers for the tillage and planting scenes (lines, markers, arrows and
 * live tags). They draw with unlit materials and are not Parts, so they never get sectioned.
 */

export type V3 = [number, number, number]

const UNIT_CYL = (() => {
  const c = new THREE.CylinderGeometry(1, 1, 1, 10)
  c.translate(0, 0.5, 0)
  return c
})()
const UNIT_CONE = (() => {
  const c = new THREE.ConeGeometry(1, 1, 14)
  c.translate(0, 0.5, 0)
  return c
})()
const UNIT_SPHERE = new THREE.SphereGeometry(1, 16, 12)
const Y = new THREE.Vector3(0, 1, 0)

function useBasic(color: string, onTop: boolean, opacity = 1) {
  return useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: !onTop, transparent: onTop || opacity < 1, opacity }), [color, onTop, opacity])
}

/** A straight line (thin rod) between two points set every frame. Return null to hide. */
export function Segment({ get, color, radius = 0.006, onTop = false, opacity = 1 }: { get: (a: THREE.Vector3, b: THREE.Vector3) => boolean | void; color: string; radius?: number; onTop?: boolean; opacity?: number }) {
  const m = useRef<THREE.Mesh>(null)
  const mat = useBasic(color, onTop, opacity)
  const s = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3() }), [])
  useSimFrame(() => {
    const mesh = m.current
    if (!mesh) return
    const ok = get(s.a, s.b)
    s.d.subVectors(s.b, s.a)
    const L = s.d.length()
    mesh.visible = ok !== false && L > 1e-4
    if (!mesh.visible) return
    mesh.position.copy(s.a)
    mesh.quaternion.setFromUnitVectors(Y, s.d.multiplyScalar(1 / L))
    mesh.scale.set(radius, L, radius)
  })
  return <mesh ref={m} geometry={UNIT_CYL} material={mat} renderOrder={onTop ? 10 : 0} />
}

/** A dot whose position is set every frame. */
export function Dot({ get, color, radius = 0.03, onTop = false }: { get: (p: THREE.Vector3) => boolean | void; color: string; radius?: number; onTop?: boolean }) {
  const m = useRef<THREE.Mesh>(null)
  const mat = useBasic(color, onTop)
  const p = useMemo(() => new THREE.Vector3(), [])
  useSimFrame(() => {
    if (!m.current) return
    const ok = get(p)
    m.current.visible = ok !== false
    m.current.position.copy(p)
    m.current.scale.setScalar(radius)
  })
  return <mesh ref={m} geometry={UNIT_SPHERE} material={mat} renderOrder={onTop ? 10 : 0} />
}

/** Force arrow from `from` along `dir` with length `len` (all set every frame; len ≤ 0 hides). */
export function Arrow({ get, color, radius = 0.015, onTop = true }: { get: (from: THREE.Vector3, dir: THREE.Vector3) => number; color: string; radius?: number; onTop?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const mat = useBasic(color, onTop)
  const s = useMemo(() => ({ a: new THREE.Vector3(), d: new THREE.Vector3(1, 0, 0) }), [])
  useSimFrame(() => {
    if (!g.current || !shaft.current || !head.current) return
    const L = get(s.a, s.d)
    g.current.visible = L > 1e-3 && s.d.lengthSq() > 1e-9
    if (!g.current.visible) return
    g.current.position.copy(s.a)
    g.current.quaternion.setFromUnitVectors(Y, s.d.normalize())
    const hl = Math.min(radius * 6, L * 0.45)
    shaft.current.scale.set(radius, L - hl, radius)
    head.current.position.y = L - hl
    head.current.scale.set(radius * 2.6, hl, radius * 2.6)
  })
  return (
    <group ref={g}>
      <mesh ref={shaft} geometry={UNIT_CYL} material={mat} renderOrder={onTop ? 10 : 0} />
      <mesh ref={head} geometry={UNIT_CONE} material={mat} renderOrder={onTop ? 10 : 0} />
    </group>
  )
}

/** A floating value tag whose text and position are set every frame (null hides). */
export function LiveTag({ get }: { get: () => { text: string; at: V3; warn?: boolean } | null }) {
  const g = useRef<THREE.Group>(null)
  const div = useRef<HTMLDivElement>(null)
  useSimFrame(() => {
    const v = get()
    if (!g.current || !div.current) return
    g.current.visible = !!v
    div.current.style.display = v ? '' : 'none'
    if (!v) return
    g.current.position.set(v.at[0], v.at[1], v.at[2])
    if (div.current.textContent !== v.text) div.current.textContent = v.text
    div.current.style.color = v.warn ? '#ff8a7a' : ''
  })
  return (
    <group ref={g}>
      <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
        <div ref={div} className="part-label" style={{ whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }} />
      </Html>
    </group>
  )
}

/**
 * Instanced spheres (seeds, clods) whose positions are written every frame by `update`, which
 * returns how many are in use.
 */
export function Particles({ max, radius, color, update, scaleY = 1 }: { max: number; radius: number; color: string; update: (m: THREE.Matrix4, set: (i: number, x: number, y: number, z: number, s?: number) => void) => number; scaleY?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7 }), [color])
  const m = useMemo(() => new THREE.Matrix4(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const pos = useMemo(() => new THREE.Vector3(), [])
  useSimFrame(() => {
    const im = ref.current
    if (!im) return
    const set = (i: number, x: number, y: number, z: number, s = 1) => {
      pos.set(x, y, z)
      sc.set(radius * s, radius * s * scaleY, radius * s)
      m.compose(pos, q, sc)
      im.setMatrixAt(i, m)
    }
    const n = Math.min(max, update(m, set))
    im.count = n
    im.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[UNIT_SPHERE, mat, max]} frustumCulled={false} castShadow />
}
