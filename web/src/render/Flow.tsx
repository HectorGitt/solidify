import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSimFrame } from '@/core/sim'
import { cutPlanes } from './materials'
import { useView } from './view'

export interface FlowProps {
  /** path the particles follow (world/parent space) */
  curve: THREE.Curve<THREE.Vector3>
  count?: number
  radius?: number
  color: string
  /** 0…1 each frame; 0 stops the flow and hides it */
  intensity: () => number
  /** path lengths per sim-second at intensity 1 */
  speed?: number
  /** random spread across the path, as a fraction of `spread` */
  spread?: number
  emissive?: number
}

/**
 * Instanced particles flowing along a curve. Used for air, exhaust, oil, coolant, fuel and crop.
 * Particles respect the active cut so they read correctly in section.
 */
export function Flow({ curve, count = 60, radius = 0.003, color, intensity, speed = 1, spread = 0.006, emissive = 0.6 }: FlowProps) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const xray = useView((s) => s.xray)
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        t: i / count,
        off: new THREE.Vector3((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread),
        s: 0.7 + Math.random() * 0.6,
      })),
    [count, spread],
  )
  const geo = useMemo(() => new THREE.SphereGeometry(1, 8, 6), [])
  const mat = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: emissive, roughness: 0.4, transparent: true, opacity: 0.9 })
    m.clippingPlanes = cutPlanes
    return m
  }, [color, emissive])
  const tmp = useMemo(() => new THREE.Object3D(), [])
  const p = useMemo(() => new THREE.Vector3(), [])

  useSimFrame((dt) => {
    const mesh = ref.current
    if (!mesh) return
    const k = Math.max(0, Math.min(1, intensity()))
    mesh.visible = k > 0.02
    mat.clipIntersection = useView.getState().cut.intersection
    if (!mesh.visible) return
    mat.depthTest = !xray
    for (let i = 0; i < seeds.length; i++) {
      const sd = seeds[i]
      sd.t = (sd.t + dt * speed * k * sd.s) % 1
      curve.getPointAt(sd.t, p)
      tmp.position.copy(p).add(sd.off)
      const fade = Math.min(1, sd.t * 8, (1 - sd.t) * 8)
      tmp.scale.setScalar(radius * (0.5 + 0.5 * k) * fade)
      tmp.updateMatrix()
      mesh.setMatrixAt(i, tmp.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  })

  // userData.effect: not part of the machine's size (the headset sizes a machine by what it is drawn with;
  // before its first frame every particle is the unit sphere at the origin, 2 m across)
  return <instancedMesh ref={ref} args={[geo, mat, count]} frustumCulled={false} renderOrder={xray ? 10 : 0} userData={{ effect: true }} />
}
