import { Html } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { Citation } from '@/content/citations'
import { useSimFrame } from '@/core/sim'
import { box, cylinder } from '@/geometry'
import { adjustableDrawbar } from '@/parts/lib/chassis'
import { Part, PartMesh } from '@/render/Part'

/** Per-frame state of a force arrow, in the parent frame (XY plane, angle from +X). */
export interface ArrowState {
  x: number
  y: number
  z: number
  /** direction, radians from +X towards +Y */
  angle: number
  /** length in metres (≤ 0 hides it) */
  length: number
  /** true: the tip sits on (x, y) (a force acting on a point); false: the tail does */
  tipAt?: boolean
  color?: string
}

const SHAFT = (() => {
  const c = new THREE.CylinderGeometry(1, 1, 1, 12)
  c.rotateZ(-Math.PI / 2)
  c.translate(0.5, 0, 0)
  return c
})()
const HEAD = (() => {
  const c = new THREE.ConeGeometry(1, 1, 16)
  c.rotateZ(-Math.PI / 2)
  c.translate(0.5, 0, 0)
  return c
})()

/** A force arrow whose position, direction and length are set every frame by `get`. */
export function ForceArrow({ get, color, radius = 0.02, onTop = false }: { get: (s: ArrowState) => void; color: string; radius?: number; onTop?: boolean }) {
  const g = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const mat = useMemo(() => new THREE.MeshBasicMaterial({ color, toneMapped: false, depthTest: !onTop, transparent: onTop }), [color, onTop])
  const s = useMemo<ArrowState>(() => ({ x: 0, y: 0, z: 0, angle: 0, length: 0 }), [])
  useSimFrame(() => {
    s.tipAt = false
    s.color = undefined
    get(s)
    const G = g.current
    if (!G || !shaft.current || !head.current) return
    const L = s.length
    G.visible = L > 1e-3
    if (!G.visible) return
    if (s.color) mat.color.set(s.color)
    else mat.color.set(color)
    G.position.set(s.x, s.y, s.z)
    G.rotation.set(0, 0, s.angle)
    const hl = Math.min(radius * 6, L * 0.5)
    const start = s.tipAt ? -L : 0
    shaft.current.position.x = start
    shaft.current.scale.set(Math.max(1e-4, L - hl), radius, radius)
    head.current.position.x = start + L - hl
    head.current.scale.set(hl, radius * 2.6, radius * 2.6)
  })
  return (
    <group ref={g}>
      <mesh ref={shaft} geometry={SHAFT} material={mat} renderOrder={onTop ? 10 : 0} />
      <mesh ref={head} geometry={HEAD} material={mat} renderOrder={onTop ? 10 : 0} />
    </group>
  )
}

/** A floating value tag whose text and position are set every frame. */
export function LiveTag({ get }: { get: () => { text: string; x: number; y: number; z: number; warn?: boolean } | null }) {
  const g = useRef<THREE.Group>(null)
  const div = useRef<HTMLDivElement>(null)
  useSimFrame(() => {
    const v = get()
    if (!g.current || !div.current) return
    g.current.visible = !!v
    div.current.style.display = v ? '' : 'none'
    if (!v) return
    g.current.position.set(v.x, v.y, v.z)
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

/** Flat field slab with its top at y = 0. */
export function Ground({ length = 9, width = 4, x = 0, depth = 0.06, cut = false, cites, id = 'ground' }: { length?: number; width?: number; x?: number; depth?: number; cut?: boolean; cites?: Citation[]; id?: string }) {
  const geo = useMemo(() => {
    const g = box(length, depth, width)
    g.translate(x, -depth / 2, 0)
    return g
  }, [length, width, x, depth])
  return (
    <Part id={id} name="Ground" role="static" material="soil" info={{ summary: 'Field surface.', role: 'Carries the wheel reactions Vf and Vr and provides the traction H at the rear tyres.' }} cites={cites} cut={cut}>
      <PartMesh geometry={geo} />
    </Part>
  )
}

/**
 * Adjustable drawbar (replaces the shared tractor's fixed one so y′ and x′ can be changed):
 * a bar from under the centre housing to the pin, with a hanger strap. Geometry is rebuilt when
 * x′ / y′ change (cheap).
 */
export function AdjustableDrawbar({ xd, yd, id = 'drawbar', cites }: { xd: number; yd: number; id?: string; cites?: Citation[] }) {
  const g = useMemo(() => adjustableDrawbar(xd, yd), [xd, yd])
  return (
    <Part
      id={id}
      name="Drawbar"
      role="static"
      material="forged"
      info={{ summary: 'Drawbar (adjustable here).', role: 'Single-point hitch. The pull acts at its pin, a height y′ above the ground and x′ behind the rear-wheel contact point; both set how much weight moves from the front to the rear axle.', details: 'The shared tractor’s fixed drawbar is hidden in this scene and replaced by this one so y′ and x′ can be varied.' }}
      cites={cites}
      cut={false}
    >
      <PartMesh geometry={g.beam} />
      <PartMesh geometry={g.hanger} />
      <PartMesh geometry={g.pin} material="chrome" />
    </Part>
  )
}

/** Oriented thin rod between two points in the XY plane (chain / hitch line). */
export function Rod({ from, to, r = 0.015, material = 'steelDark' as const }: { from: [number, number, number]; to: [number, number, number]; r?: number; material?: 'steelDark' | 'steel' | 'forged' | 'galvanised' }) {
  const geo = useMemo(() => {
    const a = new THREE.Vector3(...from)
    const b = new THREE.Vector3(...to)
    const d = new THREE.Vector3().subVectors(b, a)
    const c = cylinder(r, d.length(), 10)
    c.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()))
    c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    return c
  }, [from, to, r])
  return <PartMesh geometry={geo} material={material} />
}
