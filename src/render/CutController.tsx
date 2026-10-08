import { Line, PivotControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { capUniforms, cutPlanes, syncCapUniforms } from './materials'
import { useView } from './view'

/** Keeps the shared THREE.Plane array and cap uniforms in step with the view store. */
export function CutController({ hatchScale = 0.004 }: { hatchScale?: number }) {
  const gl = useThree((s) => s.gl)
  const cut = useView((s) => s.cut)

  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])

  useEffect(() => {
    capUniforms.uHatchScale.value = hatchScale
  }, [hatchScale])

  useEffect(() => {
    const planes = cut.enabled ? cut.planes : []
    cutPlanes.length = planes.length
    planes.forEach((p, i) => {
      // kept side: −n·x + pos ≥ 0
      const n = new THREE.Vector3(...p.normal).normalize()
      if (!cutPlanes[i]) cutPlanes[i] = new THREE.Plane()
      cutPlanes[i].set(n.clone().negate(), p.pos)
    })
  }, [cut])

  useFrame(({ camera }) => syncCapUniforms(camera, cut.intersection), -50)
  return null
}

/** Faint outline of each active cut plane, so users can see where the section is. */
export function CutPlaneHelpers({ size = 1, color = '#f5b942' }: { size?: number; color?: string }) {
  const cut = useView((s) => s.cut)
  const show = useView((s) => s.showPlanes)
  const setPlane = useView((s) => s.setPlane)
  const pts = useMemo(() => {
    const h = size / 2
    return [
      [-h, -h, 0],
      [h, -h, 0],
      [h, h, 0],
      [-h, h, 0],
      [-h, -h, 0],
    ] as [number, number, number][]
  }, [size])
  
  if (!cut.enabled || !show) return null
  return (
    <group>
      {cut.planes.map((p, i) => {
        const n = new THREE.Vector3(...p.normal).normalize()
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), n)
        const pos = n.clone().multiplyScalar(p.pos)
        
        const m = new THREE.Matrix4().compose(pos, q, new THREE.Vector3(1, 1, 1))
        return (
          <PivotControls
            key={i}
            matrix={m}
            autoTransform={false}
            scale={size * 0.35}
            activeAxes={[true, true, true]}
            depthTest={false}
            onDrag={(_l, _dl, w, _dw) => {
              const position = new THREE.Vector3()
              const quaternion = new THREE.Quaternion()
              const scale = new THREE.Vector3()
              w.decompose(position, quaternion, scale)
              
              const newNormal = new THREE.Vector3(0, 0, 1).applyQuaternion(quaternion).normalize()
              const newPos = position.dot(newNormal)
              
              setPlane(i, { normal: [newNormal.x, newNormal.y, newNormal.z], pos: newPos })
            }}
          >
            <group position={pos} quaternion={q}>
              <Line points={pts} color={color} lineWidth={1} dashed dashSize={size / 40} gapSize={size / 60} transparent opacity={0.5} />
            </group>
          </PivotControls>
        )
      })}
    </group>
  )
}
