import { useEffect, useState } from 'react'
import { BuildHud } from './BuildHud'
import { useBuild } from '@/render/build'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ChallengeHud } from '@/challenges/ChallengeHud'
import { challengesFor } from '@/challenges/registry'
import { useChallenge } from '@/challenges/store'
import { useSim } from '@/core/sim'
import { LabHud } from '@/lab/run'
import { MODULES, findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { useAcademic } from './audience'
import { Loader } from './Loader'
import { Badge } from './controls'
import { Icon } from './icons'
import { SiteHeader } from './SiteHeader'
import { PartCard } from './PartCard'
import { PartsTree } from './PartsTree'
import { OrientationGizmo, Stage } from './Stage'
import { Toolbar } from './Toolbar'
import { TourPlayer, useTour } from './TourPlayer'
import { restoreCamera, useTrail } from './trail'
import { active, useFade } from './navigate'
import { describeContext } from '@/content/context'
import { SeenIn } from './SeenIn'
import { ComparePanel } from './Compare'
import { dropInside, exitInside, useInside } from './inside'
import { TelemetryTag } from './TelemetryTag'
import { PowerPath } from './PowerPath'
import { WholePanel } from './WholePanel'
import { useParts } from '@/parts/registry'
import { currentPose, flyTo, focusPart } from './camera'
import { onSceneReady } from '@/study/bridge'
import { SceneMark } from '@/study/ui/badges'
import { InSceneExam, questionsForScene } from '@/study/ui/InSceneExam'
import { SceneMenu } from './SceneMenu'
import { TutorButton, TutorPanel } from '@/cloud/ui/Tutor'
import { FoldChevron, usePersisted } from './usePersisted'

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
  const [rightTab, setRightTab] = useState<'controls' | 'exam'>('controls')
  const [detailsOpen, setDetailsOpen] = usePersisted('solidify.panel.details', true)
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
  const sceneQuestions = entry && mod ? questionsForScene(mod.id, entry.id) : []

  const copyShareLink = () => {
    if (!mod || !entry) return
    const v = useView.getState()
    const params = new URLSearchParams()
    params.set('cut', v.cut.enabled ? '1' : '0')
    if (v.cut.planes[0]) params.set('pos', v.cut.planes[0].pos.toFixed(3))
    if (v.explode > 0.01) params.set('explode', v.explode.toFixed(2))
    if (v.xray) params.set('xray', '1')
    const pose = currentPose()
    if (pose) {
      params.set('cam', [...pose.position, ...pose.target].map((n) => n.toFixed(2)).join(','))
    }
    const shareUrl = `${window.location.origin}${window.location.pathname}#/m/${mod.id}/${entry.id}?${params.toString()}`
    void navigator.clipboard?.writeText(shareUrl)
    setNotice('Copied shareable 3D view link to clipboard')
  }

  useEffect(() => {
    setLeftOpen(wide)
    setRightOpen(wide)
  }, [wide])

  useEffect(() => {
    let alive = true
    // a build in progress belongs to the scene it started in
    useBuild.getState().stop()
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
        // Restore shared deep-link view parameters (?cut=...&pos=...&explode=...&xray=...&cam=...)
        const qCut = search.get('cut')
        const qPos = search.get('pos')
        const qExp = search.get('explode')
        const qXray = search.get('xray')
        const qCam = search.get('cam')
        if (qCut !== null) v.setCut({ enabled: qCut === '1' })
        if (qPos !== null && !Number.isNaN(parseFloat(qPos))) v.setPlane(0, { pos: parseFloat(qPos) })
        if (qExp !== null && !Number.isNaN(parseFloat(qExp))) v.setExplode(parseFloat(qExp))
        if (qXray === '1') v.setXray(true)
        if (qCam) {
          const nums = qCam.split(',').map(Number)
          if (nums.length === 6 && nums.every((x) => !Number.isNaN(x))) {
            window.setTimeout(() => {
              flyTo({ position: [nums[0], nums[1], nums[2]], target: [nums[3], nums[4], nums[5]] }, false)
            }, 220)
          }
        }
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
      } else if (e.key === 'c') {
        if (!v.cut.enabled && v.cut.planes.length === 0 && v.cutPresets[0]) v.applyPreset(v.cutPresets[0].id)
        else v.setCut({ enabled: !v.cut.enabled })
      }
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
      {/* the site's own header, as on every page; the rig's bar sits under it */}
      <SiteHeader width="max-w-none" />
      <header className="flex shrink-0 flex-wrap items-center gap-1 border-b border-line bg-panel px-1.5 py-1 sm:h-11 sm:flex-nowrap sm:gap-2 sm:px-3 sm:py-0">
        <Link to="/labs" className="rounded-md px-1.5 py-1 text-[13px] font-medium text-mute hover:bg-panel-3 hover:text-ink">
          Labs
        </Link>
        <span className="text-line-2" aria-hidden>›</span>
        <span className="hidden text-[13px] text-mute md:inline">
          <select
            aria-label="Module"
            className="rounded-md border border-line-2 bg-panel-2 px-2 py-1 text-[13px] text-mute hover:text-ink"
            value={mod.id}
            onChange={(e) => {
              const nextMod = findModule(e.target.value)
              const first = nextMod?.scenes.find((s) => s.load) ?? nextMod?.scenes[0]
              if (nextMod && first) navigate(`/m/${nextMod.id}/${first.id}`)
            }}
          >
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </span>
        <span className="hidden text-line-2 md:inline" aria-hidden>›</span>
        <select
          aria-label="Scene"
          className="order-last min-w-0 basis-full truncate rounded-md border border-line-2 bg-panel-2 px-2 py-1.5 text-[13px] text-ink sm:order-none sm:max-w-[50vw] sm:basis-auto sm:py-1"
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
        <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
          <button
            onClick={() => window.dispatchEvent(new Event('solidify:search'))}
            aria-label="Search parts and scenes"
            className="grid h-8 w-8 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink"
            title="Search every part and scene (Ctrl/⌘ K)"
          >
            <Icon.target width={16} height={16} />
          </button>
          {scene && entry ? <SceneMenu scene={scene} moduleId={mod.id} sceneId={entry.id} onPower={() => setPower(true)} onShare={copyShareLink} /> : null}
          {scene?.tour?.length ? (
            <button
              onClick={() => (tourActive ? stopTour() : startTour())}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium ${tourActive ? 'bg-accent text-accent-ink' : 'border border-accent/50 text-accent hover:bg-accent/10'}`}
            >
              <Icon.tour width={15} height={15} />
              <span className="hidden sm:inline">{tourActive ? 'End tour' : 'Guided tour'}</span>
            </button>
          ) : null}
          {scene ? <TutorButton /> : null}
          <span className="mx-0.5 hidden h-5 w-px bg-line sm:block" aria-hidden />
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
          {scene ? <Stage key={scene.id} scene={scene} loadingLabel="Building the model" poster={mod && entry ? `scenes/${mod.id}--${entry.id}` : undefined} /> : null}
          {!scene && !error ? (
            entry?.load ? <Loader label="Building the model" className="absolute inset-0" /> : <div className="absolute inset-0 grid place-items-center text-[13px] text-mute">This scene is coming soon.</div>
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
              <div className="pointer-events-none absolute right-3 top-3 z-10 flex flex-col items-end gap-2">
                <OrientationGizmo scene={scene} />
                <ChallengeHud />
                {!rightOpen ? <LabHud onOpenPanel={() => setRightOpen(true)} /> : null}
              </div>
              <InsidePill />
              <BuildHud />
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
        <TutorPanel scene={scene ? { title: scene.title, summary: scene.summary } : undefined} route={mod && entry ? `/m/${mod.id}/${entry.id}` : ''} />

        {rightOpen && scene ? (
          <aside className={`${wide ? 'relative' : 'absolute inset-y-0 right-0 z-20 shadow-2xl'} flex w-[min(380px,100vw)] shrink-0 flex-col border-l border-line bg-panel`}>
            <div className="border-b border-line px-4 py-3">
              <div className="flex items-start gap-2">
                <h1 className="min-w-0 flex-1 text-[15px] font-semibold leading-snug text-ink">{scene.title}</h1>
                {/* the description folds away, so the live readings sit higher */}
                <button
                  type="button"
                  onClick={() => setDetailsOpen(!detailsOpen)}
                  aria-expanded={detailsOpen}
                  aria-label={detailsOpen ? 'Hide the description' : 'Show the description'}
                  title={detailsOpen ? 'Hide the description' : 'Show the description'}
                  className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink"
                >
                  <FoldChevron open={detailsOpen} />
                </button>
              </div>
              {detailsOpen ? (
                <>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-mute">{scene.summary}</p>
                  {mod && entry ? <SeenIn route={`${mod.id}/${entry.id}`} /> : null}
                  {academic && entry?.exam ? (
                    <div className="mt-2">
                      <Badge tone="warn">Frequently examined</Badge>
                    </div>
                  ) : null}
                </>
              ) : null}
              {sceneQuestions.length > 0 ? (
                <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-line bg-panel-2 p-1">
                  <button
                    onClick={() => setRightTab('controls')}
                    className={`rounded-lg py-1 text-[11.5px] font-semibold transition-colors ${
                      rightTab === 'controls' ? 'bg-panel-3 text-ink shadow-sm' : 'text-mute hover:text-ink'
                    }`}
                  >
                    Controls & Physics
                  </button>
                  <button
                    onClick={() => setRightTab('exam')}
                    className={`rounded-lg py-1 text-[11.5px] font-semibold transition-colors ${
                      rightTab === 'exam' ? 'bg-accent text-accent-ink shadow-sm' : 'text-accent hover:bg-accent/10'
                    }`}
                  >
                    Exam Practice ({sceneQuestions.length})
                  </button>
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {rightTab === 'exam' && sceneQuestions.length > 0 && entry ? (
                <InSceneExam key={scene.id} moduleId={mod.id} sceneId={entry.id} scene={scene} />
              ) : (
                <>
                  <ComparePanel key={scene.id} scene={scene} />
                  {scene.Panel ? <scene.Panel /> : null}
                </>
              )}
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
