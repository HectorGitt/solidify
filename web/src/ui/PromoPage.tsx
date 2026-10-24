import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { MODULES, countScenes } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { flyTo, getCameraControls, setIsRecording } from './camera'
import { LogoMark } from './Logo'
import { Stage } from './Stage'
import { Tex } from './Tex'
import { QUESTIONS } from '@/study/questions'
import { FORMULAS } from '@/study/formulas'

export interface PromoBeat {
  id: string
  duration: number
  sceneIndex: 1 | 2 | 3 | 4
  moduleId?: string
  sceneId?: string
  headline: string
  subhead: string
  voiceover: string
  actionLabel?: string
  metrics?: { label: string; value: string; unit?: string }[]
  setup?: (def: SceneDef) => void
  animate?: (t: number, progress: number, def: SceneDef) => void
}

/**
 * The Exact 30-Second Commercial Shot List:
 * Scene 1: The Hook (0-5s) - "Look inside the machine."
 * Scene 2: Unmatched Detail (5-15s) - "Interact. Slice. Calculate in real-time."
 *   Part A: 4-Stroke Diesel CSG Cutaway & Combustion (5-10s)
 *   Part B: 16-Speed Synchromesh Gearbox Powertrain & Explosion (10-15s)
 * Scene 3: Accessibility & Modes (15-25s) - "From the workshop to the classroom."
 * Scene 4: Call to Action (25-30s) - "Master agricultural machinery. Available anywhere at solidify.studio."
 */
const BEATS: PromoBeat[] = [
  // --- SCENE 1: THE HOOK (0 - 5.0s) ---
  {
    id: 'scene-1-hook',
    duration: 5.0,
    sceneIndex: 1,
    moduleId: 'field',
    sceneId: 'field',
    headline: 'LOOK INSIDE THE MACHINE.',
    subhead: 'From heavy field draft to real-time WebGL engineering CAD.',
    voiceover: 'Modern agricultural machinery is built for extreme power. But what actually happens inside?',
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setCut({ enabled: false })
      v.setXray(false)
      v.setExplode(0)
      useSim.setState({ playing: true, timeScale: 1.4, time: 2.0 })
      def.reset?.()
      def.applyParams?.({ implement: 'plough', unitDraft: 2.8, depth: 0.22, gear: 4, internals: true })
      const c = getCameraControls()
      if (c) void c.setLookAt(-22, 14, 24, 0, 0, 0, false)
      else flyTo({ position: [-22, 14, 24], target: [0, 0, 0] }, false)
    },
    animate: (_t, p) => {
      const c = getCameraControls()
      if (!c) return
      // Dramatic camera swoop inward toward the engine compartment
      // p: 0.0 -> 1.0 (from far overview [-22, 14, 24] diving into close engine hood [-4.5, 3.2, 5.2])
      const ease = p * p
      const posX = -22 + ease * 17.5
      const posY = 14 - ease * 10.8
      const posZ = 24 - ease * 18.8
      void c.setLookAt(posX, posY, posZ, 0, 0.6, 0, false)

      // In the final second, transition the tractor into X-Ray mode
      const isXray = p > 0.65
      if (useView.getState().xray !== isXray) {
        useView.getState().setXray(isXray)
      }
    },
  },

  // --- SCENE 2A: UNMATCHED DETAIL - ENGINE CUTAWAY (5.0 - 10.0s) ---
  {
    id: 'scene-2a-engine',
    duration: 5.0,
    sceneIndex: 2,
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    headline: 'INTERACT. SLICE. CALCULATE IN REAL-TIME.',
    subhead: 'True hatched CSG section planes. Piston, valves & injector kinematics run in slow motion.',
    voiceover: 'Solidify takes you beneath the metal. Slice any assembly in real time. Watch every mechanism move...',
    actionLabel: 'CURSOR SLICE: CSG HALF-SECTION ACTIVE',
    metrics: [
      { label: 'Bore × Stroke', value: '100 × 124', unit: 'mm' },
      { label: 'Indicated bmep', value: '7.2', unit: 'bar' },
      { label: 'Thermal η', value: '48.6', unit: '%' },
    ],
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
      v.applyPreset('half')
      v.setExplode(0)
      v.setXray(false)
      useSim.setState({ playing: true, timeScale: 1 / 35, time: 0 })
      def.applyParams?.({ cycle: 'diesel', r: 17, q: 1650 })
      const c = getCameraControls()
      if (c) void c.setLookAt(0.85, 0.52, 1.25, 0, 0.22, 0, false)
      else flyTo({ position: [0.85, 0.52, 1.25], target: [0, 0.22, 0] }, false)
    },
    animate: (_t, p) => {
      const c = getCameraControls()
      if (!c) return
      // Cinematic 180-degree sweep around the sectioned combustion cylinder
      const angle = p * 0.75 - 0.25
      const radius = 1.35 - Math.sin(p * Math.PI) * 0.15
      const x = Math.sin(angle + 0.65) * radius
      const z = Math.cos(angle + 0.65) * radius
      const y = 0.46 + Math.sin(p * Math.PI) * 0.12
      void c.setLookAt(x, y, z, 0, 0.21, 0, false)
    },
  },

  // --- SCENE 2B: UNMATCHED DETAIL - GEARBOX POWERTRAIN & EXPLOSION (10.0 - 15.0s) ---
  {
    id: 'scene-2b-gearbox',
    duration: 5.0,
    sceneIndex: 2,
    moduleId: 'powertrain',
    sceneId: 'mf-16-speed',
    headline: 'INTERACT. SLICE. CALCULATE IN REAL-TIME.',
    subhead: '16F/12R synchromesh transmission, speed-shift planetary epicyclic, and live tooth loads.',
    voiceover: '...and size every component with the verified calculations engineers use.',
    actionLabel: 'EXPLODE CAD: DIRECTIONAL ASSEMBLY DISASSEMBLY',
    metrics: [
      { label: 'Transmission', value: '16F / 12R' },
      { label: 'Reduction', value: '4.8 : 1' },
      { label: 'PTO Layshaft', value: '540 / 1000', unit: 'rpm' },
    ],
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
      v.applyPreset('side')
      v.select('synchros')
      v.setExplode(0)
      useSim.setState({ playing: true, timeScale: 1 / 22, time: 0 })
      def.applyParams?.({ speedShift: 'H', shuttle: 'F', gear: 3, range: 'H', fourWD: true })
      const c = getCameraControls()
      if (c) void c.setLookAt(1.18, 0.45, 0.98, 0, -0.08, 0.42, false)
      else flyTo({ position: [1.18, 0.45, 0.98], target: [0, -0.08, 0.42] }, false)
    },
    animate: (_t, p) => {
      // Explode the gearbox casing outward mid-shot
      const exp = p > 0.35 ? Math.sin(Math.min(1, (p - 0.35) * 1.8) * (Math.PI / 2)) * 0.88 : 0
      useView.getState().setExplode(exp)

      const c = getCameraControls()
      if (!c) return
      const zTarget = 0.2 + p * 0.4
      const xPos = 1.12 - p * 0.22
      const yPos = 0.38 + Math.sin(p * Math.PI) * 0.14
      void c.setLookAt(xPos, yPos, zTarget + 0.68, 0, -0.08, zTarget, false)
    },
  },

  // --- SCENE 3: ACCESSIBILITY & MODES (15.0 - 25.0s) ---
  {
    id: 'scene-3-duality',
    duration: 10.0,
    sceneIndex: 3,
    headline: 'FROM THE WORKSHOP TO THE CLASSROOM.',
    subhead: 'Professional Mode for shop inspection. Academic Mode for lecture problem sets & syllabus mastery.',
    voiceover: 'Built for the field and the classroom. From workshop diagnostics to exam-level theory.',
  },

  // --- SCENE 4: CALL TO ACTION (25.0 - 30.0s) ---
  {
    id: 'scene-4-cta',
    duration: 5.0,
    sceneIndex: 4,
    headline: 'MASTER AGRICULTURAL MACHINERY.',
    subhead: 'Available anywhere at solidify.studio',
    voiceover: 'No downloads. Runs on any device. Start exploring at solidify.studio.',
  },
]

const TOTAL_DURATION = BEATS.reduce((acc, b) => acc + b.duration, 0) // Exactly 30.0s

export default function PromoPage() {
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)
  const [simAudio, setSimAudio] = useState(false)
  const loadedScenes = useRef<Record<string, SceneDef>>({})
  const activeBeatId = useRef<string>('')

  // Preload all required 3D scenes before starting the timeline clock
  useEffect(() => {
    let alive = true
    async function preload() {
      const sceneBeats = BEATS.filter((b) => b.moduleId && b.sceneId)
      for (const b of sceneBeats) {
        const key = `${b.moduleId}/${b.sceneId}`
        if (loadedScenes.current[key]) continue
        const mod = MODULES.find((m) => m.id === b.moduleId)
        const entry = mod?.scenes.find((s) => s.id === b.sceneId)
        if (entry?.load) {
          const { default: def } = await entry.load()
          await def.prepare?.()
          loadedScenes.current[key] = def
        }
      }
      if (alive) {
        setReady(true)
        ;(window as unknown as { __promoReady?: boolean }).__promoReady = true
      }
    }
    void preload()
    return () => {
      alive = false
    }
  }, [])

  // Expose manual time stepping for Playwright frame-accurate capture, plus real-time rAF fallback
  useEffect(() => {
    if (!ready) return
    const w = window as unknown as {
      __promoManual?: boolean
      __setPromoTime?: (t: number) => void
      __promoDuration?: number
    }
    w.__promoDuration = TOTAL_DURATION
    w.__setPromoTime = (t: number) => {
      w.__promoManual = true
      setIsRecording(true)
      setElapsed(Math.min(t, TOTAL_DURATION))
    }

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1)
      last = now
      if (!w.__promoManual) {
        setElapsed((prev) => (prev + dt >= TOTAL_DURATION ? 0 : prev + dt))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [ready])

  // Determine current beat and local progress
  let acc = 0
  let currentBeat = BEATS[0]
  let beatTime = 0
  for (const b of BEATS) {
    if (elapsed < acc + b.duration || b === BEATS[BEATS.length - 1]) {
      currentBeat = b
      beatTime = Math.max(0, elapsed - acc)
      break
    }
    acc += b.duration
  }
  const beatProgress = Math.min(1, beatTime / currentBeat.duration)
  const sceneKey = currentBeat.moduleId && currentBeat.sceneId ? `${currentBeat.moduleId}/${currentBeat.sceneId}` : 'engine/four-stroke-diesel'
  const activeScene = loadedScenes.current[sceneKey] ?? loadedScenes.current['engine/four-stroke-diesel']
  const show3D = currentBeat.sceneIndex === 1 || currentBeat.sceneIndex === 2

  // Trigger setup when entering a new beat, and animate on every frame update
  useEffect(() => {
    if (!ready) return
    if (activeBeatId.current !== currentBeat.id) {
      activeBeatId.current = currentBeat.id
      if (activeScene && currentBeat.setup) {
        currentBeat.setup(activeScene)
      }
    }
    if (activeScene && currentBeat.animate) {
      currentBeat.animate(beatTime, beatProgress, activeScene)
    }
  }, [ready, currentBeat, beatTime, beatProgress, activeScene])

  if (!ready) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-[#09090b] text-ink">
        <div className="flex flex-col items-center gap-3">
          <LogoMark size={44} />
          <div className="font-mono text-xs uppercase tracking-widest text-emerald-400">Loading 3D Machinery Models…</div>
        </div>
      </div>
    )
  }

  const totalScenesCount = countScenes().ready

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#09090b] text-ink select-none font-sans">
      {/* Background Grid & Ambient Glow */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.22), transparent 65%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      {/* 3D Viewport Layer (active for Scene 1 & 2) */}
      {activeScene ? (
        <div className={`absolute inset-0 transition-opacity duration-500 ${show3D ? 'opacity-100' : 'opacity-10 blur-[3px]'}`}>
          <Stage key={activeScene.id} scene={activeScene} smooth={false} />
          {/* Subtle Studio Vignette */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(circle at 60% 50%, transparent 40%, rgba(9, 9, 11, 0.5) 80%, rgba(9, 9, 11, 0.95) 100%), linear-gradient(to right, rgba(9,9,11,0.85) 0%, rgba(9,9,11,0.2) 40%, transparent 65%), linear-gradient(to top, rgba(9,9,11,0.92) 0%, transparent 32%)',
            }}
          />
        </div>
      ) : null}

      {/* Browser Shell Frame (Top Bar) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-zinc-950/80 px-4 py-2 backdrop-blur-xl shadow-lg">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
          </div>
          <span className="h-3 w-[1px] bg-white/15" />
          <LogoMark size={20} />
          <span className="font-mono text-xs text-zinc-300">solidify.studio</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 font-mono text-[10px] text-emerald-400 font-semibold">
            WEBGL 3D
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-zinc-950/80 px-4 py-2 font-mono text-[11px] text-zinc-300 backdrop-blur-xl">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Scene {currentBeat.sceneIndex}/4</span>
            <span className="text-zinc-600">·</span>
            <span className="text-emerald-400">{elapsed.toFixed(1)}s / 30.0s</span>
          </div>

          {/* Sound Toggle Simulator */}
          <button
            onClick={() => setSimAudio(!simAudio)}
            className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-zinc-950/80 px-3 py-2 text-xs text-zinc-300 backdrop-blur-xl hover:border-emerald-500/40 transition-colors"
            title="Audio Cues Active"
          >
            <span>{simAudio ? '🔊 Stereo Audio On' : '🔈 Audio FX Cues'}</span>
          </button>
        </div>
      </header>

      {/* --- SCENE 1: THE HOOK HUD OVERLAY --- */}
      {currentBeat.sceneIndex === 1 ? (
        <div className="pointer-events-none absolute inset-x-12 bottom-14 z-20 flex items-end justify-between">
          <div className="max-w-2xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-md">
              SCENE 1 · THE HOOK (00:00 – 00:05)
            </div>
            <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-lg leading-tight">
              {currentBeat.headline}
            </h1>
            <p className="text-lg text-zinc-300 drop-shadow">{currentBeat.subhead}</p>
          </div>

          <div className="rounded-2xl border border-white/12 bg-zinc-950/85 p-4 backdrop-blur-2xl shadow-2xl">
            <div className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 font-semibold mb-1">
              Field Traction Telemetry
            </div>
            <div className="text-xs text-zinc-300 font-mono space-y-1">
              <div>Brixius ASABE Model: <span className="text-white">Active</span></div>
              <div>Implement: <span className="text-emerald-300">3-Bottom Mouldboard Plough</span></div>
              <div>Drivetrain Mode: <span className="text-amber-300">{beatProgress > 0.65 ? 'X-Ray Drivetrain' : 'Solid Chassis'}</span></div>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- SCENE 2: UNMATCHED DETAIL HUD OVERLAY --- */}
      {currentBeat.sceneIndex === 2 ? (
        <div className="pointer-events-none absolute inset-x-12 bottom-14 z-20 flex items-end justify-between">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 backdrop-blur-md">
              SCENE 2 · UNMATCHED DETAIL (00:05 – 00:15)
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-md">
              {currentBeat.headline}
            </h1>
            <p className="text-base text-zinc-300 drop-shadow">{currentBeat.subhead}</p>
            {currentBeat.actionLabel ? (
              <div className="inline-block rounded border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-300">
                {currentBeat.actionLabel}
              </div>
            ) : null}
          </div>

          {currentBeat.metrics ? (
            <div className="flex gap-3 rounded-2xl border border-white/12 bg-zinc-950/85 p-4 backdrop-blur-2xl shadow-2xl">
              {currentBeat.metrics.map((m) => (
                <div key={m.label} className="min-w-[135px] rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
                  <div className="font-mono text-[10.5px] uppercase tracking-wider text-zinc-400">{m.label}</div>
                  <div className="mt-1 font-mono text-xl font-bold text-emerald-400">
                    {m.value} {m.unit ? <span className="text-xs font-normal text-zinc-400">{m.unit}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* --- SCENE 3: ACCESSIBILITY & MODES (DYNAMIC SPLIT SCREEN) --- */}
      {currentBeat.sceneIndex === 3 ? (
        <div className="relative z-20 flex h-full flex-col justify-center px-12 pt-16">
          <div className="mb-6 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300 mb-2">
              SCENE 3 · ACCESSIBILITY & MODES (00:15 – 00:25)
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white">{currentBeat.headline}</h1>
            <p className="mt-1.5 text-base text-zinc-300">{currentBeat.subhead}</p>
          </div>

          <div className="grid grid-cols-12 gap-8 items-stretch">
            {/* LEFT SPLIT: PROFESSIONAL MODE (Workshop & Field Mobile) */}
            <div className="col-span-6 rounded-2xl border border-white/12 bg-zinc-900/90 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Professional Mode · Workshop & Field
                    </span>
                  </div>
                  <span className="font-mono text-[11px] text-zinc-400">Mobile & Tablet Optimized</span>
                </div>

                <div className="rounded-xl border border-white/8 bg-zinc-950/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">Hydraulic Circuit Diagnostics</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-xs text-emerald-300">
                      Live Telemetry
                    </span>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Inspect hydraulic spool valves, test relief pressure thresholds, and verify pump flow displacement directly on the shop floor or tractor cab.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="rounded-lg border border-white/5 bg-zinc-900/60 p-2.5">
                      <div className="text-[10px] text-zinc-500 uppercase">Max Flow</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">42.5 L/min</div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-900/60 p-2.5">
                      <div className="text-[10px] text-zinc-500 uppercase">Relief Valve</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">185 bar</div>
                    </div>
                    <div className="rounded-lg border border-white/5 bg-zinc-900/60 p-2.5">
                      <div className="text-[10px] text-zinc-500 uppercase">3D Caliper</div>
                      <div className="font-mono text-sm font-bold text-emerald-400">12.4 mm</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-white/5">
                <span>Touch Gestures · Zero Installs</span>
                <span className="text-emerald-400 font-medium">Field-Ready PWA →</span>
              </div>
            </div>

            {/* RIGHT SPLIT: ACADEMIC MODE (Lecture Hall & Solved Problems) */}
            <div className="col-span-6 rounded-2xl border border-emerald-500/30 bg-zinc-900/90 p-6 backdrop-blur-xl shadow-2xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-amber-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Academic Mode · University Coursework
                    </span>
                  </div>
                  <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[11px] text-amber-300">
                    Exam Errata Flagged
                  </span>
                </div>

                <div className="rounded-xl border border-white/8 bg-zinc-950/80 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-white">AEE509: Engine Indicated Power Problem</span>
                    <span className="text-xs font-mono text-emerald-400">1-Click 3D Link →</span>
                  </div>
                  <p className="text-xs text-zinc-400">
                    4-cylinder 4-stroke CI diesel (100 mm bore × 124 mm stroke, 2000 rpm, 6.8 bar bmep).
                  </p>
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-2.5 font-mono text-xs text-emerald-300">
                    <Tex
                      tex="P_b = \frac{p_b \cdot L \cdot A \cdot N \cdot n}{120} = 44.14\text{ kW} \quad (\text{Marking slip flagged: } 41.2\text{ kW})"
                      display
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs text-zinc-400 pt-3 border-t border-white/5">
                <span>{QUESTIONS.length}+ Solved Past Papers</span>
                <span className="text-emerald-400 font-medium">{FORMULAS.length}+ Searchable Formulas →</span>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* --- SCENE 4: CALL TO ACTION --- */}
      {currentBeat.sceneIndex === 4 ? (
        <div className="relative z-20 flex h-full flex-col items-center justify-center px-12 text-center">
          <div className="mb-6 grid h-24 w-24 place-items-center rounded-3xl border border-emerald-500/40 bg-emerald-500/10 shadow-[0_0_60px_rgba(16,185,129,0.3)]">
            <LogoMark size={56} />
          </div>

          <div className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-1 font-mono text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300 mb-3">
            SOLIDIFY.STUDIO
          </div>

          <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white leading-tight">
            Master Agricultural Machinery.
          </h1>

          <p className="mt-4 max-w-xl text-lg text-zinc-300">
            {MODULES.length} Comprehensive Modules · {totalScenesCount} Interactive 3D Cutaways · Live Physics · Instant Access
          </p>

          <div className="mt-8 flex items-center gap-4">
            <Link
              to="/m/powertrain/line-of-drive"
              className="pointer-events-auto inline-flex items-center gap-2.5 rounded-xl bg-emerald-500 px-8 py-4 font-semibold text-zinc-950 text-base shadow-xl shadow-emerald-500/25 transition-all hover:bg-emerald-400 hover:scale-105 active:scale-95"
            >
              Start Exploring Free
              <span className="text-lg">→</span>
            </Link>
            <Link
              to="/"
              className="pointer-events-auto rounded-xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10 transition-colors"
            >
              Learn More
            </Link>
          </div>

          <div className="mt-10 font-mono text-xs tracking-wider text-zinc-500">
            NO INSTALLATION NEEDED · ACCESSIBLE ON ANY BROWSER AT SOLIDIFY.STUDIO
          </div>
        </div>
      ) : null}

      {/* Floating Bottom Voiceover / Narration Teleprompter Bar */}
      <footer className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex flex-col items-center">
        <div className="max-w-3xl rounded-full border border-white/10 bg-zinc-950/90 px-6 py-2.5 backdrop-blur-xl shadow-2xl flex items-center gap-3">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-xs font-semibold text-emerald-300 uppercase tracking-wider">Voiceover:</span>
          <span className="text-xs text-zinc-200 italic font-sans">{currentBeat.voiceover}</span>
        </div>

        {/* Global Progress Line */}
        <div className="mt-2 h-1 w-full max-w-4xl overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
            style={{ width: `${(elapsed / TOTAL_DURATION) * 100}%` }}
          />
        </div>
      </footer>
    </div>
  )
}
