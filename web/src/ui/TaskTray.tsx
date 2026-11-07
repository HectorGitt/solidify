import { useEffect, useRef, useState } from 'react'
import { clearFinished, dismissTask, goTo, useTasks } from './tasks'

/** the background tasks: a pill in the corner while anything runs or has just finished, opening a list */
export function TaskTray() {
  const tasks = useTasks((s) => s.tasks)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  if (!tasks.length) return null
  const running = tasks.filter((t) => t.state === 'running')
  const label = running.length ? `${running.length} running` : `${tasks.length} finished`

  return (
    <div ref={ref} className="fixed bottom-5 left-5 z-[150]">
      {open ? (
        <div className="mb-2 w-80 overflow-hidden rounded-2xl border border-line-2 bg-panel shadow-2xl">
          <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
            <span className="text-[13px] font-semibold text-ink">Background tasks</span>
            {tasks.some((t) => t.state !== 'running') ? (
              <button type="button" onClick={clearFinished} className="text-[11.5px] text-mute hover:text-ink">
                Clear finished
              </button>
            ) : null}
          </div>
          <ul className="max-h-80 divide-y divide-line overflow-y-auto">
            {tasks.map((t) => {
              const pct = t.total ? Math.round((100 * (t.done ?? 0)) / t.total) : null
              return (
                <li key={t.id} className="px-4 py-3">
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${t.state === 'running' ? 'animate-pulse bg-accent' : t.state === 'done' ? 'bg-accent' : 'bg-warn'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{t.title}</div>
                      <div className={`truncate text-[11.5px] ${t.state === 'failed' ? 'text-warn' : 'text-mute'}`}>
                        {t.state === 'done' ? 'Done' : (t.detail ?? (t.state === 'running' ? 'Working…' : 'Stopped'))}
                      </div>
                      {t.state === 'running' && pct !== null ? (
                        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line-2">
                          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {t.href ? (
                        <button
                          type="button"
                          onClick={() => {
                            goTo(t.href!)
                            setOpen(false)
                          }}
                          className="rounded-full px-2 py-0.5 text-[11.5px] font-medium text-accent hover:bg-panel-2"
                        >
                          Open
                        </button>
                      ) : null}
                      {t.state !== 'running' ? (
                        <button type="button" aria-label="Dismiss" onClick={() => dismissTask(t.id)} className="rounded-full px-1.5 py-0.5 text-[11.5px] text-dim hover:text-ink">
                          ✕
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-line-2 bg-panel px-3.5 py-2 text-[12.5px] font-medium text-ink shadow-xl hover:border-accent/50"
      >
        <span className={`h-2 w-2 rounded-full ${running.length ? 'animate-pulse bg-accent' : 'bg-accent/60'}`} />
        {label}
      </button>
    </div>
  )
}
