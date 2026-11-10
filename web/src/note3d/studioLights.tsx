import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'

/**
 * The studio lighting of a model shown on its own (a Read notes figure, the .slfy viewer): Stage's lighting rig
 * with a light that follows the camera. Kept apart from the figure code so the standalone viewer can use it
 * without pulling in the lab rigs.
 */
function InlineHeadLight() {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const l = light.current
    if (!l) return
    camera.getWorldDirection(target).add(camera.position)
    l.position.copy(camera.position)
    l.target.position.copy(target)
    if (!l.target.parent) l.parent?.add(l.target)
    l.target.updateMatrixWorld()
  })
  return <directionalLight ref={light} intensity={0.7} color="#fff8f0" />
}

export function InlineStudioLights({ extent }: { extent: number }) {
  const s = Math.max(0.2, extent)
  const half = 1.4 * s
  const texel = (2 * half) / 2048
  const offset = useMemo(
    () => new THREE.Vector3(1.4, 2.2, 1.6).normalize().multiplyScalar(Math.max(s * 3, half * 3)),
    [s, half],
  )
  return (
    <>
      {/* Exact natural lighting rig from Stage.tsx */}
      <hemisphereLight args={['#ffffff', '#5b6470', 0.65]} />
      <InlineHeadLight />
      <directionalLight
        position={[offset.x, offset.y, offset.z]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0002}
        shadow-normalBias={texel * 1.5}
        shadow-camera-left={-half}
        shadow-camera-right={half}
        shadow-camera-top={half}
        shadow-camera-bottom={-half}
        shadow-camera-near={0.01}
        shadow-camera-far={offset.length() + half * 3}
      />
      <directionalLight position={[-s * 2, s * 0.8, -s]} intensity={0.55} color="#bcd4ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 5, -2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} color="#e8f3ff" position={[-5, 1.5, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.9} color="#fff3e0" position={[5, 1, 2]} scale={[3, 5, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[2, 3, 6]} scale={2} />
        <Lightformer form="rect" intensity={0.25} color="#10b981" position={[0, -3, 0]} scale={[10, 10, 1]} rotation-x={-Math.PI / 2} />
        {/* panels behind and below as well, so metal reflects something from every side */}
        <Lightformer form="rect" intensity={1.0} color="#f2f6ff" position={[0, 2, -6]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={0.7} color="#fff6ea" position={[-4, 2, -4]} scale={[3, 5, 1]} rotation-y={Math.PI / 4} />
        <Lightformer form="rect" intensity={0.45} color="#dfe6ee" position={[0, -2.5, 0]} scale={[12, 12, 1]} rotation-x={-Math.PI / 2} />
      </Environment>
    </>
  )
}
