import { ContactShadows, Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SimClockDriver } from '@/core/sim'
import { findModule } from '@/modules/catalog'
import { toSceneParams } from './catalogTargets'
import type { SceneDef } from '@/modules/types'
import { CutController } from '@/render/CutController'
import { useView } from '@/render/view'
import { verifyBackProjection } from './backProjectCheck'
import { NoteSceneViewport, type InlineViewConfig } from './NoteSceneRenderer'
import {
  CONFIDENCE_THRESHOLD,
  type DetectedPageFigure,
  type NoteParameterSpec,
  type NotePartSpec,
} from './schema'

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

function InlineStudioLights({ extent }: { extent: number }) {
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

/**
 * Captures a still image from the active WebGL canvas once the geometry has settled
 * and whenever `captureRevision` increments (e.g. after slider or section changes).
 */
function SnapshotCapturer({
  captureRevision,
  onSnapshot,
}: {
  captureRevision: number
  onSnapshot: (dataUrl: string) => void
}) {
  const gl = useThree((s) => s.gl)
  const framesSinceRev = useRef(0)
  const lastCapturedRev = useRef(-1)

  useEffect(() => {
    framesSinceRev.current = 0
  }, [captureRevision])

  useFrame(() => {
    if (lastCapturedRev.current === captureRevision) return
    framesSinceRev.current += 1
    // Wait 12 frames so shadows, environment, and async scene geometry settle before snapshotting
    if (framesSinceRev.current >= 12) {
      lastCapturedRev.current = captureRevision
      try {
        const url = gl.domElement.toDataURL('image/webp', 0.88)
        if (url && url.startsWith('data:image/')) {
          onSnapshot(url)
        }
      } catch {
        // Ignore if canvas is tainted in test mocks
      }
    }
  })

  return null
}

export function InlineFigure3D({
  figure,
  isActive = true,
  onActivate,
  onExpand,
  className = '',
}: {
  figure: DetectedPageFigure
  /** Only ONE figure on the page runs a live WebGL canvas at a time so shared rig stores never collide */
  isActive?: boolean
  onActivate?: () => void
  onExpand?: (figure: DetectedPageFigure, currentParams: Record<string, number>) => void
  className?: string
}) {
  // Parameter state initialized from figure visualization
  const paramSpecs: NoteParameterSpec[] = useMemo(() => {
    if (figure.visualization.kind === 'procedural') {
      return figure.visualization.spec.parameters
    }
    if (figure.visualization.paramSpecs?.length) {
      return figure.visualization.paramSpecs
    }
    return Object.entries(figure.visualization.params).map(([k, v]) => ({
      id: k,
      label: k,
      value: v,
      min: v === 0 ? -10 : Math.min(v * 0.25, v * 1.75),
      max: v === 0 ? 10 : Math.max(v * 0.25, v * 1.75),
      step: Math.max(0.01, Number((Math.abs(v || 1) * 0.05).toPrecision(1))),
      unit: '',
    }))
  }, [figure])

  const [params, setParams] = useState<Record<string, number>>(() => {
    if (figure.visualization.kind === 'procedural') {
      return Object.fromEntries(figure.visualization.spec.parameters.map((p) => [p.id, p.value]))
    }
    return { ...figure.visualization.params }
  })

  // 1. Confidence Gating + 2. Back-Projection Check on Built Procedural Parts
  // a figure without a confidence is treated as unsure, so it stays as the original drawing
  const confidence = figure.confidence ?? 0
  // the figure's values in the rig's own settings; a rig that understands none of them would only show its defaults
  const mapped = useMemo(
    () => (figure.visualization.kind === 'catalog' ? toSceneParams(figure.visualization.moduleId, figure.visualization.sceneId, params) : null),
    [figure.visualization, params],
  )
  const backProjection = useMemo(() => {
    if (figure.visualization.kind !== 'procedural') {
      return { passed: true, score: 1, projectedAspect: 1.5, fillRatio: 0.5 }
    }
    const [ymin, xmin, ymax, xmax] = figure.box
    const boxAspect = Math.max(0.4, (xmax - xmin) / Math.max(1, ymax - ymin))
    return verifyBackProjection(figure.visualization.spec, params, boxAspect)
  }, [figure.visualization, figure.box, params])

  const gatedByConfidence = confidence < CONFIDENCE_THRESHOLD
  const gatedByBackProjection = !backProjection.passed
  const gatedByValues = !!mapped && mapped.usable === 0
  const isGated = gatedByConfidence || gatedByBackProjection || gatedByValues

  // If gated (low confidence or failed back-projection check), keep original 2D figure by default!
  const [viewMode, setViewMode] = useState<'3d' | '2d' | 'split'>(() =>
    isGated ? '2d' : '3d',
  )
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null)
  const [captureRev, setCaptureRev] = useState(0)

  // Local interactive view controls per figure
  const defaultCut =
    figure.visualization.kind === 'procedural'
      ? (figure.visualization.spec.recommendedCut?.enabled ?? true)
      : Boolean(figure.visualization.cutPreset)
  const [cutEnabled, setCutEnabled] = useState(defaultCut)
  const [cutPos, setCutPos] = useState(
    figure.visualization.kind === 'procedural'
      ? (figure.visualization.spec.recommendedCut?.pos ?? 0)
      : 0,
  )
  const [cutAxis, setCutAxis] = useState<'x' | 'y' | 'z'>('z')
  const [explode, setExplode] = useState(0)
  const [xray, setXray] = useState(false)
  const [showLabels, setShowLabels] = useState(false)
  const [playing, setPlaying] = useState(true)
  const [darkCanvas, setDarkCanvas] = useState(false)
  const [projMode, setProjMode] = useState<'none' | 'first-angle' | 'third-angle'>(
    figure.visualization.kind === 'procedural'
      ? (figure.visualization.spec.showProjectionPlanes ?? 'none')
      : 'none',
  )
  const [selectedPart, setSelectedPart] = useState<NotePartSpec | null>(null)
  const [activePopover, setActivePopover] = useState<'none' | 'params' | 'section'>('none')

  useEffect(() => {
    if (figure.visualization.kind === 'procedural') {
      setParams(Object.fromEntries(figure.visualization.spec.parameters.map((p) => [p.id, p.value])))
      setProjMode(figure.visualization.spec.showProjectionPlanes ?? 'none')
    } else {
      setParams({ ...figure.visualization.params })
    }
    const values = figure.visualization.kind === 'catalog' ? toSceneParams(figure.visualization.moduleId, figure.visualization.sceneId, figure.visualization.params).usable : 1
    setViewMode((figure.confidence ?? 0) < CONFIDENCE_THRESHOLD || values === 0 ? '2d' : '3d')
  }, [figure])

  // Load catalog SceneDef when visualization.kind === 'catalog'
  const [catalogScene, setCatalogScene] = useState<SceneDef | null>(null)
  useEffect(() => {
    let alive = true
    if (figure.visualization.kind !== 'catalog') {
      setCatalogScene(null)
      return
    }
    const { moduleId, sceneId } = figure.visualization
    const mod = findModule(moduleId)
    // an unknown scene is not swapped for another one: the figure stays as drawn
    const entry = mod?.scenes.find((s) => s.id === sceneId)
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        setCatalogScene(def)
        setCaptureRev((r) => r + 1)
      })
      .catch(() => {
        if (alive) setCatalogScene(null)
      })
    return () => {
      alive = false
    }
  }, [figure])

  const cutNormal: [number, number, number] = useMemo(() => {
    if (cutAxis === 'x') return [1, 0, 0]
    if (cutAxis === 'y') return [0, 1, 0]
    return [0, 0, 1]
  }, [cutAxis])

  // CRITICAL SAFEGUARD: Only apply this figure's parameters and view state to global stores
  // when THIS figure is the single active live figure (`isActive === true`)!
  useEffect(() => {
    if (!isActive) return
    // the main app's view settings are borrowed while this figure is live, and handed back afterwards
    const before = useView.getState()
    const saved = { labels: before.labels, cut: before.cut, explode: before.explode, xray: before.xray }
    return () => {
      const v = useView.getState()
      v.setLabels(saved.labels)
      v.setCut(saved.cut)
      v.setExplode(saved.explode)
      v.setXray(saved.xray)
    }
  }, [isActive])
  useEffect(() => {
    if (!isActive) return
    useView.getState().setLabels(showLabels)
    useView.getState().setCut({ enabled: cutEnabled, planes: [{ normal: cutNormal, pos: cutPos }] })
    useView.getState().setExplode(explode)
    useView.getState().setXray(xray)
    setCaptureRev((r) => r + 1)
  }, [isActive, showLabels, cutEnabled, cutNormal, cutPos, explode, xray])
  useEffect(() => {
    if (!isActive || !catalogScene || !mapped || mapped.usable === 0) return
    // start from the rig's defaults, so values the figure doesn't give aren't left over from another figure
    catalogScene.reset?.()
    catalogScene.applyParams?.(mapped.params)
    setCaptureRev((r) => r + 1)
  }, [isActive, catalogScene, mapped])

  const extent =
    figure.visualization.kind === 'procedural'
      ? (figure.visualization.spec.extent ?? 0.32)
      : (catalogScene?.extent ?? 1.2)

  const floorY =
    figure.visualization.kind === 'procedural'
      ? (figure.visualization.spec.floorY ?? -extent * 0.45)
      : (catalogScene?.floorY ?? 0)

  const cameraPose = useMemo(() => {
    if (figure.visualization.kind === 'procedural') {
      return (
        figure.visualization.spec.camera ?? {
          position: [extent * 1.45, extent * 1.05, extent * 1.55] as [number, number, number],
          target: [0, 0, 0] as [number, number, number],
        }
      )
    }
    return (
      catalogScene?.camera ?? {
        position: [extent * 1.4, extent * 1.0, extent * 1.5] as [number, number, number],
        target: [0, 0, 0] as [number, number, number],
      }
    )
  }, [figure.visualization, catalogScene, extent])

  const inlineConfig: InlineViewConfig = useMemo(
    () => ({
      independent: true,
      cutEnabled,
      cutNormal,
      cutPos,
      explode,
      xray,
      showLabels,
      playing,
      selectedPartId: selectedPart?.id ?? null,
      onSelectPart: setSelectedPart,
    }),
    [cutEnabled, cutNormal, cutPos, explode, xray, showLabels, playing, selectedPart?.id],
  )

  const handleSnapshot = useCallback((url: string) => {
    setSnapshotUrl(url)
  }, [])

  const canvasBg = darkCanvas ? '#090d10' : '#fcfbf7'
  const gridCell = darkCanvas ? '#16202a' : '#e6e3da'
  const gridSection = darkCanvas ? '#223242' : '#cfc9bc'

  return (
    <div
      onClick={() => {
        if (!isActive && onActivate) onActivate()
      }}
      className={`group/fig relative flex flex-col overflow-hidden bg-[#fcfbf7] text-slate-800 transition-all ${
        isGated ? 'rounded-lg border border-dashed border-amber-500/50' : ''
      } ${className}`}
    >
      {/* Floating Top-Right Controls (Hidden until hover or when popover/gated is active, so figure blends into page) */}
      <div
        className={`pointer-events-none absolute top-1.5 left-1.5 right-1.5 z-20 flex flex-wrap items-center justify-between gap-1.5 transition-opacity duration-200 ${
          isGated || activePopover !== 'none'
            ? 'opacity-100'
            : 'opacity-0 group-hover/fig:opacity-100 focus-within:opacity-100'
        }`}
      >
        <div className="pointer-events-auto flex items-center gap-1.5">
          {isGated && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-50/95 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-800 shadow-xs backdrop-blur-xs"
              title={
                gatedByValues
                  ? 'None of this figure’s values could be matched to the 3D model, so it would only show default values.'
                  : gatedByConfidence
                    ? `Recognition confidence ${Math.round(confidence * 100)}% is below the ${Math.round(CONFIDENCE_THRESHOLD * 100)}% threshold; showing original 2D figure by default.`
                    : (backProjection.reason ?? '2D back-projection check flagged this procedural model.')
              }
            >
              ⚠ {gatedByValues ? 'Values not matched' : gatedByConfidence ? `Low Confidence (${Math.round(confidence * 100)}%)` : `Check Flagged (${Math.round(backProjection.score * 100)}%)`} · Original Kept
            </span>
          )}
        </div>

        {/* Mode & CAD Tools Floating Pill */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-lg border border-slate-300/80 bg-white/90 px-1.5 py-1 shadow-sm backdrop-blur-md">
          <div className="mr-0.5 flex items-center rounded-md bg-slate-100 p-0.5 font-mono text-[10px]">
            {(['3d', 'split', '2d'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (m !== '2d' && !isActive && onActivate) onActivate()
                  setViewMode(m)
                }}
                className={`rounded px-1.5 py-0.5 uppercase transition-colors ${
                  viewMode === m ? 'bg-slate-800 text-white font-semibold' : 'text-slate-600 hover:text-slate-900'
                }`}
                title={m === '3d' ? 'Interactive 3D view' : m === '2d' ? 'Original 2D figure from document' : 'Side-by-side 2D & 3D'}
              >
                {m === '3d' ? '3D' : m === '2d' ? '2D' : 'Split'}
              </button>
            ))}
          </div>

          {viewMode !== '2d' && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isActive && onActivate) onActivate()
                  const next = !cutEnabled
                  setCutEnabled(next)
                  setActivePopover(next ? 'section' : 'none')
                  setCaptureRev((r) => r + 1)
                }}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  cutEnabled
                    ? 'bg-amber-100 text-amber-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Toggle cross-section cutaway"
              >
                ✂ Section
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isActive && onActivate) onActivate()
                  const next = explode > 0.05 ? 0 : 0.65
                  setExplode(next)
                  setCaptureRev((r) => r + 1)
                }}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  explode > 0.05
                    ? 'bg-emerald-100 text-emerald-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Explode assembly parts"
              >
                💥 Explode
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  if (!isActive && onActivate) onActivate()
                  const next = !xray
                  setXray(next)
                  setCaptureRev((r) => r + 1)
                }}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                  xray
                    ? 'bg-sky-100 text-sky-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
                title="Toggle X-Ray housing transparency"
              >
                X-Ray
              </button>

              {figure.visualization.kind === 'procedural' && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isActive && onActivate) onActivate()
                    setProjMode((p) => (p === 'none' ? 'first-angle' : p === 'first-angle' ? 'third-angle' : 'none'))
                    setCaptureRev((r) => r + 1)
                  }}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                    projMode !== 'none'
                      ? 'bg-sky-100 text-sky-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Toggle 1st / 3rd angle orthographic projection planes"
                >
                  {projMode === 'none' ? 'Ortho' : projMode === 'first-angle' ? '1st ∠' : '3rd ∠'}
                </button>
              )}

              {paramSpecs.length > 0 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isActive && onActivate) onActivate()
                    setActivePopover((p) => (p === 'params' ? 'none' : 'params'))
                  }}
                  className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${
                    activePopover === 'params'
                      ? 'bg-emerald-100 text-emerald-900 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  title="Adjust problem dimensions & loads from the note"
                >
                  ⚙ Givens
                </button>
              )}
            </>
          )}

          {onExpand && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onExpand(figure, params)
              }}
              className="rounded px-1.5 py-0.5 font-mono text-[10px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-colors"
              title="Open in full-screen 3D Studio with calipers, part tree & AI Tutor"
            >
              ⤢
            </button>
          )}
        </div>
      </div>

      {/* Optional Floating Popovers (Section Plane / Problem Givens Sliders) */}
      {activePopover === 'section' && cutEnabled && viewMode !== '2d' && (
        <div className="absolute top-10 right-2 z-20 flex flex-wrap items-center gap-3 rounded-lg border border-slate-300 bg-white/95 px-3 py-1.5 text-[11px] text-slate-700 shadow-md backdrop-blur-md">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-slate-500">Plane:</span>
            {(['x', 'y', 'z'] as const).map((ax) => (
              <button
                key={ax}
                type="button"
                onClick={() => {
                  setCutAxis(ax)
                  setCaptureRev((r) => r + 1)
                }}
                className={`rounded px-1.5 py-0.5 uppercase ${
                  cutAxis === ax ? 'bg-amber-500 text-white font-bold' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {ax.toUpperCase()}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 font-mono">
            <span className="text-slate-500">Depth:</span>
            <input
              type="range"
              min={-extent * 0.6}
              max={extent * 0.6}
              step={extent / 100}
              value={cutPos}
              onChange={(e) => {
                const v = parseFloat(e.target.value)
                setCutPos(v)
                setCaptureRev((r) => r + 1)
              }}
              className="h-1.5 w-24 accent-amber-500"
            />
          </label>
        </div>
      )}

      {activePopover === 'params' && paramSpecs.length > 0 && viewMode !== '2d' && (
        <div className="absolute top-10 left-2 right-2 z-20 grid gap-2 rounded-xl border border-slate-300 bg-white/95 p-2.5 text-[11px] shadow-lg backdrop-blur-md sm:grid-cols-2">
          {paramSpecs.map((p) => {
            const val = params[p.id] ?? p.value
            return (
              <label key={p.id} className="flex flex-col gap-0.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">
                    {p.symbol ? <strong className="mr-1 font-mono text-emerald-700">{p.symbol}</strong> : null}
                    {p.label}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-emerald-700">
                    {Number(val.toPrecision(4))} {p.unit}
                  </span>
                </div>
                <input
                  type="range"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={val}
                  onChange={(e) => {
                    const nextVal = parseFloat(e.target.value)
                    setParams((prev) => ({ ...prev, [p.id]: nextVal }))
                    setCaptureRev((r) => r + 1)
                  }}
                  className="h-1.5 w-full accent-emerald-600"
                />
              </label>
            )
          })}
        </div>
      )}

      {/* Main Viewport Area (3D / Split / 2D Original) */}
      <div className="relative flex min-h-[200px] flex-1 w-full overflow-hidden">
        {/* 2D Original View (shown in '2d' or 'split' mode) */}
        {(viewMode === '2d' || viewMode === 'split') && (
          <div
            className={`relative flex flex-col items-center justify-center bg-[#fcfbf7] p-2 ${
              viewMode === 'split' ? 'w-1/2 border-r border-slate-200/80' : 'w-full'
            }`}
          >
            {figure.originalCropUrl ? (
              <img
                src={figure.originalCropUrl}
                alt={figure.caption || figure.title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <div className="text-center font-serif text-[12px] text-slate-600">{figure.caption}</div>
            )}
            {viewMode === '2d' && (
              <div className="absolute bottom-2 right-2 opacity-0 group-hover/fig:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (!isActive && onActivate) onActivate()
                    setViewMode(isGated ? 'split' : '3d')
                  }}
                  className="rounded-md border border-slate-300 bg-white/95 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
                >
                  {isGated ? 'Compare 2D & 3D →' : 'View in 3D →'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3D Interactive Canvas OR Still Snapshot (shown in '3d' or 'split' mode) */}
        {viewMode !== '2d' && (
          <div className={`relative flex-1 ${viewMode === 'split' ? 'w-1/2' : 'w-full'} min-h-[200px]`}>
            {isActive ? (
              <Canvas
                shadows
                dpr={[1, 1.75]}
                camera={{
                  fov: 32,
                  near: Math.max(0.001, extent / 200),
                  far: Math.max(50, extent * 50),
                  position: cameraPose.position,
                }}
                gl={{
                  antialias: true,
                  preserveDrawingBuffer: true,
                  toneMapping: THREE.ACESFilmicToneMapping,
                  toneMappingExposure: 1.05,
                }}
                onPointerMissed={() => setSelectedPart(null)}
              >
                <color attach="background" args={[canvasBg]} />
                <SimClockDriver />
                <InlineStudioLights extent={extent} />
                <CutController hatchScale={extent / 220} />
                <Suspense fallback={null}>
                  {figure.visualization.kind === 'procedural' ? (
                    <NoteSceneViewport
                      spec={figure.visualization.spec}
                      params={params}
                      inlineConfig={inlineConfig}
                      projectionOverride={projMode}
                    />
                  ) : catalogScene ? (
                    <catalogScene.Viewport />
                  ) : null}
                </Suspense>
                <SnapshotCapturer captureRevision={captureRev} onSnapshot={handleSnapshot} />
                <group position={[0, floorY, 0]}>
                  <mesh rotation-x={-Math.PI / 2} receiveShadow>
                    <planeGeometry args={[extent * 30, extent * 30]} />
                    <shadowMaterial transparent opacity={0.25} />
                  </mesh>
                  <ContactShadows
                    resolution={512}
                    scale={extent * 8}
                    blur={2.4}
                    opacity={0.5}
                    far={extent * 1.6}
                    color="#000000"
                    position={[0, 0.001, 0]}
                  />
                </group>
                {darkCanvas && (
                  <Grid
                    position={[0, floorY, 0]}
                    args={[extent * 16, extent * 16]}
                    cellSize={extent / 10}
                    cellThickness={0.5}
                    cellColor={gridCell}
                    sectionSize={extent / 2}
                    sectionThickness={0.9}
                    sectionColor={gridSection}
                    fadeDistance={extent * 6}
                    fadeStrength={1.5}
                    infiniteGrid
                  />
                )}
                <OrbitControls
                  makeDefault
                  target={cameraPose.target}
                  enableDamping
                  dampingFactor={0.08}
                  minDistance={extent * 0.2}
                  maxDistance={extent * 6}
                  onEnd={() => setCaptureRev((r) => r + 1)}
                />
              </Canvas>
            ) : (
              /* Inactive Figure: Seamlessly displays its 3D Still Snapshot right on the paper (wakes on click) */
              <button
                type="button"
                onClick={() => onActivate?.()}
                className="group/wake relative flex h-full w-full items-center justify-center overflow-hidden bg-[#fcfbf7] text-left"
              >
                {snapshotUrl ? (
                  <img
                    src={snapshotUrl}
                    alt={`3D view of ${figure.title}`}
                    className="h-full w-full object-contain"
                  />
                ) : figure.originalCropUrl ? (
                  <img
                    src={figure.originalCropUrl}
                    alt={figure.title}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : null}
                <div className="pointer-events-none absolute bottom-2 right-2 opacity-0 transition-opacity group-hover/wake:opacity-100">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 font-mono text-[10px] font-medium text-slate-700 shadow-sm">
                    ▶ Click to interact in 3D
                  </span>
                </div>
              </button>
            )}

            {/* Selected Part Inspector Pill inside the Figure */}
            {isActive && selectedPart && (
              <div className="pointer-events-auto absolute bottom-2 left-2 right-2 z-10 flex items-start justify-between gap-2 rounded-lg border border-slate-300 bg-white/95 px-3 py-1.5 text-[11px] text-slate-800 shadow-md backdrop-blur-md">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{selectedPart.name}</span>
                    {selectedPart.material && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600">
                        {selectedPart.material}
                      </span>
                    )}
                  </div>
                  {selectedPart.info?.summary && (
                    <p className="mt-0.5 text-[10.5px] text-slate-600">{selectedPart.info.summary}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedPart(null)}
                  className="text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Bottom Corner Quick Badges (Only on hover) */}
            {isActive && (
              <div className="pointer-events-none absolute bottom-1.5 right-1.5 flex items-center gap-1 opacity-0 transition-opacity duration-200 group-hover/fig:opacity-100">
                <button
                  type="button"
                  onClick={() => {
                    setDarkCanvas((d) => !d)
                    setCaptureRev((r) => r + 1)
                  }}
                  className="pointer-events-auto rounded border border-slate-300/80 bg-white/90 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600 shadow-2xs hover:text-slate-950"
                  title="Toggle between Paper Light and Dark Studio canvas"
                >
                  {darkCanvas ? '🌙 Dark' : '☀ Paper'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowLabels((s) => !s)}
                  className="pointer-events-auto rounded border border-slate-300/80 bg-white/90 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600 shadow-2xs hover:text-slate-950"
                >
                  {showLabels ? 'Labels: ON' : 'Labels: OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  className="pointer-events-auto rounded border border-slate-300/80 bg-white/90 px-1.5 py-0.5 font-mono text-[9.5px] text-slate-600 shadow-2xs hover:text-slate-950"
                >
                  {playing ? '⏸' : '▶'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Native Textbook Caption (Unboxed, matching the page typography) */}
      <div className="z-10 flex flex-wrap items-baseline justify-center gap-x-2 gap-y-0.5 bg-[#fcfbf7] px-2 pt-1 pb-0.5 text-center font-serif text-[12.5px] text-slate-800">
        <span>
          <strong className="mr-1.5 font-bold text-slate-900">{figure.title}.</strong>
          <span className="text-slate-700">{figure.caption}</span>
        </span>
      </div>
    </div>
  )
}
