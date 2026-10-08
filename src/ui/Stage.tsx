import { CameraControls, Environment, Grid, Lightformer } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useRef } from 'react'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { SimClockDriver } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { CutController, CutPlaneHelpers } from '@/render/CutController'
import { useView } from '@/render/view'
import { setCameraControls } from './camera'
import { installDevBridge } from './devBridge'

function Lights({ extent }: { extent: number }) {
  const s = extent
  return (
    <>
      <hemisphereLight args={['#dfeee4', '#1b211d', 0.55]} />
      <directionalLight
        position={[s * 1.4, s * 2.2, s * 1.6]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-s * 1.4}
        shadow-camera-right={s * 1.4}
        shadow-camera-top={s * 1.4}
        shadow-camera-bottom={-s * 1.4}
        shadow-camera-near={0.01}
        shadow-camera-far={s * 8}
      />
      <directionalLight position={[-s * 2, s * 0.8, -s]} intensity={0.55} color="#bcd4ff" />
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 5, -2]} scale={[10, 2, 1]} rotation-x={Math.PI / 2} />
        <Lightformer form="rect" intensity={1.2} color="#e8f3ff" position={[-5, 1.5, 1]} scale={[3, 6, 1]} rotation-y={Math.PI / 2} />
        <Lightformer form="rect" intensity={0.9} color="#fff3e0" position={[5, 1, 2]} scale={[3, 5, 1]} rotation-y={-Math.PI / 2} />
        <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[2, 3, 6]} scale={2} />
        <Lightformer form="rect" intensity={0.4} color="#9bd17a" position={[0, -3, 0]} scale={[10, 10, 1]} rotation-x={-Math.PI / 2} />
      </Environment>
    </>
  )
}

function Floor({ y, extent }: { y: number; extent: number }) {
  return (
    <group position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[extent * 30, extent * 30]} />
        <shadowMaterial transparent opacity={0.32} />
      </mesh>
      <Grid
        position={[0, 0.0005, 0]}
        args={[extent * 20, extent * 20]}
        cellSize={extent / 20}
        cellThickness={0.6}
        cellColor="#26332c"
        sectionSize={extent / 4}
        sectionThickness={1}
        sectionColor="#34463b"
        fadeDistance={extent * 7}
        fadeStrength={1.5}
        infiniteGrid
      />
    </group>
  )
}

export function Stage({ scene }: { scene: SceneDef }) {
  const ref = useRef<CameraControlsImpl>(null)
  const select = useView((s) => s.select)

  useEffect(() => {
    setCameraControls(ref.current)
    return () => setCameraControls(null)
  }, [])

  const { position, target } = scene.camera
  // stable ref callback: set the initial pose once per scene, not on every re-render
  const attach = useCallback(
    (c: CameraControlsImpl | null) => {
      ref.current = c
      setCameraControls(c)
      if (c) void c.setLookAt(...position, ...target, false)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scene.id],
  )
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ fov: 32, near: scene.extent / 200, far: scene.extent * 60, position }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
      onPointerMissed={(e) => {
        if (e.type === 'click') select(null)
      }}
      onCreated={({ camera, scene: s3, gl }) => {
        camera.lookAt(...target)
        installDevBridge({ scene: s3, camera, gl })
      }}
      aria-label={`3D view: ${scene.title}`}
    >
      <color attach="background" args={['#0c110f']} />
      <fog attach="fog" args={['#0c110f', scene.extent * 6, scene.extent * 16]} />
      <SimClockDriver />
      <CutController hatchScale={scene.hatchScale ?? scene.extent / 220} />
      <Lights extent={scene.extent} />
      <Suspense fallback={null}>
        <scene.Viewport />
      </Suspense>
      <Floor y={scene.floorY ?? 0} extent={scene.extent} />
      <CutPlaneHelpers size={scene.extent * 1.2} />
      <CameraControls
        ref={attach}
        makeDefault
        minDistance={scene.extent * 0.15}
        maxDistance={scene.extent * 8}
        dollySpeed={0.6}
        smoothTime={0.35}
      />
    </Canvas>
  )
}
