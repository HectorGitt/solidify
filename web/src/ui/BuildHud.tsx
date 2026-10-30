import { useEffect, useState } from 'react'
import { useBuild } from '@/render/build'
import { buildHint } from '@/render/BuildController'
import { Icon } from './icons'

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Build mode's overlay: progress, timer, hint, the last message, and the finish card. */
export function BuildHud() {
  const def = useBuild((s) => s.def)
  const placed = useBuild((s) => s.placed)
  const message = useBuild((s) => s.message)
  const startedAt = useBuild((s) => s.startedAt)
  const finishedAt = useBuild((s) => s.finishedAt)
  const wrong = useBuild((s) => s.wrong)
  const hints = useBuild((s) => s.hints)
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!def || finishedAt) return
    const t = setInterval(() => setNow(performance.now()), 250)
    return () => clearInterval(t)
  }, [def, finishedAt])
  if (!def) return null

  const total = def.steps.length
  const noun = def.noun ?? 'machine'
  const elapsed = (finishedAt ?? now) - startedAt
  const fresh = message && (message.kind === 'done' || now - message.at < 4200)
  const tone = message?.kind === 'no' ? 'border-warn/50' : message?.kind === 'hint' ? 'border-accent/40' : 'border-accent/50'

  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex flex-col items-center gap-2 px-3">
      <div className="pointer-events-auto flex w-full max-w-[520px] items-center gap-3 rounded-2xl border border-line-2 bg-panel-2/90 px-3.5 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] font-semibold text-ink">Build the {noun}</span>
            <span className="shrink-0 font-mono text-[12px] text-mute">
              {placed.length}/{total} · {clock(elapsed)}
            </span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-2">
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(100 * placed.length) / total}%` }} />
          </div>
        </div>
        {!finishedAt ? (
          <button onClick={() => buildHint(def)} className="rounded-lg border border-line-2 px-2.5 py-1 text-[12px] font-medium text-mute transition-colors hover:border-accent/50 hover:text-ink">
            Hint
          </button>
        ) : null}
        <button onClick={() => useBuild.getState().stop()} className="rounded-lg p-1 text-mute transition-colors hover:text-ink" aria-label="Leave build mode" title="Leave build mode">
          <Icon.close />
        </button>
      </div>

      {finishedAt ? (
        <div className="pointer-events-auto w-full max-w-[520px] rounded-2xl border border-accent/50 bg-panel-2/95 px-4 py-3.5 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <Icon.trophy className="text-accent" /> {noun.charAt(0).toUpperCase() + noun.slice(1)} assembled. It runs!
          </div>
          <p className="mt-1 text-[12.5px] text-mute">
            {total} parts in {clock(elapsed)} · {wrong === 0 ? 'no wrong tries' : `${wrong} wrong ${wrong === 1 ? 'try' : 'tries'}`} · {hints === 0 ? 'no hints' : `${hints} ${hints === 1 ? 'hint' : 'hints'}`}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => useBuild.getState().restart()} className="rounded-lg bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-accent-ink">
              Build it again
            </button>
            <button onClick={() => useBuild.getState().stop()} className="rounded-lg border border-line-2 px-3 py-1.5 text-[12.5px] font-medium text-ink">
              Done
            </button>
          </div>
        </div>
      ) : fresh && message ? (
        <div key={message.at} className={`w-full max-w-[520px] rounded-2xl border ${tone} bg-panel-2/95 px-3.5 py-2.5 shadow-xl backdrop-blur-xl`}>
          <div className={`text-[12.5px] font-semibold ${message.kind === 'no' ? 'text-warn' : 'text-ink'}`}>{message.text}</div>
          {message.detail ? <p className="mt-0.5 text-[12px] leading-relaxed text-mute">{message.detail}</p> : null}
        </div>
      ) : placed.length === 0 ? (
        <div className="rounded-full border border-line-2 bg-panel-2/90 px-3 py-1 text-[12px] text-mute shadow-lg backdrop-blur-xl">
          Drag a part from the tray to where it goes, or tap it.
        </div>
      ) : null}
    </div>
  )
}
