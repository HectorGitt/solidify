import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { useProgress } from '@/study/progress'
import { fmt } from '@/ui/controls'
import { Icon } from '@/ui/icons'
import { challengesFor } from './registry'
import { isBetter, useChallenge } from './store'
import type { ChallengeEntry } from './types'

const Stars = ({ n }: { n: number }) => (
  <span className="text-warn" aria-label={`difficulty ${n} of 3`}>
    {'●'.repeat(n)}
    <span className="text-line-2">{'●'.repeat(3 - n)}</span>
  </span>
)

/** Ticks the active challenge ~10 times a second (real time, paused when the sim is paused). */
function useChallengeClock() {
  const active = useChallenge((s) => s.active)
  useEffect(() => {
    if (!active) return
    let last = performance.now()
    const id = window.setInterval(() => {
      const now = performance.now()
      const dt = (now - last) / 1000
      last = now
      useChallenge.getState().tick(useSim.getState().playing ? dt : 0)
    }, 100)
    return () => window.clearInterval(id)
  }, [active])
}

/** Header button: lists the scene's challenges and starts one. */
export function ChallengeMenu({ moduleId, sceneId, scene }: { moduleId: string; sceneId: string; scene: SceneDef }) {
  const [list, setList] = useState<ChallengeEntry[]>([])
  const [open, setOpen] = useState(false)
  const done = useProgress((s) => s.challenges)
  const active = useChallenge((s) => s.active)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let alive = true
    challengesFor(moduleId, sceneId).then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [moduleId, sceneId])
  useEffect(() => {
    if (!open) return
    const off = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', off)
    return () => window.removeEventListener('mousedown', off)
  }, [open])
  if (!list.length) return null
  const n = list.filter((c) => done[c.id]).length
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] font-medium ${active ? 'bg-warn/20 text-warn' : 'border border-warn/40 text-warn hover:bg-warn/10'}`}
        aria-expanded={open}
      >
        <Icon.trophy width={15} height={15} />
        <span className="hidden sm:inline">Challenges</span>
        <span className="font-mono text-[11px] opacity-80">
          {n}/{list.length}
        </span>
      </button>
      {open ? (
        <div className="absolute right-0 top-9 z-40 w-[min(340px,90vw)] rounded-lg border border-line-2 bg-panel p-2 shadow-2xl">
          {list.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                useChallenge.getState().start(c, scene.applyParams)
                useSim.setState({ playing: true })
                setOpen(false)
              }}
              className="block w-full rounded-md px-2.5 py-2 text-left hover:bg-panel-2"
            >
              <div className="flex items-center gap-2 text-[12.5px] font-medium text-ink">
                {done[c.id] ? <Icon.check width={14} height={14} className="text-accent" /> : null}
                <span className="truncate">{c.title}</span>
                <span className="ml-auto text-[10px]">
                  <Stars n={c.difficulty} />
                </span>
              </div>
              <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{c.brief}</p>
            </button>
          ))}
          <Link to="/challenges" className="mt-1 block rounded-md px-2.5 py-1.5 text-[11.5px] text-accent hover:bg-panel-2">
            All challenges →
          </Link>
        </div>
      ) : null}
    </div>
  )
}

/** The goal card shown over the viewport while a challenge runs. */
export function ChallengeHud() {
  useChallengeClock()
  const s = useChallenge()
  const best = useProgress((p) => (s.active ? p.challenges[s.active.id]?.best : undefined))
  const c = s.active
  if (!c) return null
  const need = c.hold ?? 2
  const won = s.status === 'won'
  const sc = c.score
  const newBest = won && sc && s.score !== null && isBetter(s.score, s.prevBest, sc.better)
  return (
    <div className="pointer-events-auto w-[min(320px,calc(100vw-24px))] rounded-lg border border-warn/40 bg-panel/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-start gap-2">
        <Icon.trophy width={16} height={16} className="mt-0.5 shrink-0 text-warn" />
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold leading-snug text-ink">{c.title}</div>
          <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{c.brief}</p>
        </div>
        <button onClick={() => s.stop()} aria-label="Leave the challenge" className="grid h-6 w-6 shrink-0 place-items-center rounded text-mute hover:bg-panel-3 hover:text-ink">
          <Icon.close width={14} height={14} />
        </button>
      </div>

      <ul className="mt-2 space-y-1">
        {c.criteria.map((k, i) => {
          const r = s.results[i]
          const pass = r?.pass ?? false
          return (
            <li key={k.label} className="flex items-center gap-2 text-[12px]">
              <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${pass ? 'bg-accent text-accent-ink' : 'border border-line-2'}`}>{pass ? <Icon.check width={11} height={11} /> : null}</span>
              <span className={pass ? 'text-ink' : 'text-ink/75'}>{k.label}</span>
              <span className={`ml-auto font-mono text-[11.5px] ${pass ? 'text-accent' : 'text-mute'}`}>{r?.value ?? '…'}</span>
            </li>
          )
        })}
      </ul>

      {!won && need > 0 ? (
        <div className="mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-panel-3">
            <div className="h-full bg-warn transition-[width] duration-100" style={{ width: `${Math.min(100, (s.held / need) * 100)}%` }} />
          </div>
          <div className="mt-0.5 text-[10.5px] text-dim">Hold every goal for {need} s{useSim.getState().playing ? '' : ' — press play'}</div>
        </div>
      ) : null}

      {won ? (
        <div className="mt-2 rounded-md bg-accent/10 p-2">
          <div className="text-[12.5px] font-semibold text-accent">Challenge complete!</div>
          {sc && s.score !== null ? (
            <div className="mt-0.5 text-[12px] text-ink">
              {sc.label}: <b className="font-mono">{fmt(s.score, sc.digits ?? 3)}</b> {sc.unit}
              {newBest ? <span className="ml-1.5 rounded bg-warn/20 px-1 text-[10.5px] text-warn">best</span> : best !== undefined ? <span className="ml-1.5 text-[11px] text-mute">best {fmt(best, sc.digits ?? 3)}</span> : null}
            </div>
          ) : null}
          <p className="mt-1 text-[11.5px] leading-snug text-ink/85">{c.explain}</p>
          <div className="mt-2 flex gap-1.5">
            <button onClick={() => useChallenge.getState().start(c)} className="rounded-md border border-line-2 px-2 py-1 text-[11.5px] text-ink/85 hover:border-accent/50">
              {sc ? 'Beat it' : 'Again'}
            </button>
            <Link to="/challenges" className="rounded-md border border-line-2 px-2 py-1 text-[11.5px] text-ink/85 hover:border-accent/50">
              More challenges
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-2 text-[11px] leading-snug">
          {s.hintShown ? (
            <p className="text-mute">
              <b className="text-ink/85">Hint:</b> {c.hint}
            </p>
          ) : (
            <button onClick={() => s.showHint()} className="text-accent hover:underline">
              Show a hint
            </button>
          )}
        </div>
      )}
    </div>
  )
}
