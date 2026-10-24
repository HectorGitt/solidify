import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { challengesFor } from '@/challenges/registry'
import { useChallenge } from '@/challenges/store'
import type { ChallengeEntry } from '@/challenges/types'
import { useReport } from '@/cloud/ui/ReportDialog'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { useParts } from '@/parts/registry'
import { useProgress } from '@/study/progress'
import { STUDY_LINKS } from '@/study/ui/StudyShell'
import { useAcademic } from './audience'
import { Icon } from './icons'
import { enterInside, useInside } from './inside'

function Item({ icon, label, hint, onClick, tone = 'ink', right }: { icon?: ReactNode; label: ReactNode; hint?: string; onClick: () => void; tone?: 'ink' | 'accent' | 'warn'; right?: ReactNode }) {
  const toneCls = { ink: 'text-ink/90', accent: 'text-accent', warn: 'text-warn' }[tone]
  return (
    <button role="menuitem" onClick={onClick} className="flex w-full items-start gap-2.5 rounded-md px-2.5 py-1.5 text-left hover:bg-panel-3">
      <span className={`mt-0.5 shrink-0 ${toneCls}`}>{icon}</span>
      <span className="min-w-0 flex-1">
        <span className={`block text-[12.5px] font-medium ${toneCls}`}>{label}</span>
        {hint ? <span className="block text-[11px] leading-snug text-dim">{hint}</span> : null}
      </span>
      {right}
    </button>
  )
}

function Heading({ children }: { children: ReactNode }) {
  return <div className="px-2.5 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-dim">{children}</div>
}

/**
 * The scene header's "Explore" menu: the less frequent scene actions grouped in one place
 * (whole-machine view, power path, challenges, study links, share, report).
 */
export function SceneMenu({ scene, moduleId, sceneId, onPower, onShare }: { scene: SceneDef; moduleId: string; sceneId: string; onPower: () => void; onShare: () => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const academic = useAcademic()
  const wholePart = useParts((s) => Object.values(s.parts).find((p) => p.info?.insideMode === 'whole'))
  const insideOpen = useInside((s) => s.id !== null)
  const hasPower = useParts((s) => 'tractor-engine' in s.parts || 'tractor-gearbox' in s.parts)
  const done = useProgress((s) => s.challenges)
  const active = useChallenge((s) => s.active)
  const [challenges, setChallenges] = useState<ChallengeEntry[]>([])

  useEffect(() => {
    let alive = true
    challengesFor(moduleId, sceneId).then((l) => alive && setChallenges(l))
    return () => {
      alive = false
    }
  }, [moduleId, sceneId])

  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', off)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', off)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const run = (f: () => void) => () => {
    setOpen(false)
    f()
  }
  const solved = challenges.filter((c) => done[c.id]).length
  const study = STUDY_LINKS.filter((l) => l.to !== '/challenges')

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium transition-colors ${open ? 'bg-panel-3 text-ink' : active ? 'bg-warn/15 text-warn' : 'text-ink/85 hover:bg-panel-3'}`}
        title="More ways to explore this scene"
      >
        {active ? <Icon.trophy width={14} height={14} /> : <Icon.explode width={14} height={14} />}
        <span className="hidden sm:inline">Explore</span>
        {challenges.length ? (
          <span className="hidden font-mono text-[10.5px] text-dim md:inline">
            {solved}/{challenges.length}
          </span>
        ) : null}
        <Icon.chevron width={12} height={12} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-[60] max-h-[80vh] w-[min(330px,92vw)] overflow-y-auto rounded-xl border border-line-2 bg-panel p-1.5 shadow-2xl">
          {(wholePart && !insideOpen) || hasPower ? <Heading>See it work</Heading> : null}
          {wholePart && !insideOpen ? (
            <div
              onPointerEnter={() => {
                // start building the heavy parts while the pointer is on its way
                void import('@/machines/engine.geometry').then((m) => m.prepareEngine())
                void import('@/tractor/systems.geometry').then((m) => m.prepareSystems())
              }}
            >
              <Item icon={<Icon.xray width={14} height={14} />} tone="accent" label="Whole tractor" hint="Every system of the tractor at once, working" onClick={run(() => enterInside(wholePart))} />
            </div>
          ) : null}
          {hasPower ? <Item icon={<Icon.bolt width={14} height={14} />} tone="warn" label="Follow the power" hint="Walk the power from the engine to the wheels" onClick={run(onPower)} /> : null}

          {challenges.length ? (
            <>
              <Heading>
                Challenges · {solved}/{challenges.length} done
              </Heading>
              {challenges.map((c) => (
                <Item
                  key={c.id}
                  icon={done[c.id] ? <Icon.check width={14} height={14} /> : <Icon.trophy width={14} height={14} />}
                  tone={done[c.id] ? 'accent' : 'warn'}
                  label={c.title}
                  hint={c.brief}
                  right={<span className="mt-0.5 shrink-0 text-[10px] text-dim">{'★'.repeat(c.difficulty)}</span>}
                  onClick={run(() => {
                    useChallenge.getState().start(c, scene.applyParams)
                    useSim.setState({ playing: true })
                  })}
                />
              ))}
              <Link to="/challenges" onClick={() => setOpen(false)} className="block rounded-md px-2.5 py-1 text-[11.5px] text-accent hover:bg-panel-3">
                All challenges →
              </Link>
            </>
          ) : null}

          {academic ? (
            <>
              <Heading>Study</Heading>
              {study.map((l) => (
                <Link key={l.to} to={l.to} onClick={() => setOpen(false)} className="block rounded-md px-2.5 py-1.5 text-[12.5px] font-medium text-ink/90 hover:bg-panel-3">
                  {l.label}
                </Link>
              ))}
            </>
          ) : null}

          <div className="my-1.5 h-px bg-line" />
          <Item icon={<Icon.camera width={14} height={14} />} label="Copy link to this view" hint="The same camera, section and explode, for anyone" onClick={run(onShare)} />
          <Item icon={<Icon.wrench width={14} height={14} />} label="Report a problem" hint="A wrong value, something broken, or an idea" onClick={run(() => useReport.getState().open({}))} />
        </div>
      ) : null}
    </div>
  )
}
