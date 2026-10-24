import { CameraControls, ContactShadows, Environment, Grid, Lightformer, Html, Line } from '@react-three/drei'
import { Canvas, useFrame } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef } from 'react'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { SimClockDriver } from '@/core/sim'
import type { CameraPose, SceneDef } from '@/modules/types'
import { CutController, CutPlaneHelpers } from '@/render/CutController'
import { HoverTelemetry } from '@/render/Telemetry'
import { InsideHider } from '@/render/InsideHider'
import { useView } from '@/render/view'
import { flyTo, followOrigin, getCameraControls, isRecording, setCameraControls, trackedPartId } from './camera'
import { installDevBridge } from './devBridge'
import { partObjects } from '@/parts/registry'

function CaliperTool({ extent }: { extent: number }) {
  const caliperMode = useView((s) => s.caliperMode)
  const caliperPoints = useView((s) => s.caliperPoints)

  if (!caliperMode || !caliperPoints || caliperPoints.length === 0) return null

  const p1 = new THREE.Vector3(...caliperPoints[0])
  const p2 = caliperPoints.length > 1 ? new THREE.Vector3(...caliperPoints[1]) : null
  
  const dist = p2 ? p1.distanceTo(p2) : 0
  const mid = p2 ? p1.clone().lerp(p2, 0.5) : p1

  const s = extent * 0.005

  return (
    <group>
      <mesh position={p1}>
        <sphereGeometry args={[s, 16, 16]} />
        <meshBasicMaterial color="#ef4444" depthTest={false} />
      </mesh>
      {p2 && (
        <>
          <mesh position={p2}>
            <sphereGeometry args={[s, 16, 16]} />
            <meshBasicMaterial color="#ef4444" depthTest={false} />
          </mesh>
          <Line points={[p1, p2]} color="#ef4444" lineWidth={3} depthTest={false} transparent opacity={0.8} />
          <Html position={mid} center className="pointer-events-none">
            <div className="rounded-md bg-panel-2/95 px-2 py-1 text-[11px] font-mono font-medium text-ink shadow-2xl backdrop-blur-xl ring-1 ring-white/10">
              {(dist * 1000).toFixed(1)} mm
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

const SHADOW_MAP = 2048

/**
 * Key light with shadows. The shadow box is sized to the scene, but in scenes that follow a
 * moving machine it stays tight round it (and moves with it), so shadow pixels stay small.
 * The box moves in whole shadow-pixel steps, and the bias scales with the pixel size: together
 * they stop self-shadowing acne and edges shimmering on moving parts.
 */
/**
 * A soft light from the viewer's own position, aimed where the camera looks: whichever side you
 * orbit to is lit enough to read, while the fixed key light still gives the shapes and shadows.
 */
function HeadLight() {
  const light = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera }) => {
    const l = light.current
    if (!l) return
    const c = getCameraControls()
    if (c) c.getTarget(target)
    else camera.getWorldDirection(target).add(camera.position)
    l.position.copy(camera.position)
    l.target.position.copy(target)
    if (!l.target.parent) l.parent?.add(l.target)
    l.target.updateMatrixWorld()
  })
  return <directionalLight ref={light} intensity={0.7} color="#fff8f0" />
}

function Lights({ extent, follow }: { extent: number; follow: boolean }) {
  const s = extent
  const half = follow ? Math.min(1.4 * s, 18) : 1.4 * s
  const texel = (2 * half) / SHADOW_MAP
  const light = useRef<THREE.DirectionalLight>(null)
  const offset = useMemo(() => new THREE.Vector3(1.4, 2.2, 1.6).normalize().multiplyScalar(Math.max(s * 3, half * 3)), [s, half])
  useFrame(() => {
    const l = light.current
    if (!l) return
    const cx = follow && followOrigin.active ? Math.round(followOrigin.x / texel) * texel : 0
    const cz = follow && followOrigin.active ? Math.round(followOrigin.z / texel) * texel : 0
    if (l.target.position.x === cx && l.target.position.z === cz && l.target.parent) return
    l.target.position.set(cx, 0, cz)
    l.position.set(cx + offset.x, offset.y, cz + offset.z)
    if (!l.target.parent) l.parent?.add(l.target)
    l.target.updateMatrixWorld()
  })
  return (
    <>
      {/* sky above, mid grey below, so undersides are never black */}
      <hemisphereLight args={['#ffffff', '#5b6470', 0.65]} />
      <HeadLight />
      <directionalLight
        ref={light}
        position={[offset.x, offset.y, offset.z]}
        intensity={2.1}
        castShadow
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
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

/**
 * Showroom floor: shadow catcher, contact shadows and grid. They are overlays, so they never
 * write depth and are pushed back by a polygon offset: where a scene has its own ground at the
 * same height, the ground always wins instead of the two flickering (z-fighting) as the camera moves.
 */
function Floor({ y, extent }: { y: number; extent: number }) {
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    ref.current?.traverse((o) => {
      const m = (o as THREE.Mesh).material
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        mat.polygonOffset = true
        mat.polygonOffsetFactor = 4
        mat.polygonOffsetUnits = 4
        mat.depthWrite = false
        mat.needsUpdate = true
      }
    })
  }, [extent])
  return (
    <group ref={ref} position={[0, y, 0]}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[extent * 30, extent * 30]} />
        <shadowMaterial transparent opacity={0.25} />
      </mesh>
      <ContactShadows resolution={512} scale={extent * 10} blur={2.5} opacity={0.65} far={extent * 1.5} color="#070a12" position={[0, 0.001, 0]} />
      <Grid
        position={[0, 0.0005, 0]}
        args={[extent * 20, extent * 20]}
        cellSize={extent / 20}
        cellThickness={0.6}
        cellColor="#1c1e24"
        sectionSize={extent / 4}
        sectionThickness={1}
        sectionColor="#2a2d37"
        fadeDistance={extent * 7}
        fadeStrength={1.5}
        infiniteGrid
      />
    </group>
  )
}

function CameraTracker({ controlsRef }: { controlsRef: React.RefObject<CameraControlsImpl | null> }) {
  const lastCenter = useRef(new THREE.Vector3())
  const v = useRef(new THREE.Vector3())

  useFrame(() => {
    const controls = controlsRef.current
    if (!controls || !trackedPartId || isRecording) {
      lastCenter.current.set(0, 0, 0)
      return
    }
    
    const obj = partObjects.get(trackedPartId)
    if (!obj) return
    
    obj.getWorldPosition(v.current)
    
    if (lastCenter.current.lengthSq() === 0) {
      lastCenter.current.copy(v.current)
      return
    }
    
    const dx = v.current.x - lastCenter.current.x
    const dy = v.current.y - lastCenter.current.y
    const dz = v.current.z - lastCenter.current.z
    
    if (Math.abs(dx) > 1e-5 || Math.abs(dy) > 1e-5 || Math.abs(dz) > 1e-5) {
      controls.camera.position.x += dx
      controls.camera.position.y += dy
      controls.camera.position.z += dz
      
      const anyControls = controls as any
      if (anyControls._target) {
        anyControls._target.x += dx
        anyControls._target.y += dy
        anyControls._target.z += dz
      }
      if (anyControls._targetEnd) {
        anyControls._targetEnd.x += dx
        anyControls._targetEnd.y += dy
        anyControls._targetEnd.z += dz
      }
      if (anyControls._cameraEnd) {
        anyControls._cameraEnd.x += dx
        anyControls._cameraEnd.y += dy
        anyControls._cameraEnd.z += dz
      }
      
      lastCenter.current.copy(v.current)
    }
  })
  
  return null
}



/** Keeps the camera on a moving part (e.g. a tractor driving down the field). */
function FollowCamera({ partId, pose }: { partId: string; pose: CameraPose }) {
  const last = useRef<THREE.Vector3 | null>(null)
  const p = useRef(new THREE.Vector3())
  const t = useRef(new THREE.Vector3())
  useEffect(() => {
    followOrigin.active = true
    return () => {
      followOrigin.active = false
      followOrigin.x = 0
      followOrigin.z = 0
    }
  }, [])
  useFrame(() => {
    const obj = partObjects.get(partId)
    const c = getCameraControls()
    if (!obj || !c) return
    obj.getWorldPosition(p.current)
    followOrigin.x = p.current.x
    followOrigin.z = p.current.z
    if (!last.current) {
      // first sighting: place the scene's pose relative to the part
      last.current = p.current.clone()
      flyTo(pose, false)
      return
    }
    const dx = p.current.x - last.current.x
    const dz = p.current.z - last.current.z
    if (Math.abs(dx) > 1e-5 || Math.abs(dz) > 1e-5) {
      c.getTarget(t.current)
      void c.moveTo(t.current.x + dx, t.current.y, t.current.z + dz, false)
    }
    last.current.copy(p.current)
  })
  return null
}

export function Stage({ scene, smooth = true }: { scene: SceneDef; smooth?: boolean }) {
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
        if (e.type === 'click') {
          if (useView.getState().caliperMode) return
          select(null)
        }
      }}
      onCreated={({ camera, scene: s3, gl }) => {
        camera.lookAt(...target)
        installDevBridge({ scene: s3, camera, gl })
      }}
      aria-label={`3D view: ${scene.title}`}
      // 3D labels (drei Html) carry huge z-indexes; keep them inside the canvas so cards and modals stay on top
      style={{ isolation: 'isolate', zIndex: 0 }}
    >
      <color attach="background" args={['#09090b']} />
      <fog attach="fog" args={['#09090b', scene.extent * 6, scene.extent * 16]} />
      <SimClockDriver />
      <HoverTelemetry />
      <InsideHider />
      <CameraTracker controlsRef={ref} />
      <CutController hatchScale={scene.hatchScale ?? scene.extent / 220} />
      <CaliperTool extent={scene.extent} />
      <Lights extent={scene.extent} follow={!!scene.follow} />
      <Suspense fallback={null}>
        <scene.Viewport />
      </Suspense>
      <Floor y={scene.floorY ?? 0} extent={scene.extent} />
      {scene.follow ? <FollowCamera partId={scene.follow} pose={scene.camera} /> : null}
      <CutPlaneHelpers size={scene.extent * 1.2} />
      <CameraControls
        ref={attach}
        makeDefault
        minDistance={scene.extent * 0.15}
        maxDistance={scene.extent * 8}
        dollySpeed={0.6}
        smoothTime={smooth ? 0.35 : 0}
      />
    </Canvas>
  )
}
