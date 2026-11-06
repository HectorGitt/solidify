import { Html, Line } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { createContext, useContext, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { buildPartGeometry } from './builder'
import {
  evalDim,
  evalVec3,
  type NoteAnnotationSpec,
  type NotePartSpec,
  type NoteSceneSpec,
} from './schema'

export interface InlineViewConfig {
  /** When true, uses local per-figure clipping/explode/xray instead of global useView */
  independent: boolean
  cutEnabled: boolean
  cutNormal: [number, number, number]
  cutPos: number
  explode: number
  xray: boolean
  showLabels: boolean
  playing: boolean
  selectedPartId: string | null
  onSelectPart?: (part: NotePartSpec | null) => void
}

const InlineViewCtx = createContext<InlineViewConfig | null>(null)

/**
 * A live build: while it is on, a part that has not landed yet drops into place when it first appears
 * (the scene is rebuilt as each part arrives, so parts that already landed are remembered here).
 */
export const liveAssembly = { active: false, landed: new Set<string>() }

function LocalPartNode({
  part,
  params,
  clipPlane,
}: {
  part: NotePartSpec
  params: Record<string, number>
  clipPlane: THREE.Plane | null
}) {
  const inline = useContext(InlineViewCtx)
  const motionRef = useRef<THREE.Group>(null)
  const dropRef = useRef<THREE.Group>(null)
  const drop = useRef(liveAssembly.active && !liveAssembly.landed.has(part.id) ? 0 : 1)
  const timeRef = useRef(0)

  const geometry = useMemo(() => buildPartGeometry(part.shapes, params), [part.shapes, params])
  const labelPos: [number, number, number] = useMemo(() => {
    geometry.computeBoundingBox()
    const bb = geometry.boundingBox
    if (!bb) return [0, 0.04, 0]
    return [
      (bb.min.x + bb.max.x) * 0.5,
      bb.max.y + 0.018,
      (bb.min.z + bb.max.z) * 0.5,
    ]
  }, [geometry])
  const basePos = useMemo(() => evalVec3(part.position, params, [0, 0, 0]), [part.position, params])
  const baseRot = useMemo(() => evalVec3(part.rotation, params, [0, 0, 0]), [part.rotation, params])

  useFrame((_, dt) => {
    // dropping into place: falls from above with a small overshoot, and grows to full size
    const d = dropRef.current
    if (d && drop.current < 1) {
      drop.current = Math.min(1, drop.current + dt / 0.6)
      const t = drop.current
      const e = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2)
      d.position.y = (1 - e) * 0.16
      d.scale.setScalar(0.72 + 0.28 * Math.min(1, e))
      if (t >= 1) {
        d.position.y = 0
        d.scale.setScalar(1)
        liveAssembly.landed.add(part.id)
      }
    }
    const g = motionRef.current
    if (!g || !part.motion) return
    const playing = inline ? inline.playing : useSim.getState().playing
    if (playing) {
      timeRef.current += dt * (inline ? 1 : useSim.getState().timeScale)
    }
    const t = timeRef.current
    const { kind, axis, phase = 0 } = part.motion
    const speed = evalDim(part.motion.speed, params, 1)
    const amplitude = evalDim(part.motion.amplitude, params, 0.35)
    g.position.set(0, 0, 0)
    g.rotation.set(0, 0, 0)

    if (kind === 'rotate') {
      g.rotation[axis] = t * speed + phase
    } else if (kind === 'oscillate') {
      g.rotation[axis] = Math.sin(t * speed * Math.PI * 2 + phase) * amplitude
    } else if (kind === 'translate') {
      g.position[axis] = Math.sin(t * speed * Math.PI * 2 + phase) * amplitude
    }
  })

  const matKey: MaterialKey = part.material && part.material in MATERIALS ? part.material : 'steel'

  return (
    <group ref={dropRef} position={[0, drop.current < 1 ? 0.16 : 0, 0]} scale={drop.current < 1 ? 0.72 : 1}>
    <Part
      id={part.id}
      name={part.name}
      material={matKey}
      role={part.role ?? 'static'}
      explode={part.explode}
      cut={part.cut}
      info={part.info}
      position={basePos}
      rotation={baseRot}
    >
      <group ref={motionRef}>
        <PartMesh
          geometry={geometry}
          material={matKey}
          onClick={(e) => {
            if (inline?.onSelectPart) {
              e.stopPropagation()
              const isSelected = inline.selectedPartId === part.id
              inline.onSelectPart(isSelected ? null : part)
            }
          }}
        />
        {inline?.showLabels && (
          <Html position={labelPos} center zIndexRange={[15, 0]} className="pointer-events-none">
            <div className="whitespace-nowrap rounded border border-white/15 bg-black/75 px-1.5 py-0.5 font-mono text-[9.5px] font-medium text-neutral-200 shadow-sm backdrop-blur-sm">
              {part.name}
            </div>
          </Html>
        )}
        {part.children?.map((child) => (
          <LocalPartNode key={child.id} part={child} params={params} clipPlane={clipPlane} />
        ))}
      </group>
    </Part>
    </group>
  )
}

function Annotation3D({
  ann,
  params,
}: {
  ann: NoteAnnotationSpec
  params: Record<string, number>
}) {
  const inline = useContext(InlineViewCtx)
  const globalLabels = useView((s) => s.labels)
  const showLabels = inline ? inline.showLabels : globalLabels
  const from = useMemo(() => evalVec3(ann.from, params, [0, 0, 0]), [ann.from, params])
  const to = useMemo(
    () => (ann.to ? evalVec3(ann.to, params, [from[0], from[1] + 0.08, from[2]]) : [from[0], from[1] + 0.08, from[2]] as [number, number, number]),
    [ann.to, from, params],
  )

  const mid: [number, number, number] = [
    (from[0] + to[0]) * 0.5,
    (from[1] + to[1]) * 0.5,
    (from[2] + to[2]) * 0.5,
  ]

  const color =
    ann.color ??
    (ann.kind === 'force'
      ? '#ef4444'
      : ann.kind === 'moment'
        ? '#f59e0b'
        : ann.kind === 'dimension'
          ? '#38bdf8'
          : '#10b981')

  const dir = useMemo(() => {
    const v = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const len = v.length()
    return { vec: len > 1e-5 ? v.normalize() : new THREE.Vector3(0, 1, 0), len }
  }, [from, to])

  const coneQuat = useMemo(() => {
    return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.vec)
  }, [dir.vec])

  return (
    <group>
      <Line
        points={[from, to]}
        color={color}
        lineWidth={ann.kind === 'dimension' ? 1.8 : 2.8}
        dashed={ann.kind === 'dimension'}
        dashSize={0.012}
        gapSize={0.008}
      />
      {(ann.kind === 'force' || ann.kind === 'moment') && dir.len > 0.01 && (
        <mesh position={to} quaternion={coneQuat}>
          <coneGeometry args={[Math.min(0.014, dir.len * 0.18), Math.min(0.032, dir.len * 0.35), 16]} />
          <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
        </mesh>
      )}
      {showLabels && (
        <Html position={ann.kind === 'dimension' ? mid : to} center zIndexRange={[15, 0]} className="pointer-events-none">
          <div
            className="whitespace-nowrap rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-semibold shadow-md backdrop-blur-sm"
            style={{
              borderColor: `${color}66`,
              backgroundColor: 'rgba(10, 14, 18, 0.82)',
              color: '#f3f4f6',
            }}
          >
            <span>{ann.label}</span>
            {ann.value ? <span className="ml-1 text-accent">{ann.value}</span> : null}
          </div>
        </Html>
      )}
    </group>
  )
}

function OrthographicGlassPlanes({
  extent,
  mode,
}: {
  extent: number
  mode: 'first-angle' | 'third-angle'
}) {
  const s = extent * 0.65
  const offset = extent * 0.42
  return (
    <group>
      {/* Front Vertical Plane (VP) */}
      <group position={[0, 0, mode === 'third-angle' ? offset : -offset]}>
        <mesh>
          <planeGeometry args={[s, s]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Line
          points={[
            [-s / 2, -s / 2, 0],
            [s / 2, -s / 2, 0],
            [s / 2, s / 2, 0],
            [-s / 2, s / 2, 0],
            [-s / 2, -s / 2, 0],
          ]}
          color="#38bdf8"
          lineWidth={1.2}
          transparent
          opacity={0.45}
        />
        <Html position={[-s * 0.38, s * 0.4, 0]} center className="pointer-events-none">
          <span className="rounded bg-sky-950/80 px-1.5 py-0.5 font-mono text-[9px] text-sky-300">
            FRONT VIEW (VP · {mode === 'first-angle' ? '1st Angle' : '3rd Angle'})
          </span>
        </Html>
      </group>

      {/* Top Horizontal Plane (HP) */}
      <group position={[0, mode === 'third-angle' ? offset : -offset, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <planeGeometry args={[s, s]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Line
          points={[
            [-s / 2, -s / 2, 0],
            [s / 2, -s / 2, 0],
            [s / 2, s / 2, 0],
            [-s / 2, s / 2, 0],
            [-s / 2, -s / 2, 0],
          ]}
          color="#10b981"
          lineWidth={1.2}
          transparent
          opacity={0.45}
        />
      </group>

      {/* Side Profile Plane (PP) */}
      <group position={[mode === 'third-angle' ? offset : -offset, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <mesh>
          <planeGeometry args={[s, s]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
        <Line
          points={[
            [-s / 2, -s / 2, 0],
            [s / 2, -s / 2, 0],
            [s / 2, s / 2, 0],
            [-s / 2, s / 2, 0],
            [-s / 2, -s / 2, 0],
          ]}
          color="#f59e0b"
          lineWidth={1.2}
          transparent
          opacity={0.45}
        />
      </group>
    </group>
  )
}

function LocalClippingEnabler() {
  const gl = useThree((s) => s.gl)
  useEffect(() => {
    gl.localClippingEnabled = true
  }, [gl])
  return null
}

export function NoteSceneViewport({
  spec,
  params,
  inlineConfig,
  projectionOverride,
}: {
  spec: NoteSceneSpec
  params: Record<string, number>
  inlineConfig?: InlineViewConfig
  projectionOverride?: 'none' | 'first-angle' | 'third-angle'
}) {
  const clipPlane = useMemo(() => {
    if (!inlineConfig?.cutEnabled) return null
    const n = new THREE.Vector3(...inlineConfig.cutNormal).normalize()
    return new THREE.Plane(n.negate(), inlineConfig.cutPos)
  }, [inlineConfig?.cutEnabled, inlineConfig?.cutNormal, inlineConfig?.cutPos])

  const projMode = projectionOverride ?? spec.showProjectionPlanes ?? 'none'
  const extent = spec.extent ?? 0.35

  return (
    <InlineViewCtx.Provider value={inlineConfig ?? null}>
      <LocalClippingEnabler />
      <group>
        {spec.parts.map((part) => (
          <LocalPartNode key={part.id} part={part} params={params} clipPlane={clipPlane} />
        ))}
        {spec.annotations?.map((ann) => (
          <Annotation3D key={ann.id} ann={ann} params={params} />
        ))}
        {projMode !== 'none' && <OrthographicGlassPlanes extent={extent} mode={projMode} />}
      </group>
    </InlineViewCtx.Provider>
  )
}

/**
 * Wraps a `NoteSceneSpec` as a full Solidify `SceneDef` so it can be mounted inside `<Stage>`
 * with full cross-hatched sectioning, parts tree, calipers, and orientation gizmo.
 */
export function createSceneDefFromSpec(
  spec: NoteSceneSpec,
  params: Record<string, number>,
): SceneDef {
  const extent = spec.extent ?? 0.35
  const camera = spec.camera ?? {
    position: [extent * 1.45, extent * 1.05, extent * 1.55],
    target: [0, 0, 0],
  }
  return {
    id: spec.id,
    title: spec.title,
    summary: spec.summary,
    extent,
    floorY: spec.floorY ?? -extent * 0.45,
    camera,
    Viewport: () => <NoteSceneViewport spec={spec} params={params} />,
  }
}
