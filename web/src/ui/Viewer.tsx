import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChallengeHud, ChallengeMenu } from '@/challenges/ChallengeHud'
import { challengesFor } from '@/challenges/registry'
import { useChallenge } from '@/challenges/store'
import { useSim } from '@/core/sim'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { useAcademic } from './audience'
import { AudienceSwitch } from './AudienceSwitch'
import { Badge } from './controls'
import { LogoMark } from './Logo'
import { Icon } from './icons'
import { PartCard } from './PartCard'
import { PartsTree } from './PartsTree'
import { Stage } from './Stage'
import { Toolbar } from './Toolbar'
import { TourPlayer, useTour } from './TourPlayer'
import { restoreCamera, useTrail } from './trail'
import { active, useFade } from './navigate'
import { describeContext } from '@/content/context'
import { SeenIn } from './SeenIn'
import { ComparePanel } from './Compare'
import { dropInside, exitInside, useInside } from './inside'
import { TelemetryTag } from './TelemetryTag'
import { PowerPath, PowerPathButton } from './PowerPath'
import { WholeButton, WholePanel } from './WholePanel'
import { useParts } from '@/parts/registry'
import { focusPart } from './camera'
import { onSceneReady } from '@/study/bridge'
import { SceneMark } from '@/study/ui/badges'
import { StudyLinks } from '@/study/ui/StudyShell'

function useMediaQuery(q: string) {
  const [m, setM] = useState(() => window.matchMedia(q).matches)
  useEffect(() => {
    const mq = window.matchMedia(q)
    const on = () => setM(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [q])
  return m
}

export function Viewer() {
  const { moduleId = '', sceneId } = useParams()
  const navigate = useNavigate()
  const mod = findModule(moduleId)
  const entry = mod?.scenes.find((s) => s.id === sceneId) ?? mod?.scenes.find((s) => s.load)
  const [scene, setScene] = useState<SceneDef | null>(null)
  const [error, setError] = useState<string | null>(null)
  const wide = useMediaQuery('(min-width: 1100px)')
  const [leftOpen, setLeftOpen] = useState(wide)
  const [rightOpen, setRightOpen] = useState(wide)
  const tourActive = useTour((s) => s.active)
  const academic = useAcademic()
  const startTour = useTour((s) => s.start)
  const stopTour = useTour((s) => s.stop)
  const [search, setSearch] = useSearchParams()
  const [notice, setNotice] = useState<string | null>(null)
  const [power, setPower] = useState(false)
  const fade = useFade((s) => s.fade)
  useEffect(() => {
    if (!notice) return
    const t = window.setTimeout(() => setNotice(null), 6000)
    return () => window.clearTimeout(t)
  }, [notice])
  const challengeId = search.get('challenge')

  useEffect(() => {
    setLeftOpen(wide)
    setRightOpen(wide)
  }, [wide])

  useEffect(() => {
    let alive = true
    setScene(null)
    setError(null)
    setPower(false)
    stopTour()
    useChallenge.getState().stop()
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        const v = useView.getState()
        v.resetView()
        v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
        v.applyPreset(def.defaultPreset ?? (def.cutPresets ?? DEFAULT_CUT_PRESETS)[0].id)
        // no default preset: open whole (the first preset stays selected for the cut button)
        if (def.defaultPreset === undefined) v.setCut({ enabled: false })
        useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 50, time: 0 })
        def.reset?.()
        onSceneReady(entry?.id ?? def.id, def)
        setScene(def)
        const route = `${mod?.id}/${entry?.id}`
        active.scene = def
        dropInside()
        active.route = route
        // arriving from another scene: carried-over live values, and the part to select
        const arrival = useTrail.getState().consumeArrival(route)
        if (arrival?.context && def.fromContext) {
          const p = def.fromContext(arrival.context)
          if (p && Object.keys(p).length) {
            def.applyParams?.(p)
            setNotice(`Carried over: ${describeContext(arrival.context)}`)
          }
        }
        if (arrival?.selectName) {
          const name = arrival.selectName
          window.setTimeout(() => {
            const hit = Object.values(useParts.getState().parts).find((x) => x.name === name)
            if (hit) {
              useView.getState().select(hit.id)
              focusPart(hit.id)
            }
          }, 450)
        }
        window.setTimeout(() => useFade.getState().set(0), 120)
        // coming back up a drill-down trail: put the camera and selection back
        const stop = useTrail.getState().consumeRestore(route)
        if (stop) {
          window.setTimeout(() => {
            restoreCamera(stop.camera)
            if (stop.selected) useView.getState().select(stop.selected)
          }, 350)
        }
        document.title = `${def.title} · Solidify`
      })
      .catch((e: unknown) => {
        useFade.getState().set(0)
        if (alive) setError(String(e))
      })
    return () => {
      alive = false
    }
  }, [entry, stopTour])

  // a challenge link (#/m/…?challenge=id) starts it once the scene is ready
  useEffect(() => {
    if (!scene || !challengeId || !entry) return
    let alive = true
    challengesFor(mod?.id ?? '', entry.id).then((list) => {
      const c = list.find((x) => x.id === challengeId)
      if (!alive || !c) return
      useChallenge.getState().start(c, scene.applyParams)
      useSim.setState({ playing: true })
      setSearch({}, { replace: true })
    })
    return () => {
      alive = false
    }
  }, [scene, challengeId, entry, mod?.id, setSearch])

  // leaving the viewer: no active scene for search / drill-down to come back to
  useEffect(
    () => () => {
      active.scene = null
      dropInside()
      active.route = ''
    },
    [],
  )

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return
      const v = useView.getState()
      if (e.key === ' ') {
        e.preventDefault()
        useSim.getState().toggle()
      } else if (e.key === 'c') v.setCut({ enabled: !v.cut.enabled })
      else if (e.key === 'x') v.setXray(!v.xray)
      else if (e.key === 'l') v.setLabels(!v.labels)
      else if (e.key === 'Escape' && !useTour.getState().active) {
        v.select(null)
        v.isolate(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!mod) {
    return (
      <div className="grid h-full place-items-center text-mute">
        <div className="text-center">
          <p className="mb-3">That module doesn’t exist.</p>
          <Link className="text-accent hover:underline" to="/">
            Back to all modules
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-panel px-2">
        <Link to="/" className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] font-semibold text-ink hover:bg-panel-3" aria-label="All modules">
          <LogoMark size={20} />
          <span className="hidden sm:inline">Solidify</span>
        </Link>
        <span className="text-line-2">/</span>
        <span className="hidden text-[13px] text-mute md:inline">
          {mod.title}
        </span>
        <span className="hidden text-line-2 md:inline">/</span>
        <select
          aria-label="Scene"
          className="min-w-0 max-w-[50vw] truncate rounded-md border border-line-2 bg-panel-2 px-2 py-1 text-[13px] text-ink"
          value={entry?.id}
          onChange={(e) => navigate(`/m/${mod.id}/${e.target.value}`)}
        >
          {mod.scenes.map((s) => (
            <option key={s.id} value={s.id} disabled={!s.load}>
              {s.title}
              {s.load ? '' : ' (coming soon)'}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new Event('solidify:search'))}
            className="hidden items-center gap-1.5 rounded-md border border-line-2 px-2 py-1 text-[12px] text-mute hover:text-ink md:flex"
            title="Search every part and scene (Ctrl/⌘ K)"
          >
            <Icon.target width={13} height={13} /> Search parts <kbd className="rounded border border-line-2 px-1 text-[10px]">Ctrl K</kbd>
          </button>
          {scene ? <WholeButton /> : null}
          {scene ? <PowerPathButton onStart={() => setPower(true)} /> : null}
          <StudyLinks compact className="hidden lg:flex" />
          <div className="hidden md:block">
            <AudienceSwitch compact />
          </div>
          {scene && entry ? <ChallengeMenu moduleId={mod.id} sceneId={entry.id} scene={scene} /> : null}
          {scene?.tour?.length ? (
            <button
              onClick={() => (tourActive ? stopTour() : startTour())}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium ${tourActive ? 'bg-accent text-accent-ink' : 'border border-accent/50 text-accent hover:bg-accent/10'}`}
            >
              <Icon.tour width={15} height={15} />
              <span className="hidden sm:inline">{tourActive ? 'End tour' : 'Guided tour'}</span>
            </button>
          ) : null}
          <button aria-label="Toggle parts panel" aria-pressed={leftOpen} onClick={() => setLeftOpen((o) => !o)} className={`grid h-8 w-8 place-items-center rounded-md ${leftOpen ? 'text-accent' : 'text-mute'} hover:bg-panel-3`}>
            <Icon.panel />
          </button>
          <button aria-label="Toggle controls panel" aria-pressed={rightOpen} onClick={() => setRightOpen((o) => !o)} className={`grid h-8 w-8 place-items-center rounded-md ${rightOpen ? 'text-accent' : 'text-mute'} hover:bg-panel-3`}>
            <Icon.sliders />
          </button>
        </div>
      </header>

      <TrailBar
        current={entry?.title ?? ''}
        onBack={(route) => {
          useFade.getState().set(1)
          window.setTimeout(() => navigate(`/m/${route}`), 220)
        }}
      />
      <div className="relative flex min-h-0 flex-1">
        {leftOpen ? (
          <aside className={`${wide ? 'relative' : 'absolute inset-y-0 left-0 z-20 shadow-2xl'} flex w-64 shrink-0 flex-col border-r border-line bg-panel`}>
            <div className="border-b border-line px-3 py-2.5">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Scenes</div>
              <ul className="space-y-0.5">
                {mod.scenes.map((s) => (
                  <li key={s.id}>
                    {s.load ? (
                      <Link
                        to={`/m/${mod.id}/${s.id}`}
                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] transition-colors ${
                          s.id === entry?.id
                            ? 'bg-accent/15 text-accent font-medium border border-accent/25'
                            : 'text-ink/80 hover:bg-panel-2 hover:text-ink'
                        }`}
                      >
                        {academic ? <SceneMark sceneId={s.id} /> : null}
                        <span className="truncate">{s.title}</span>
                        {academic && s.exam ? <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-warn" title="Frequently examined" /> : null}
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2 py-1 text-[12.5px] text-dim" title="Coming soon">
                        <span className="truncate">{s.title}</span>
                        <span className="ml-auto text-[10px]">soon</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2.5">
              <div className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">Parts</div>
              <PartsTree />
              <p className="mt-3 px-1 text-[11px] leading-snug text-dim">Click a part to inspect it. Double-click to focus. Hover a row to hide it.</p>
            </div>
          </aside>
        ) : null}

        <main className="relative min-w-0 flex-1 bg-bg">
          {scene ? <Stage key={scene.id} scene={scene} /> : null}
          {!scene && !error ? (
            <div className="absolute inset-0 grid place-items-center text-[13px] text-mute">{entry?.load ? 'Building the model…' : 'This scene is coming soon.'}</div>
          ) : null}
          {error ? <div className="absolute inset-0 grid place-items-center text-danger">{error}</div> : null}
          {/* dive-in transition between scenes */}
          <div className="pointer-events-none absolute inset-0 z-30 bg-bg transition-opacity duration-300" style={{ opacity: fade }} />
          {scene ? (
            <>
              {wide || !tourActive ? (
                <div className="pointer-events-none absolute left-3 top-3 z-10">
                  <PartCard />
                </div>
              ) : null}
              <div className="pointer-events-none absolute bottom-16 left-3 z-10">
                <TourPlayer scene={scene} />
              </div>
              {power ? null : <TelemetryTag />}
              {power ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center">
                  <PowerPath onClose={() => setPower(false)} />
                </div>
              ) : null}
              <div className="pointer-events-none absolute right-3 top-3 z-10">
                <ChallengeHud />
              </div>
              <InsidePill />
              <WholePanel />
              {notice ? (
                <div className="pointer-events-auto absolute left-1/2 top-3 z-20 -translate-x-1/2 rounded-full border border-accent/40 bg-panel/95 px-3 py-1 text-[12px] text-ink shadow-xl">
                  <span className="text-accent">↳ </span>
                  {notice}
                  <button className="ml-2 text-dim hover:text-ink" onClick={() => setNotice(null)} aria-label="Dismiss">
                    ×
                  </button>
                </div>
              ) : null}
              <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 flex justify-center">
                <Toolbar scene={scene} />
              </div>
            </>
          ) : null}
        </main>

        {rightOpen && scene ? (
          <aside className={`${wide ? 'relative' : 'absolute inset-y-0 right-0 z-20 shadow-2xl'} flex w-[min(380px,100vw)] shrink-0 flex-col border-l border-line bg-panel`}>
            <div className="border-b border-line px-4 py-3">
              <h1 className="text-[15px] font-semibold leading-snug text-ink">{scene.title}</h1>
              <p className="mt-1 text-[12.5px] leading-relaxed text-mute">{scene.summary}</p>
              {mod && entry ? <SeenIn route={`${mod.id}/${entry.id}`} /> : null}
              {academic && entry?.exam ? (
                <div className="mt-2">
                  <Badge tone="warn">Frequently examined</Badge>
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ComparePanel key={scene.id} scene={scene} />
              {scene.Panel ? <scene.Panel /> : null}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/** While looking inside a part in place: what you are in, and the way back out. */
function InsidePill() {
  const name = useInside((s) => s.name)
  const id = useInside((s) => s.id)
  const loading = useInside((s) => s.loading)
  const mode = useInside((s) => s.mode)
  if (!id || mode === 'whole') return null
  return (
    <div className="pointer-events-auto absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-accent/40 bg-panel/95 py-1 pl-3 pr-1 text-[12px] text-ink shadow-xl">
      <span>
        Inside the <b>{name.toLowerCase()}</b> <span className="text-dim">{loading ? '· building it…' : '· slow motion · click any part'}</span>
      </span>
      <button onClick={exitInside} className="rounded-full bg-accent px-2.5 py-0.5 font-medium text-accent-ink hover:brightness-110">
        Back
      </button>
    </div>
  )
}

/** Drill-down breadcrumbs: where you came from, and the way back. */
function TrailBar({ current, onBack }: { current: string; onBack: (route: string) => void }) {
  const stops = useTrail((s) => s.stops)
  const back = useTrail((s) => s.back)
  const clear = useTrail((s) => s.clear)
  if (!stops.length) return null
  const last = stops[stops.length - 1]
  return (
    <div className="flex h-9 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-panel-2/60 px-2 text-[12px]">
      <button
        onClick={() => {
          const s = back()
          if (s) onBack(s.route)
        }}
        className="flex shrink-0 items-center gap-1 rounded-md border border-accent/40 px-2 py-0.5 font-medium text-accent hover:bg-accent/10"
      >
        <Icon.back width={13} height={13} /> Back to {last.title}
      </button>
      <nav aria-label="Drill-down trail" className="flex min-w-0 items-center gap-1 text-mute">
        {stops.map((s, i) => (
          <span key={i} className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                const st = back(i)
                if (st) onBack(st.route)
              }}
              className="rounded px-1 hover:bg-panel-3 hover:text-ink"
              title={s.via ? `Opened from: ${s.via}` : undefined}
            >
              {s.title}
            </button>
            <span className="text-dim">›</span>
            {s.via ? <span className="text-dim">{s.via} ›</span> : null}
          </span>
        ))}
        <span className="shrink-0 font-medium text-ink">{current}</span>
      </nav>
      <button onClick={clear} aria-label="Clear the trail" className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-dim hover:bg-panel-3 hover:text-ink">
        <Icon.close width={12} height={12} />
      </button>
    </div>
  )
}
