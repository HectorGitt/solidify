import { Html, Line } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createStore, useStore } from 'zustand'
import * as THREE from 'three'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { MATERIALS, type MaterialKey } from '@/render/materials'
import { Part, PartMesh } from '@/render/Part'
import { useView } from '@/render/view'
import { resolveAssembly, type Placement } from './assembly'
import { buildPartGeometry } from './builder'
import {
  evalDim,
  evaluateCalculations,
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
export const liveAssembly = { active: false, landed: new Set<string>(), dropping: new Map<string, number>() }

function LocalPartNode({
  part,
  params,
  clipPlane,
  placed,
}: {
  part: NotePartSpec
  params: Record<string, number>
  clipPlane: THREE.Plane | null
  /** where the assembly solver put it, when it is mounted by relation */
  placed?: Placement
}) {
  const inline = useContext(InlineViewCtx)
  const motionRef = useRef<THREE.Group>(null)
  const dropRef = useRef<THREE.Group>(null)
  // a part still dropping when the scene is rebuilt carries on from where it was, rather than starting again
  const drop = useRef(liveAssembly.active && !liveAssembly.landed.has(part.id) ? (liveAssembly.dropping.get(part.id) ?? 0) : 1)
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
  const basePos = useMemo(() => placed?.position ?? evalVec3(part.position, params, [0, 0, 0]), [placed, part.position, params])
  const baseRot = useMemo(() => placed?.rotation ?? evalVec3(part.rotation, params, [0, 0, 0]), [placed, part.rotation, params])

  useFrame((_, dt) => {
    // dropping into place: falls from above with a small overshoot, and grows to full size
    const d = dropRef.current
    if (d && drop.current < 1) {
      drop.current = Math.min(1, drop.current + dt / 0.6)
      liveAssembly.dropping.set(part.id, drop.current)
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
    <group ref={dropRef} position={[0, drop.current < 1 ? 0.16 * (1 - drop.current) : 0, 0]} scale={drop.current < 1 ? 0.72 + 0.28 * drop.current : 1}>
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
          // the reader's inline figures pick parts themselves; everywhere else the mesh's own click selects the
          // part (passing a handler here would replace that, and clicks would do nothing)
          {...(inline?.onSelectPart
            ? {
                onClick: (e: ThreeEvent<MouseEvent>) => {
                  e.stopPropagation()
                  const isSelected = inline.selectedPartId === part.id
                  inline.onSelectPart?.(isSelected ? null : part)
                },
              }
            : {})}
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

function LabelSprite({ position, label, value, color }: { position: [number, number, number]; label: string; value: string; color: string }) {
  const sprite = useMemo(() => {
    const ratio = 2
    const font = `600 ${13 * ratio}px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`
    const measure = document.createElement('canvas').getContext('2d')!
    measure.font = font
    const head = label
    const tail = value ? ` = ${value}` : ''
    const padX = 8 * ratio
    const w = Math.ceil(measure.measureText(head + tail).width + padX * 2)
    const h = 24 * ratio
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    const r = 6 * ratio
    ctx.beginPath()
    ctx.moveTo(r, 0)
    ctx.arcTo(w, 0, w, h, r)
    ctx.arcTo(w, h, 0, h, r)
    ctx.arcTo(0, h, 0, 0, r)
    ctx.arcTo(0, 0, w, 0, r)
    ctx.closePath()
    ctx.fillStyle = 'rgba(10, 14, 18, 0.86)'
    ctx.fill()
    ctx.lineWidth = 1.5 * ratio
    ctx.strokeStyle = color
    ctx.globalAlpha = 0.75
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.font = font
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#f3f4f6'
    ctx.fillText(head, padX, h / 2 + ratio)
    ctx.fillStyle = color
    ctx.fillText(tail, padX + ctx.measureText(head).width, h / 2 + ratio)
    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 4
    const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, depthWrite: false, sizeAttenuation: false, toneMapped: false })
    const sp = new THREE.Sprite(mat)
    const height = 0.034
    sp.scale.set((height * w) / h, height, 1)
    sp.center.set(0.5, -0.35)
    sp.renderOrder = 999
    return sp
  }, [label, value, color])
  useEffect(
    () => () => {
      sprite.material.map?.dispose()
      sprite.material.dispose()
    },
    [sprite],
  )
  return <primitive object={sprite} position={position} />
}

/** a load's value for its label: "P = 250 N", following the sliders */
function annotationText(ann: NoteAnnotationSpec, scope: Record<string, number>) {
  if (ann.magnitude !== undefined && ann.magnitude !== '') {
    const v = evalDim(ann.magnitude, scope, NaN)
    if (Number.isFinite(v)) {
      const a = Math.abs(v)
      const num = a >= 1000 ? v.toFixed(0) : a >= 100 ? v.toFixed(1) : a >= 1 ? v.toFixed(2) : Number(v.toPrecision(3)).toString()
      return `${num}${ann.unit ? ` ${ann.unit}` : ''}`
    }
  }
  return ann.value ?? ''
}

/**
 * Loads drawn the way they are on paper: a force is a solid arrow pointing at where it acts, a moment or
 * torque is a curved arrow around its axis, and both always carry their value. Dimensions and labels show
 * with the Labels switch.
 */
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
    () => (ann.to ? evalVec3(ann.to, params, [from[0], from[1] + 0.08, from[2]]) : ([from[0], from[1] + 0.08, from[2]] as [number, number, number])),
    [ann.to, from, params],
  )
  const mid: [number, number, number] = [(from[0] + to[0]) * 0.5, (from[1] + to[1]) * 0.5, (from[2] + to[2]) * 0.5]
  const color = ann.color ?? (ann.kind === 'force' ? '#ef4444' : ann.kind === 'moment' ? '#f59e0b' : ann.kind === 'dimension' ? '#38bdf8' : '#10b981')
  const text = annotationText(ann, params)

  const dir = useMemo(() => {
    const v = new THREE.Vector3(to[0] - from[0], to[1] - from[1], to[2] - from[2])
    const len = v.length()
    return { vec: len > 1e-5 ? v.clone().normalize() : new THREE.Vector3(0, 1, 0), len }
  }, [from, to])
  const quat = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.vec), [dir.vec])

  // a solid arrow: shaft and head, sized to its length
  const arrow = useMemo(() => {
    const len = Math.max(dir.len, 0.01)
    const r = Math.min(0.008, Math.max(0.0025, len * 0.035))
    const head = Math.min(len * 0.32, Math.max(0.02, r * 5))
    return { r, head, shaft: Math.max(0.001, len - head) }
  }, [dir.len])

  // a moment: three quarters of a circle around its axis, with a head on the end
  const moment = useMemo(() => {
    if (ann.kind !== 'moment') return null
    const radius = Math.min(0.09, Math.max(0.035, dir.len * 0.6))
    const axis = dir.vec
    const u = new THREE.Vector3().crossVectors(axis, Math.abs(axis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0)).normalize()
    const w = new THREE.Vector3().crossVectors(axis, u).normalize()
    const c = new THREE.Vector3(...from)
    const pts = Array.from({ length: 33 }, (_, i) => {
      const t = (i / 32) * Math.PI * 1.5
      return c.clone().add(u.clone().multiplyScalar(Math.cos(t) * radius)).add(w.clone().multiplyScalar(Math.sin(t) * radius))
    })
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, Math.max(0.0025, radius * 0.06), 8, false)
    const end = pts[pts.length - 1]
    const tangent = end.clone().sub(pts[pts.length - 2]).normalize()
    return { tube, end: end.toArray() as [number, number, number], q: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent), radius }
  }, [ann.kind, dir, from])
  useEffect(() => () => moment?.tube.dispose(), [moment])

  const material = <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.45} />
  const isLoad = ann.kind === 'force' || ann.kind === 'moment'

  return (
    <group>
      {ann.kind === 'force' ? (
        <group position={from} quaternion={quat}>
          <mesh position={[0, arrow.shaft / 2, 0]}>
            <cylinderGeometry args={[arrow.r, arrow.r, arrow.shaft, 16]} />
            {material}
          </mesh>
          <mesh position={[0, arrow.shaft + arrow.head / 2, 0]}>
            <coneGeometry args={[arrow.r * 2.6, arrow.head, 20]} />
            {material}
          </mesh>
        </group>
      ) : moment ? (
        <group>
          <mesh geometry={moment.tube}>{material}</mesh>
          <mesh position={moment.end} quaternion={moment.q}>
            <coneGeometry args={[moment.radius * 0.16, moment.radius * 0.38, 18]} />
            {material}
          </mesh>
        </group>
      ) : (
        <Line points={[from, to]} color={color} lineWidth={ann.kind === 'dimension' ? 1.8 : 2.4} dashed={ann.kind === 'dimension'} dashSize={0.012} gapSize={0.008} />
      )}
      {isLoad || showLabels ? (
        <LabelSprite position={ann.kind === 'force' || ann.kind === 'dimension' ? mid : moment ? moment.end : to} label={ann.label} value={text} color={color} />
      ) : null}
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

  // annotation values may be calculated results (a reaction, a torque), not only slider values
  const scope = useMemo(() => evaluateCalculations(spec.calculations, params).scope, [spec.calculations, params])
  // parts mounted by relation: placed from the other parts' real geometry each time the sizes change
  const assembly = useMemo(() => resolveAssembly(spec, scope), [spec, scope])
  const projMode = projectionOverride ?? spec.showProjectionPlanes ?? 'none'
  const extent = spec.extent ?? 0.35

  return (
    <InlineViewCtx.Provider value={inlineConfig ?? null}>
      <LocalClippingEnabler />
      <group>
        {spec.parts.map((part) => (
          <LocalPartNode key={part.id} part={part} params={params} clipPlane={clipPlane} placed={part.mount ? assembly.placements.get(part.id) : undefined} />
        ))}
        {spec.annotations?.map((ann) => (
          <Annotation3D key={ann.id} ann={ann} params={scope} />
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

/**
 * A SceneDef whose viewport stays the same component while the model changes. `createSceneDefFromSpec`
 * makes a new viewport each time, so React rebuilds the whole 3D scene (parts, arrows, labels) on every
 * slider move or streamed part; this one feeds the latest model to a single viewport, which updates in
 * place. For pages where the model changes often (the model workspace).
 */
export function useLiveSceneDef(spec: NoteSceneSpec | null, params: Record<string, number>): SceneDef | null {
  const store = useMemo(() => createStore<{ spec: NoteSceneSpec | null; params: Record<string, number> }>(() => ({ spec, params })), [])
  useLayoutEffect(() => {
    store.setState({ spec, params })
  }, [store, spec, params])
  const Viewport = useMemo(
    () =>
      function LiveNoteViewport() {
        const s = useStore(store)
        return s.spec ? <NoteSceneViewport spec={s.spec} params={s.params} /> : null
      },
    [store],
  )
  const extent = spec?.extent ?? 0.35
  const cameraKey = JSON.stringify(spec?.camera ?? null)
  return useMemo(() => {
    if (!spec) return null
    const camera = spec.camera ?? { position: [extent * 1.45, extent * 1.05, extent * 1.55] as [number, number, number], target: [0, 0, 0] as [number, number, number] }
    return { id: spec.id, title: spec.title, summary: spec.summary, extent, floorY: spec.floorY ?? -extent * 0.45, camera, Viewport }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec?.id, spec?.title, spec?.summary, extent, spec?.floorY, cameraKey, Viewport, !!spec])
}
