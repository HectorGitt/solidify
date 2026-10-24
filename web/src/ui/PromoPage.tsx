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
  moduleId: string
  sceneId: string
  superText: string
  subText: string
  setup: (def: SceneDef) => void
  animate: (t: number, progress: number, def: SceneDef) => void
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v))
}

function smoothstep(edge0: number, edge1: number, x: number) {
  const t = clamp01((x - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/**
 * High-DPI animated vector cursor with click ripple ring.
 */
function PromoCursor({ x, y, clicking, label }: { x: number; y: number; clicking?: boolean; label?: string }) {
  return (
    <div
      className="pointer-events-none absolute z-50 transition-none"
      style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-4px, -4px)' }}
    >
      {clicking ? (
        <span className="absolute -left-4 -top-4 h-10 w-10 rounded-full border-2 border-emerald-400 bg-emerald-400/25 scale-110" />
      ) : null}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        style={{
          filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.85))',
          transform: clicking ? 'scale(0.88)' : 'scale(1)',
        }}
      >
        <path
          d="M5 3L23 13.5L14.5 15.8L10.5 24L5 3Z"
          fill="#ffffff"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      {label ? (
        <div className="mt-1 ml-4 whitespace-nowrap rounded-md border border-emerald-400/50 bg-zinc-950/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-300 shadow-lg">
          {label}
        </div>
      ) : null}
    </div>
  )
}

/**
 * The Exact 30-Second Commercial Shot List:
 * - Scene 1 (0–5s): The Hook — "Look inside the machine."
 * - Scene 2A (5–10s): Unmatched Detail (Engine Slicing) — "Interact. Slice. Calculate in real-time."
 * - Scene 2B (10–15s): Unmatched Detail (Gearbox Explode & Forces) — "Interact. Slice. Calculate in real-time."
 * - Scene 3 (15–25s): Accessibility & Modes (Workshop Mobile vs Classroom Laptop) — "From the workshop to the classroom."
 * - Scene 4 (25–30s): Call to Action (3D Gears Spin -> Solidify Logo) — "Master agricultural machinery. Available anywhere at solidify.studio."
 */
const BEATS: PromoBeat[] = [
  // --- SCENE 1: THE HOOK (0.0 - 5.0s) ---
  {
    id: 'scene-1-hook',
    duration: 5.0,
    sceneIndex: 1,
    moduleId: 'field',
    sceneId: 'field',
    superText: 'Look inside the machine.',
    subText: 'Seamless transition from heavy agricultural reality to live browser 3D CAD.',
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setStudioMode('dark')
      v.setCut({ enabled: false })
      v.setXray(false)
      v.setExplode(0)
      useSim.setState({ playing: false, timeScale: 1.4, time: 1.5 })
      def.reset?.()
      def.applyParams?.({ implement: 'plough', unitDraft: 2.8, depth: 0.22, gear: 4, internals: true })
      const c = getCameraControls()
      if (c) void c.setLookAt(-18, 9.5, 20, 0, 0.5, 0, false)
      else flyTo({ position: [-18, 9.5, 20], target: [0, 0.5, 0] }, false)
    },
    animate: (t, p) => {
      // Deterministic tractor motion across the field
      useSim.setState({ playing: false, time: 1.5 + t * 1.35 })
      const c = getCameraControls()
      if (c) {
        // Fast cinematic swoop toward the engine compartment
        const ease = smoothstep(0, 1, p)
        const posX = -18 + ease * 14.8
        const posY = 9.5 - ease * 7.3
        const posZ = 20 - ease * 16.2
        void c.setLookAt(posX, posY, posZ, 0, 0.65, 0, false)
      }
      // At t = 2.6s (p = 0.52), transition into X-Ray CAD drivetrain mode
      const shouldXray = p >= 0.52
      if (useView.getState().xray !== shouldXray) {
        useView.getState().setXray(shouldXray)
      }
    },
  },

  // --- SCENE 2A: UNMATCHED DETAIL — LIVE ENGINE SECTION SLICE (5.0 - 10.0s) ---
  {
    id: 'scene-2a-engine',
    duration: 5.0,
    sceneIndex: 2,
    moduleId: 'engine',
    sceneId: 'four-stroke-diesel',
    superText: 'Interact. Slice. Calculate in real-time.',
    subText: 'Drag section planes at dynamic angles to reveal true hatched internal kinematics.',
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setStudioMode('dark')
      v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
      v.applyPreset('half')
      // Start uncut so the viewer watches the cursor slice through the cylinder block live!
      v.setPlane(0, { normal: [0, 0, 1], pos: 0.22 })
      v.setExplode(0)
      v.setXray(false)
      useSim.setState({ playing: false, timeScale: 1 / 35, time: 0.1 })
      def.applyParams?.({ cycle: 'diesel', r: 17, q: 1650 })
      const c = getCameraControls()
      if (c) void c.setLookAt(0.82, 0.50, 1.18, 0, 0.21, 0, false)
      else flyTo({ position: [0.82, 0.50, 1.18], target: [0, 0.21, 0] }, false)
    },
    animate: (t, p) => {
      // Deterministic 4-stroke piston/valve/injector motion
      useSim.setState({ playing: false, time: 0.1 + t * 0.045 })

      // Live cursor slice from t = 0.3s to t = 1.8s (p: 0.06 -> 0.36)
      const sliceProgress = smoothstep(0.06, 0.36, p)
      const cutPos = 0.22 * (1 - sliceProgress)
      useView.getState().setPlane(0, { normal: [0, 0, 1], pos: cutPos })

      const c = getCameraControls()
      if (c) {
        const angle = p * 0.72 - 0.22
        const radius = 1.28 - Math.sin(p * Math.PI) * 0.14
        const x = Math.sin(angle + 0.65) * radius
        const z = Math.cos(angle + 0.65) * radius
        const y = 0.44 + Math.sin(p * Math.PI) * 0.1
        void c.setLookAt(x, y, z, 0, 0.21, 0, false)
      }
    },
  },

  // --- SCENE 2B: UNMATCHED DETAIL — POWERTRAIN EXPLODE & LIVE FORCES (10.0 - 15.0s) ---
  {
    id: 'scene-2b-gearbox',
    duration: 5.0,
    sceneIndex: 2,
    moduleId: 'powertrain',
    sceneId: 'mf-16-speed',
    superText: 'Interact. Slice. Calculate in real-time.',
    subText: 'Explode 16-speed synchromesh transmissions while gear forces and efficiency update live.',
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setStudioMode('dark')
      v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
      v.applyPreset('side')
      v.select('synchros')
      v.setExplode(0)
      useSim.setState({ playing: false, timeScale: 1 / 20, time: 0.2 })
      def.applyParams?.({ speedShift: 'H', shuttle: 'F', gear: 3, range: 'H', fourWD: true })
      const c = getCameraControls()
      if (c) void c.setLookAt(1.15, 0.44, 0.95, 0, -0.08, 0.38, false)
      else flyTo({ position: [1.15, 0.44, 0.95], target: [0, -0.08, 0.38] }, false)
    },
    animate: (t, p) => {
      useSim.setState({ playing: false, time: 0.2 + t * 0.065 })

      // Cursor drags the Explode slider from p = 0.22 to p = 0.64
      const exp = smoothstep(0.22, 0.64, p) * 0.9
      useView.getState().setExplode(exp)

      const c = getCameraControls()
      if (c) {
        const zTarget = 0.22 + p * 0.36
        const xPos = 1.12 - p * 0.2
        const yPos = 0.38 + Math.sin(p * Math.PI) * 0.12
        void c.setLookAt(xPos, yPos, zTarget + 0.66, 0, -0.08, zTarget, false)
      }
    },
  },

  // --- SCENE 3: ACCESSIBILITY & MODES — SPLIT SCREEN (15.0 - 25.0s) ---
  {
    id: 'scene-3-split',
    duration: 10.0,
    sceneIndex: 3,
    moduleId: 'hydraulics',
    sceneId: 'pumps',
    superText: 'From the workshop to the classroom.',
    subText: 'Professional Mode on mobile for shop diagnostics. Academic Mode on laptop for solved coursework.',
    setup: (def) => {
      const v = useView.getState()
      v.resetView()
      v.setStudioMode('dark')
      v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
      v.applyPreset('half')
      v.setExplode(0.18)
      v.setXray(false)
      useSim.setState({ playing: false, timeScale: 1 / 30, time: 0.2 })
      const c = getCameraControls()
      if (c) void c.setLookAt(0.28, 0.18, 0.38, 0, 0.02, 0, false)
      else flyTo({ position: [0.28, 0.18, 0.38], target: [0, 0.02, 0] }, false)
    },
    animate: (t, p) => {
      // Keep hydraulic gear pump rotating & fluid flowing inside the Left Mobile Workshop frame
      useSim.setState({ playing: false, time: 0.2 + t * 0.05 })
      const c = getCameraControls()
      if (c) {
        const angle = p * 0.85 - 0.3
        const r = 0.42
        // Offset target slightly to the right so the pump centers inside the left split-screen half
        void c.setLookAt(Math.sin(angle) * r, 0.15 + Math.sin(p * Math.PI) * 0.05, Math.cos(angle) * r, 0.09, 0.01, 0, false)
      }
    },
  },

  // --- SCENE 4: CALL TO ACTION — 3D PLANETARY GEARS TO LOGO (25.0 - 30.0s) ---
  {
    id: 'scene-4-cta',
    duration: 5.0,
    sceneIndex: 4,
    moduleId: 'powertrain',
    sceneId: 'planetary',
    superText: 'Master agricultural machinery. Available anywhere at solidify.studio.',
    subText: 'No installation. Instant WebGL 3D cutaways and live physics on any device.',
    setup: (_def) => {
      const v = useView.getState()
      v.resetView()
      v.setStudioMode('dark')
      v.setCut({ enabled: false })
      v.setExplode(0)
      v.setXray(false)
      useSim.setState({ playing: false, timeScale: 1 / 15, time: 0 })
      const c = getCameraControls()
      if (c) void c.setLookAt(0.0, 0.12, 0.58, 0, 0, 0, false)
      else flyTo({ position: [0.0, 0.12, 0.58], target: [0, 0, 0] }, false)
    },
    animate: (t, p) => {
      // Spin planetary gears rapidly until t = 2.2s (27.2s global), then lock into position
      const spinTime = t < 2.2 ? t * 0.22 : 2.2 * 0.22
      useSim.setState({ playing: false, time: spinTime })
      const c = getCameraControls()
      if (c) {
        const zoom = smoothstep(0, 0.44, p)
        const z = 0.58 - zoom * 0.22
        void c.setLookAt(Math.sin(p * 1.2) * 0.08, 0.08 * (1 - zoom), z, 0, 0, 0, false)
      }
    },
  },
]

const TOTAL_DURATION = BEATS.reduce((acc, b) => acc + b.duration, 0) // 30.0s

export default function PromoPage() {
  const [elapsed, setElapsed] = useState(0)
  const [ready, setReady] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const loadedScenes = useRef<Record<string, SceneDef>>({})
  const activeBeatId = useRef<string>('')
  const audioCtxRef = useRef<AudioContext | null>(null)

  // Preload all 5 required 3D scenes before starting the timeline clock
  useEffect(() => {
    let alive = true
    async function preload() {
      for (const b of BEATS) {
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

  // Expose manual time stepping for Playwright frame-accurate capture, plus real-time rAF playback
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
      setElapsed(Math.min(t, TOTAL_DURATION - 0.001))
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
    return () => {
      cancelAnimationFrame(raf)
      setIsRecording(false)
    }
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
  const beatProgress = clamp01(beatTime / currentBeat.duration)
  const sceneKey = `${currentBeat.moduleId}/${currentBeat.sceneId}`
  const activeScene = loadedScenes.current[sceneKey] ?? loadedScenes.current['engine/four-stroke-diesel']

  // Trigger setup when entering a new beat, and animate deterministically on every frame
  useEffect(() => {
    if (!ready || !activeScene) return
    if (activeBeatId.current !== currentBeat.id) {
      activeBeatId.current = currentBeat.id
      currentBeat.setup(activeScene)
    }
    currentBeat.animate(beatTime, beatProgress, activeScene)
  }, [ready, currentBeat, beatTime, beatProgress, activeScene])

  // Optional live Web Audio synth pulse when user clicks Sound in browser
  const toggleLiveAudio = () => {
    if (audioPlaying) {
      void audioCtxRef.current?.close()
      audioCtxRef.current = null
      setAudioPlaying(false)
      return
    }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(55, ctx.currentTime)
    gain.gain.setValueAtTime(0.04, ctx.currentTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    audioCtxRef.current = ctx
    setAudioPlaying(true)
  }

  if (!ready) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-[#09090b] text-ink">
        <div className="flex flex-col items-center gap-3">
          <LogoMark size={48} />
          <div className="font-mono text-xs uppercase tracking-widest text-emerald-400">
            Initializing 3D Engineering Stage…
          </div>
        </div>
      </div>
    )
  }

  const totalScenesCount = countScenes().ready

  // Scene 1 transition states:
  // 0.0s - 2.6s: Full-bleed golden-hour field reality (no browser bar)
  // 2.6s: Optical flash snaps into browser window + X-Ray CAD mode
  const isFieldReality = currentBeat.sceneIndex === 1 && elapsed < 2.6
  const flashOpacity =
    currentBeat.sceneIndex === 1
      ? Math.max(0, 1 - Math.abs(elapsed - 2.6) * 5.5)
      : currentBeat.sceneIndex === 4
        ? Math.max(0, 1 - Math.abs(elapsed - 27.2) * 5.0)
        : 0

  // Scene 4 logo resolve state (gears spin 25.0–27.2s, then lock into Solidify logo at 27.2s)
  const logoLockProgress = currentBeat.sceneIndex === 4 ? smoothstep(27.0, 27.5, elapsed) : 0

  // Scene 2A live telemetry & cursor coordinates
  const sliceFrac = currentBeat.id === 'scene-2a-engine' ? smoothstep(0.06, 0.36, beatProgress) : 1
  const bmepVal = (5.4 + sliceFrac * 1.8).toFixed(1)
  const effVal = (41.2 + sliceFrac * 7.4).toFixed(1)
  const rpmVal = Math.round(1450 + beatProgress * 550)

  // Scene 2B live explode & gear force telemetry
  const explodeFrac = currentBeat.id === 'scene-2b-gearbox' ? smoothstep(0.22, 0.64, beatProgress) : 0
  const gearForceVal = (11.2 + explodeFrac * 3.6).toFixed(1)
  const tractiveEffVal = (72.0 + explodeFrac * 6.4).toFixed(1)

  // Scene 3 Academic Mode auto-typed answer ("44.14")
  const targetAnswer = '44.14'
  const typedCount =
    currentBeat.sceneIndex === 3 ? Math.floor(clamp01((beatTime - 3.2) / 1.8) * targetAnswer.length) : 0
  const typedAnswer = targetAnswer.slice(0, typedCount)
  const answerChecked = currentBeat.sceneIndex === 3 && beatTime >= 5.5

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#09090b] text-ink select-none font-sans">
      {/* Ambient Technical Grid */}
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{
          backgroundImage:
            'radial-gradient(circle at 50% 20%, rgba(16, 185, 129, 0.22), transparent 65%), linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 48px 48px, 48px 48px',
        }}
      />

      {/* 3D WebGL Stage Container */}
      {activeScene ? (
        <div
          className="absolute inset-0 transition-transform duration-300"
          style={{
            filter: isFieldReality
              ? 'sepia(0.28) saturate(1.45) contrast(1.08) brightness(1.05)'
              : currentBeat.sceneIndex === 4 && logoLockProgress > 0.5
                ? `blur(${logoLockProgress * 4}px) brightness(${1 - logoLockProgress * 0.55})`
                : 'none',
          }}
        >
          <Stage scene={activeScene} smooth={false} />

          {/* Golden-Hour Sunlight & Dust Atmosphere (0 - 2.6s) */}
          {isFieldReality ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 82% 18%, rgba(251, 191, 36, 0.38), rgba(217, 119, 6, 0.12) 45%, transparent 70%), linear-gradient(to top, rgba(28, 25, 23, 0.65) 0%, transparent 35%)',
              }}
            />
          ) : (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  'radial-gradient(circle at 55% 48%, transparent 42%, rgba(9, 9, 11, 0.45) 82%, rgba(9, 9, 11, 0.92) 100%), linear-gradient(to top, rgba(9,9,11,0.9) 0%, transparent 30%)',
              }}
            />
          )}
        </div>
      ) : null}

      {/* Optical Transition Flash Overlay (at 2.6s and 27.2s) */}
      {flashOpacity > 0.01 ? (
        <div
          className="pointer-events-none absolute inset-0 z-40 bg-gradient-to-br from-white via-emerald-200 to-emerald-500"
          style={{ opacity: flashOpacity * 0.75 }}
        />
      ) : null}

      {/* Sleek Browser Chrome (Snaps into place at t = 2.6s — no installation bars or downloads) */}
      {!isFieldReality ? (
        <header className="pointer-events-none absolute inset-x-6 top-5 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3 rounded-full border border-white/12 bg-zinc-950/85 px-4 py-2 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500/80" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="h-3.5 w-[1px] bg-white/15" />
            <LogoMark size={18} />
            <span className="font-mono text-xs font-medium text-zinc-200">solidify.studio</span>
            <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-400">
              INSTANT WEBGL CAD
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-zinc-950/85 px-3.5 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur-xl sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span>ZERO INSTALL · BROWSER NATIVE</span>
            </div>
            <button
              onClick={toggleLiveAudio}
              className="pointer-events-auto rounded-full border border-white/10 bg-zinc-950/85 px-3 py-1.5 font-mono text-[11px] text-zinc-300 backdrop-blur-xl hover:border-emerald-500/40"
            >
              {audioPlaying ? '🔊 Sound On' : '🔈 Sound'}
            </button>
          </div>
        </header>
      ) : null}

      {/* =====================================================================
          SCENE 1 (0–5s): THE HOOK — "Look inside the machine."
         ===================================================================== */}
      {currentBeat.sceneIndex === 1 ? (
        <>
          {/* X-Ray CAD Transition Badge after 2.6s */}
          {!isFieldReality ? (
            <div className="pointer-events-none absolute right-8 top-20 z-20 rounded-2xl border border-emerald-500/35 bg-zinc-950/85 p-4 backdrop-blur-2xl shadow-2xl">
              <div className="flex items-center gap-2 font-mono text-[10.5px] font-bold uppercase tracking-wider text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                3D CAD X-Ray Drivetrain Active
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3 font-mono text-xs">
                <div>
                  <div className="text-[10px] text-zinc-400">DRAFT FORCE</div>
                  <div className="text-sm font-bold text-white">18.4 kN</div>
                </div>
                <div>
                  <div className="text-[10px] text-zinc-400">WHEEL SLIP</div>
                  <div className="text-sm font-bold text-emerald-400">11.8 %</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="pointer-events-none absolute inset-x-10 bottom-10 z-20 flex items-end justify-between">
            <div className="max-w-2xl">
              <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/15 bg-zinc-950/75 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-widest text-emerald-400 backdrop-blur-md">
                {isFieldReality ? 'FIELD REALITY · HEAVY TRACTION' : 'SOLIDIFY.STUDIO · WEBGL 3D'}
              </div>
              <h1 className="text-5xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {currentBeat.superText}
              </h1>
              <p className="mt-2 text-base text-zinc-200 drop-shadow">{currentBeat.subText}</p>
            </div>
          </div>
        </>
      ) : null}

      {/* =====================================================================
          SCENE 2A (5–10s): ENGINE CSG SLICE & LIVE P-V TELEMETRY
         ===================================================================== */}
      {currentBeat.id === 'scene-2a-engine' ? (
        <>
          {/* Animated Cursor dragging the section plane across the engine */}
          <PromoCursor
            x={36 + smoothstep(0.04, 0.42, beatProgress) * 24}
            y={48 - smoothstep(0.04, 0.42, beatProgress) * 10}
            clicking={beatProgress >= 0.05 && beatProgress <= 0.38}
            label={beatProgress < 0.4 ? `CSG Section Cut: ${(sliceFrac * 100).toFixed(0)}%` : 'Inspecting Combustion Chamber'}
          />

          {/* Live Section Plane Scrubber Pill */}
          <div className="pointer-events-none absolute left-8 top-20 z-20 w-64 rounded-2xl border border-emerald-500/35 bg-zinc-950/85 p-3.5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between font-mono text-[10.5px] text-emerald-400 font-semibold">
              <span>CSG HALF-SECTION PLANE</span>
              <span>{(sliceFrac * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-emerald-400" style={{ width: `${sliceFrac * 100}%` }} />
            </div>
            <div className="mt-1.5 font-mono text-[10px] text-zinc-400">
              Material Hatching: Cast Iron / Steel
            </div>
          </div>

          {/* Right Live P-V Diagram & Real-Time Physics HUD */}
          <div className="pointer-events-none absolute right-8 top-20 z-20 w-72 rounded-2xl border border-white/12 bg-zinc-950/90 p-4 backdrop-blur-2xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                4-Stroke CI Diesel Solver
              </span>
              <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] text-emerald-400">
                LIVE P–V
              </span>
            </div>

            {/* Dynamic SVG P-V Indicator Loop */}
            <div className="rounded-xl border border-white/8 bg-zinc-900/80 p-2.5">
              <svg viewBox="0 0 220 95" className="w-full h-20 overflow-visible">
                <line x1="24" y1="8" x2="24" y2="82" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <line x1="24" y1="82" x2="205" y2="82" stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
                <path
                  d="M 190 74 Q 75 70 36 22 L 72 22 Q 125 56 190 74 Z"
                  fill="rgba(16, 185, 129, 0.16)"
                  stroke="#10b981"
                  strokeWidth="2"
                />
                {/* Moving operating point along the P-V loop */}
                <circle
                  cx={36 + Math.abs(Math.sin(beatProgress * Math.PI * 2)) * 145}
                  cy={22 + Math.abs(Math.sin(beatProgress * Math.PI * 2)) * 50}
                  r="4.5"
                  fill="#fbbf24"
                  stroke="#09090b"
                  strokeWidth="1.5"
                />
                <text x="30" y="15" fill="#9ca3af" fontSize="9" fontFamily="monospace">
                  P (bar)
                </text>
                <text x="165" y="92" fill="#9ca3af" fontSize="9" fontFamily="monospace">
                  V (cm³)
                </text>
              </svg>
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">BMEP</div>
                <div className="text-sm font-bold text-emerald-400">{bmepVal} bar</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">THERMAL η</div>
                <div className="text-sm font-bold text-emerald-400">{effVal}%</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">SPEED</div>
                <div className="text-sm font-bold text-white">{rpmVal}</div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-10 bottom-10 z-20">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
              {currentBeat.superText}
            </h1>
            <p className="mt-1.5 text-base text-zinc-300">{currentBeat.subText}</p>
          </div>
        </>
      ) : null}

      {/* =====================================================================
          SCENE 2B (10–15s): POWERTRAIN EXPLODE & GEAR FORCE CALCULATIONS
         ===================================================================== */}
      {currentBeat.id === 'scene-2b-gearbox' ? (
        <>
          {/* Animated Cursor dragging the Explode CAD slider */}
          <PromoCursor
            x={14 + explodeFrac * 14}
            y={25}
            clicking={beatProgress >= 0.2 && beatProgress <= 0.66}
            label={`Explode Assembly: ${(explodeFrac * 100).toFixed(0)}%`}
          />

          {/* Interactive Explode Slider Widget on Left */}
          <div className="pointer-events-none absolute left-8 top-20 z-20 w-68 rounded-2xl border border-emerald-500/35 bg-zinc-950/90 p-3.5 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between font-mono text-[10.5px] font-semibold text-emerald-400">
              <span>EXPLODED CAD VIEW</span>
              <span>{(explodeFrac * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-300" style={{ width: `${explodeFrac * 100}%` }} />
            </div>
            <div className="mt-2 flex gap-1.5 font-mono text-[10px]">
              <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-300">Gear 3H Active</span>
              <span className="rounded bg-white/10 px-2 py-0.5 text-zinc-300">16F / 12R Synchro</span>
            </div>
          </div>

          {/* Right Live Gear Tooth Force & Traction Telemetry */}
          <div className="pointer-events-none absolute right-8 top-20 z-20 w-80 rounded-2xl border border-white/12 bg-zinc-950/90 p-4 backdrop-blur-2xl shadow-2xl space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-white">
                Powertrain & Gear Kinetics
              </span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[10px] text-amber-300">
                REAL-TIME
              </span>
            </div>

            <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 font-mono text-xs text-emerald-300">
              <Tex tex="F_t = \frac{2 \cdot T_{\text{pinion}}}{d_p} = 14.8\text{ kN}" display />
            </div>

            <div className="grid grid-cols-3 gap-2 font-mono">
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">TOOTH LOAD</div>
                <div className="text-sm font-bold text-emerald-400">{gearForceVal} kN</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">TRACTIVE η</div>
                <div className="text-sm font-bold text-emerald-400">{tractiveEffVal}%</div>
              </div>
              <div className="rounded-lg border border-white/8 bg-white/[0.03] p-2">
                <div className="text-[9.5px] text-zinc-400">RATIO</div>
                <div className="text-sm font-bold text-white">4.82 : 1</div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-10 bottom-10 z-20">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
              {currentBeat.superText}
            </h1>
            <p className="mt-1.5 text-base text-zinc-300">{currentBeat.subText}</p>
          </div>
        </>
      ) : null}

      {/* =====================================================================
          SCENE 3 (15–25s): SPLIT-SCREEN — WORKSHOP MOBILE vs CLASSROOM LAPTOP
         ===================================================================== */}
      {currentBeat.sceneIndex === 3 ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col justify-between px-8 pt-20 pb-10">
          {/* Center Split Divider Line */}
          <div className="grid flex-1 grid-cols-12 gap-6 items-stretch">
            {/* LEFT HALF: PROFESSIONAL MODE ON MOBILE FRAME (Live 3D Hydraulic Pump shows through!) */}
            <div className="col-span-5 flex flex-col justify-between rounded-[28px] border-2 border-zinc-700/80 bg-zinc-950/35 p-5 shadow-2xl ring-1 ring-white/10">
              {/* Mobile Status Bar */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                    Professional Mode · Mobile
                  </span>
                </div>
                <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
                  Workshop Diagnostics
                </span>
              </div>

              {/* 3D Caliper Overlay on the live 3D Hydraulic Pump */}
              <div className="my-auto flex flex-col items-center">
                <div className="rounded-xl border border-red-500/60 bg-zinc-950/90 px-3.5 py-1.5 font-mono text-xs font-bold text-red-400 shadow-xl">
                  ⊢ 3D Caliper: Gear Pitch 12.4 mm ⊣
                </div>
              </div>

              {/* Bottom Mobile Telemetry Sheet */}
              <div className="rounded-2xl border border-white/12 bg-zinc-950/90 p-3.5 backdrop-blur-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">External Gear Pump · Cutaway</span>
                  <span className="font-mono text-[10px] text-emerald-400">2,100 RPM</span>
                </div>
                <div className="grid grid-cols-3 gap-2 font-mono">
                  <div className="rounded-lg border border-white/8 bg-zinc-900/90 p-2">
                    <div className="text-[9px] text-zinc-400">FLOW RATE</div>
                    <div className="text-xs font-bold text-emerald-400">42.5 L/min</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-zinc-900/90 p-2">
                    <div className="text-[9px] text-zinc-400">RELIEF</div>
                    <div className="text-xs font-bold text-emerald-400">185 bar</div>
                  </div>
                  <div className="rounded-lg border border-white/8 bg-zinc-900/90 p-2">
                    <div className="text-[9px] text-zinc-400">VOL. η</div>
                    <div className="text-xs font-bold text-white">91.2%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT HALF: ACADEMIC MODE ON LAPTOP FRAME (Interactive Solved Exam Problem) */}
            <div className="col-span-7 flex flex-col justify-between rounded-2xl border-2 border-emerald-500/35 bg-zinc-950/92 p-5 backdrop-blur-2xl shadow-2xl">
              <div>
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-white">
                      Academic Mode · Classroom Laptop
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-sky-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-300">
                      AEE509 Past Paper
                    </span>
                    <span className="rounded bg-amber-500/20 px-2 py-0.5 font-mono text-[10px] font-semibold text-amber-300">
                      Errata Flagged
                    </span>
                  </div>
                </div>

                <div className="mt-3 space-y-2.5">
                  <div className="text-sm font-bold text-white">
                    Q1: Four-Cylinder 4-Stroke CI Diesel Brake Power
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Bore <span className="font-mono text-white">D = 100 mm</span>, Stroke{' '}
                    <span className="font-mono text-white">L = 124 mm</span>, Speed{' '}
                    <span className="font-mono text-white">N = 2000 rpm</span>, BMEP{' '}
                    <span className="font-mono text-white">p_b = 6.8 bar</span>. Compute brake power <Tex tex="P_b" />:
                  </p>

                  {/* Live Auto-Typing Answer Input Box */}
                  <div className="flex items-center gap-3 rounded-xl border border-white/15 bg-zinc-900 px-3.5 py-2.5">
                    <span className="font-mono text-xs text-zinc-400">Your Answer:</span>
                    <div className="flex-1 rounded-md border border-emerald-500/50 bg-zinc-950 px-3 py-1 font-mono text-sm font-bold text-white">
                      {typedAnswer}
                      {!answerChecked ? <span className="ml-0.5 text-emerald-400">|</span> : null}
                      <span className="ml-1 text-xs font-normal text-zinc-400">kW</span>
                    </div>
                    {answerChecked ? (
                      <span className="rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 font-mono text-xs font-bold text-emerald-300">
                        ✓ Correct (44.14 kW)
                      </span>
                    ) : (
                      <span className="rounded-lg bg-white/10 px-2.5 py-1 font-mono text-xs text-zinc-300">
                        Checking…
                      </span>
                    )}
                  </div>

                  {/* Step-by-step LaTeX Solution */}
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 font-mono text-xs text-emerald-300">
                    <Tex
                      tex="P_b = \frac{p_b \cdot L \cdot A \cdot (N/2) \cdot n}{60} = \frac{6.8\times 10^5 \times 0.124 \times 7.854\times 10^{-3} \times 1000 \times 4}{60} = 44.14\text{ kW}"
                      display
                    />
                  </div>

                  {/* Flagged Note Discrepancy Box */}
                  <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[11.5px] text-amber-200">
                    <span className="font-mono font-bold uppercase text-amber-400">⚠ Note Errata Flagged: </span>
                    Handout rounds area to <span className="font-mono">0.0073 m²</span> yielding{' '}
                    <span className="font-mono">41.2 kW</span>. Exact <span className="font-mono">πD²/4</span> gives{' '}
                    <span className="font-mono font-bold text-white">44.14 kW</span>.
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 text-xs">
                <span className="font-mono text-zinc-400">
                  {QUESTIONS.length}+ Interactive Exam Problems · {FORMULAS.length}+ Formulas
                </span>
                <span className="rounded-lg bg-emerald-500 px-3 py-1 font-mono text-xs font-bold text-zinc-950">
                  Open in 3D Cutaway →
                </span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h1 className="text-4xl font-black tracking-tight text-white drop-shadow-lg">
              {currentBeat.superText}
            </h1>
            <p className="mt-1 text-base text-zinc-300">{currentBeat.subText}</p>
          </div>
        </div>
      ) : null}

      {/* =====================================================================
          SCENE 4 (25–30s): CALL TO ACTION — GEARS RESOLVE INTO SOLIDIFY LOGO
         ===================================================================== */}
      {currentBeat.sceneIndex === 4 ? (
        <div className="relative z-20 flex h-full flex-col items-center justify-center px-12 text-center">
          {/* Before 27.2s: show spinning 3D planetary gears with kinetic HUD ring */}
          {logoLockProgress < 0.85 ? (
            <div
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-end pb-14"
              style={{ opacity: 1 - logoLockProgress }}
            >
              <div className="rounded-full border border-emerald-500/40 bg-zinc-950/85 px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-emerald-400">
                EPICYCLIC PLANETARY REDUCTION · LOCKING INTO SOLIDIFY CAD
              </div>
            </div>
          ) : null}

          {/* At 27.2s: Solidify Logo & Final Call to Action Lockup */}
          <div
            className="flex flex-col items-center"
            style={{
              opacity: logoLockProgress,
              transform: `scale(${0.88 + logoLockProgress * 0.12})`,
            }}
          >
            <div className="mb-6 grid h-24 w-24 place-items-center rounded-3xl border border-emerald-500/50 bg-zinc-950/90 shadow-[0_0_70px_rgba(16,185,129,0.45)]">
              <LogoMark size={60} />
            </div>

            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-4 py-1 font-mono text-xs font-bold uppercase tracking-[0.22em] text-emerald-300">
              SOLIDIFY.STUDIO
            </div>

            <h1 className="max-w-4xl text-5xl font-black tracking-tight text-white leading-tight drop-shadow-xl">
              Master agricultural machinery.
            </h1>
            <p className="mt-2 text-2xl font-bold text-emerald-400">
              Available anywhere at solidify.studio
            </p>

            <p className="mt-3 max-w-xl text-sm text-zinc-300 font-mono">
              {MODULES.length} Engineering Modules · {totalScenesCount} Interactive 3D Cutaways · Real-Time Physics
            </p>

            <div className="mt-8 flex items-center gap-4">
              <Link
                to="/m/powertrain/line-of-drive"
                className="pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl bg-emerald-500 px-8 py-4 text-base font-bold text-zinc-950 shadow-[0_0_40px_rgba(16,185,129,0.5)] transition-transform hover:scale-105"
              >
                Start Exploring
                <span className="text-lg">→</span>
              </Link>
              <Link
                to="/"
                className="pointer-events-auto rounded-2xl border border-white/15 bg-white/5 px-6 py-4 text-base font-medium text-white hover:bg-white/10"
              >
                Browse Catalogue
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Subtle Bottom Progress Line */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-1 bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-300"
          style={{ width: `${(elapsed / TOTAL_DURATION) * 100}%` }}
        />
      </div>
    </div>
  )
}
