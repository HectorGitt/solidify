import { Html } from '@/render/Html'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { useView } from '@/render/view'

export interface ArrowSpec {
  /** tail (or head, with `toward`) position */
  origin: THREE.Vector3
  /** direction (need not be unit) */
  dir: THREE.Vector3
  /** length in metres */
  length: number
  /** draw the arrow pointing AT origin (head at origin) instead of away from it */
  toward?: boolean
  label?: string
  visible?: boolean
}

const Y = new THREE.Vector3(0, 1, 0)

/**
 * A force (or velocity) vector: shaft + cone, with an optional floating label at the tip.
 * Not a Part: it is an annotation, never sectioned or selected. `spec()` is polled every frame,
 * so arrows follow live values without React state.
 */
export function ForceArrow({ spec, color, radius = 0.004, labelEvery = 6 }: { spec: () => ArrowSpec; color: string; radius?: number; labelEvery?: number }) {
  const group = useRef<THREE.Group>(null)
  const shaft = useRef<THREE.Mesh>(null)
  const head = useRef<THREE.Mesh>(null)
  const labelAnchor = useRef<THREE.Group>(null)
  const labelEl = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.1 }), [color])
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 12), [])
  const cone = useMemo(() => new THREE.ConeGeometry(1, 1, 16), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const d = useMemo(() => new THREE.Vector3(), [])

  useSimFrame(() => {
    const s = spec()
    const g = group.current
    if (!g) return
    const show = (s.visible ?? true) && s.length > 1e-5
    g.visible = show
    if (!show) return
    d.copy(s.dir).normalize()
    q.setFromUnitVectors(Y, d)
    const headL = Math.min(s.length * 0.4, radius * 7)
    const tail = s.toward ? s.origin.clone().addScaledVector(d, -s.length) : s.origin.clone()
    g.position.copy(tail)
    g.quaternion.copy(q)
    if (shaft.current) {
      shaft.current.scale.set(radius, Math.max(1e-5, s.length - headL), radius)
      shaft.current.position.set(0, (s.length - headL) / 2, 0)
    }
    if (head.current) {
      head.current.scale.set(radius * 2.6, headL, radius * 2.6)
      head.current.position.set(0, s.length - headL / 2, 0)
    }
    if (labelAnchor.current) labelAnchor.current.position.set(0, s.length + radius * 4, 0)
    if (labelEl.current && frame.current++ % labelEvery === 0) {
      labelEl.current.textContent = s.label ?? ''
      labelEl.current.style.display = s.label ? '' : 'none'
    }
  })

  const labels = useView((s) => s.labels)
  return (
    <group ref={group}>
      <mesh ref={shaft} geometry={cyl} material={mat} renderOrder={5} />
      <mesh ref={head} geometry={cone} material={mat} renderOrder={5} />
      <group ref={labelAnchor}>
        <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }} center>
          <div ref={labelEl} className="part-label" style={{ color, borderColor: color, opacity: labels ? 1 : 0.92, whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }} />
        </Html>
      </group>
    </group>
  )
}

/** A thin circle (pitch circle, base circle …) drawn as a closed line in the XY plane. */
export function circlePoints(r: number, n = 128, z = 0): [number, number, number][] {
  const pts: [number, number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n
    pts.push([r * Math.cos(a), r * Math.sin(a), z])
  }
  return pts
}
