import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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

  useEffect(() => {
    setLeftOpen(wide)
    setRightOpen(wide)
  }, [wide])

  useEffect(() => {
    let alive = true
    setScene(null)
    setError(null)
    stopTour()
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
        useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 50, time: 0 })
        def.reset?.()
        setScene(def)
        document.title = `${def.title} · Solidify`
      })
      .catch((e: unknown) => alive && setError(String(e)))
    return () => {
      alive = false
    }
  }, [entry, stopTour])

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
          <div className="hidden md:block">
            <AudienceSwitch compact />
          </div>
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
                        className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] ${s.id === entry?.id ? 'bg-accent/15 text-ink' : 'text-ink/80 hover:bg-panel-3'}`}
                      >
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
              {academic && entry?.exam ? (
                <div className="mt-2">
                  <Badge tone="warn">Frequently examined</Badge>
                </div>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{scene.Panel ? <scene.Panel /> : null}</div>
          </aside>
        ) : null}
      </div>
    </div>
  )
}
