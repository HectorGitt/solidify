import { useEffect, useRef, type ReactNode } from 'react'
import { create } from 'zustand'
import { useSim, useSimFrame } from '@/core/sim'
import { Section } from '@/ui/controls'
import { Table } from '@/modules/elements/_shared/PanelBits'

/**
 * A live laboratory test. A rig opens interactive, following its controls with the full conditions applied.
 * Start the test and it runs the way a bench test does: the load goes on a step at a time, the machine
 * settles, the instruments are read and logged, and the results build up as you watch. A rig owns the
 * physics; this owns the procedure.
 */
export type RunStatus = 'idle' | 'running' | 'paused' | 'done' | 'failed'

export interface RunState {
  status: RunStatus
  /** the step the test has reached, 0 = not yet loaded */
  step: number
  /** how far through this step's change of load, 0 to 1 */
  progress: number
  rows: number[][]
  message: string
  start: () => void
  pause: () => void
  resume: () => void
  /** back to the unloaded rig, with nothing logged */
  reset: () => void
  fail: (message: string) => void
  log: (row: number[]) => void
  advance: (step: number, progress: number) => void
  finish: (message?: string) => void
}

export function createRun() {
  return create<RunState>((set) => ({
    status: 'idle',
    step: 0,
    progress: 0,
    rows: [],
    message: '',
    start: () => {
      useSim.setState({ playing: true })
      set({ status: 'running', step: 0, progress: 0, rows: [], message: '' })
    },
    pause: () => set((s) => (s.status === 'running' ? { status: 'paused' } : s)),
    resume: () => {
      useSim.setState({ playing: true })
      set((s) => (s.status === 'paused' ? { status: 'running' } : s))
    },
    reset: () => set({ status: 'idle', step: 0, progress: 0, rows: [], message: '' }),
    fail: (message) => set({ status: 'failed', message }),
    log: (row) => set((s) => ({ rows: [...s.rows, row] })),
    advance: (step, progress) => set({ step, progress }),
    finish: (message = '') => set({ status: 'done', message }),
  }))
}

export type RunStore = ReturnType<typeof createRun>

const useActiveRun = create<{ run: RunStore | null; steps: number }>(() => ({ run: null, steps: 0 }))

/** smooth a move from rest to rest */
export const settle = (u: number) => u * u * (3 - 2 * u)

/**
 * An instrument's reading: the true value with a small, repeatable scatter, as a real gauge has.
 * Deterministic, so the same test logs the same table.
 */
export function instrument(value: number, scatter: number, seed: number) {
  const x = Math.sin(seed * 12.9898 + 4.1414) * 43758.5453
  return value * (1 + scatter * 2 * (x - Math.floor(x) - 0.5))
}

/** Least-squares slope of y on x, through the origin. */
export function slopeThroughOrigin(xs: number[], ys: number[]) {
  const sxx = xs.reduce((s, x) => s + x * x, 0)
  return sxx > 0 ? xs.reduce((s, x, i) => s + x * ys[i], 0) / sxx : 0
}

export interface Procedure {
  /** how many steps of load */
  steps: number
  /** seconds to apply each step */
  moveSeconds: number
  /** seconds to settle before it is read */
  dwellSeconds: number
}

/**
 * Drives a run from the sim clock, so pausing the app's time pauses the test. `apply` receives the
 * fraction of full load, every frame; `read` is called once a step has settled, and may fail the test.
 */
export function useRunDriver(run: RunStore, proc: Procedure, apply: (f: number) => void, read: (step: number, f: number) => void) {
  const clock = useRef(0)
  const applyRef = useRef(apply)
  const readRef = useRef(read)
  applyRef.current = apply
  readRef.current = read
  useEffect(() => {
    useActiveRun.setState({ run, steps: proc.steps })
    return () => {
      if (useActiveRun.getState().run === run) useActiveRun.setState({ run: null, steps: 0 })
    }
  }, [run, proc.steps])
  useSimFrame((dt) => {
    const r = run.getState()
    if (r.status === 'idle') clock.current = 0
    if (r.status !== 'running') return
    clock.current += dt
    const span = proc.moveSeconds + proc.dwellSeconds
    const done = Math.floor(clock.current / span)
    if (done > r.step) {
      const step = Math.min(done, proc.steps)
      applyRef.current(step / proc.steps)
      readRef.current(step, step / proc.steps)
      // a read may have failed the test
      if (run.getState().status !== 'running') return
      if (step >= proc.steps) {
        run.getState().advance(step, 1)
        run.getState().finish()
        return
      }
      run.getState().advance(step, 0)
      return
    }
    const local = clock.current - r.step * span
    const u = settle(Math.min(1, local / proc.moveSeconds))
    applyRef.current((r.step + u) / proc.steps)
    run.getState().advance(r.step, u)
  })
}

/** Readings only hold for the conditions they were taken under: changing those ends the test and goes back to interactive. */
export function useResetOnChange(run: RunStore, conditions: string) {
  useEffect(() => {
    run.getState().reset()
  }, [run, conditions])
}

const LABEL: Record<RunStatus, string> = { idle: 'Interactive', running: 'Test running', paused: 'Paused', done: 'Test complete', failed: 'Specimen failed' }

/** The test's controls and its log, for the top of a rig's panel. */
export function TestBench({ run, steps, title = 'The test', head, format, children }: { run: RunStore; steps: number; title?: string; head: string[]; format: (row: number[]) => string[]; children?: ReactNode }) {
  const status = run((s) => s.status)
  const step = run((s) => s.step)
  const progress = run((s) => s.progress)
  const rows = run((s) => s.rows)
  const message = run((s) => s.message)
  const s = run.getState()
  const share = status === 'done' ? 1 : Math.min(1, (step + progress) / steps)
  const running = status === 'running'
  return (
    <Section title={title}>
      <div data-tour="rig-test" className="flex items-center gap-2">
        <span className={`h-2 w-2 shrink-0 rounded-full ${running ? 'animate-pulse bg-accent' : status === 'failed' ? 'bg-danger' : status === 'done' ? 'bg-accent' : 'bg-dim'}`} />
        <span className="text-[12.5px] font-medium text-ink">{LABEL[status]}</span>
        {status === 'idle' ? null : (
          <span className="ml-auto font-mono text-[11.5px] text-mute">
            step {Math.min(step + (running ? 1 : 0), steps)} of {steps}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-panel-3" role="progressbar" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Test progress">
        <div className={`h-full ${status === 'failed' ? 'bg-danger' : 'bg-accent'}`} style={{ width: `${share * 100}%` }} />
      </div>
      {message ? <p className={`mt-1.5 text-[11.5px] leading-snug ${status === 'failed' ? 'text-danger' : 'text-mute'}`}>{message}</p> : null}
      <div className="mt-2 flex gap-1.5">
        <button onClick={() => s.start()} className="flex-1 rounded-md bg-accent px-2 py-1 text-[12.5px] font-medium text-accent-ink">
          {status === 'idle' ? 'Start test' : 'Run again'}
        </button>
        {running || status === 'paused' ? (
          <button onClick={() => (running ? s.pause() : s.resume())} className="rounded-md border border-line-2 px-3 py-1 text-[12.5px] text-ink">
            {running ? 'Pause' : 'Resume'}
          </button>
        ) : null}
        {status === 'idle' ? null : (
          <button onClick={() => s.reset()} className="rounded-md border border-line-2 px-3 py-1 text-[12.5px] text-ink">
            Back to interactive
          </button>
        )}
      </div>
      {children}
      <div className="mt-2 max-h-52 overflow-y-auto">
        {rows.length ? <Table head={head} rows={rows.map(format)} highlight={rows.length - 1} /> : <p className="text-[11.5px] text-dim">Move the controls and the rig follows. Start the test to load it step by step and log the readings.</p>}
      </div>
    </Section>
  )
}

/** Compact floating pill on the 3D viewport when the right-hand controls/readings drawer is closed. */
export function LabHud({ onOpenPanel }: { onOpenPanel: () => void }) {
  const activeRun = useActiveRun((s) => s.run)
  const steps = useActiveRun((s) => s.steps)
  if (!activeRun) return null
  return <LabHudInner run={activeRun} steps={steps} onOpenPanel={onOpenPanel} />
}

function LabHudInner({ run, steps, onOpenPanel }: { run: RunStore; steps: number; onOpenPanel: () => void }) {
  const status = run((s) => s.status)
  const step = run((s) => s.step)
  const rows = run((s) => s.rows)
  const running = status === 'running'
  return (
    <div data-tour="rig-test" className="pointer-events-auto flex items-center gap-2 rounded-full border border-line bg-panel/95 px-3 py-1.5 text-[12px] text-ink shadow-lg backdrop-blur">
      <span className={`h-2 w-2 shrink-0 rounded-full ${running ? 'animate-pulse bg-accent' : status === 'failed' ? 'bg-danger' : status === 'done' ? 'bg-accent' : 'bg-dim'}`} />
      <span className="font-medium">{LABEL[status]}</span>
      <span className="font-mono text-[11px] text-mute">
        {Math.min(step + (running ? 1 : 0), steps)}/{steps}
      </span>
      {status === 'done' || status === 'failed' || status === 'idle' ? (
        <button onClick={() => run.getState().start()} className="rounded-full bg-accent px-2.5 py-0.5 text-[11.5px] font-medium text-accent-ink hover:brightness-105">
          {status === 'idle' ? 'Start' : 'Run again'}
        </button>
      ) : null}
      <button onClick={onOpenPanel} className="rounded-full border border-line-2 px-2.5 py-0.5 text-[11.5px] text-mute hover:border-accent/50 hover:text-ink">
        Readings ({rows.length}) →
      </button>
    </div>
  )
}
