import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { box, extrude, lathe, mat4, merge, xform, type V2 } from '@/geometry'
import { cutPlanes } from '@/render/materials'
import { useView } from '@/render/view'

/** Shared 3D helpers for the water & irrigation scenes (M14). */

export type ParticleUpdate = (i: number, t: number, dt: number, out: THREE.Vector3) => number

/**
 * Free particles (rain, sprays, splash, wind-blown grains, vapour). `update` places particle i and
 * returns its scale 0…1 (0 hides it). Obeys the active cut like <Flow/>.
 */
export function Particles({ count, radius, color, update, emissive = 0.25, opacity = 0.9, stretch = 1 }: { count: number; radius: number; color: string; update: ParticleUpdate; emissive?: number; opacity?: number; stretch?: number }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const fn = useRef(update)
  fn.current = update
  const geo = useMemo(() => new THREE.SphereGeometry(1, 6, 5), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.5, transparent: opacity < 1, opacity })
    m.clippingPlanes = cutPlanes
    return m
  }, [color, emissive, opacity])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const p = useMemo(() => new THREE.Vector3(), [])
  useSimFrame((dt, t) => {
    const mesh = ref.current
    if (!mesh) return
    mat.clipIntersection = useView.getState().cut.intersection
    let any = false
    for (let i = 0; i < count; i++) {
      const s = fn.current(i, t, dt, p)
      if (s > 0.01) any = true
      tmp.position.copy(p)
      tmp.scale.set(radius * s, radius * s * stretch, radius * s)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    }
    mesh.visible = any
    mesh.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} />
}

/** Deterministic pseudo-random 0…1 from an integer (stable per particle). */
export const hash = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/** Half ellipse (below y = 0) of unit semi-axes extruded 1 m along +X from x = 0 — a wetting front under a furrow. */
export function halfEllipseBar() {
  const s = new THREE.Shape()
  const N = 20
  s.moveTo(-1, 0)
  for (let i = 1; i <= N; i++) {
    const a = Math.PI + (i / N) * Math.PI
    s.lineTo(Math.cos(a), Math.sin(a))
  }
  s.lineTo(-1, 0)
  return xform(extrude(s, 1, { curveSegments: 4 }), mat4.ry(Math.PI / 2))
}

/** Half ellipsoid of unit radius below y = 0 (onion-shaped wetted bulb once scaled). */
export function halfBulb() {
  const pts: V2[] = []
  const N = 14
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (Math.PI / 2)
    pts.push([Math.sin(a), -Math.cos(a)])
  }
  pts.push([0, 0])
  return lathe(pts, 24)
}

/** Crop plants (small cones) at the given ground positions, merged into one solid. */
export function plantsGeometry(pos: [number, number][], h: number, r: number, y0 = 0) {
  const one = lathe(
    [
      [0, 0],
      [r * 0.25, 0],
      [r, h * 0.45],
      [r * 0.6, h * 0.85],
      [0, h],
    ],
    6,
  )
  return merge(...pos.map(([x, z]) => xform(one, mat4.t(x, y0, z))))
}

/** A tree: trunk and crown, base at the origin. */
export function treeGeometry(h: number, crown: number) {
  const trunk = lathe(
    [
      [0, 0],
      [crown * 0.09, 0],
      [crown * 0.07, h * 0.45],
      [0, h * 0.45],
    ],
    8,
  )
  const c = lathe(
    [
      [0, h * 0.3],
      [crown * 0.55, h * 0.38],
      [crown * 0.5, h * 0.7],
      [crown * 0.3, h * 0.92],
      [0, h],
    ],
    10,
  )
  return { trunk, crown: c }
}

/** A thin depth marker bar (for a root-zone line or freeboard) of length L along X. */
export const lineBar = (L: number, t = 0.03) => box(L, t, t)

/** Short bullet list for panels. */
export function Bullets({ items, tone = 'text-ink/85' }: { items: ReactNode[]; tone?: string }) {
  return (
    <ul className={`ml-3 list-disc space-y-0.5 text-[11.5px] leading-snug ${tone}`}>
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}
