import { useEffect, useState } from 'react'
import { Icon } from './icons'

/**
 * What the student sees while Solidify's AI builds a model or reads a page: a blueprint that keeps
 * drafting itself, the stages of the work, a progress bar and tips. The model answers in one go (no
 * streaming), so stages and progress follow the usual timing: progress eases towards 95 % and the parent
 * removes the screen the moment the answer arrives. Motion stops under prefers-reduced-motion.
 */
export function BuildScreen({
  title,
  steps,
  expectedSeconds = 28,
  prompt,
  photoUrl,
  tips = [],
  variant = 'full',
}: {
  title: string
  steps: string[]
  expectedSeconds?: number
  prompt?: string
  photoUrl?: string
  tips?: string[]
  /** full: takes the model's place; overlay: sits over the current model while it changes */
  variant?: 'full' | 'overlay'
}) {
  const [elapsed, setElapsed] = useState(0)
  const [tip, setTip] = useState(0)

  useEffect(() => {
    const start = performance.now()
    const t = window.setInterval(() => setElapsed((performance.now() - start) / 1000), 200)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (tips.length < 2) return
    const t = window.setInterval(() => setTip((i) => (i + 1) % tips.length), 6000)
    return () => window.clearInterval(t)
  }, [tips.length])

  // eases towards 95 %: about two thirds of the way at the usual time, never "done" before the answer is
  const progress = Math.min(0.95, 1 - Math.exp(-elapsed / (expectedSeconds * 0.9)))
  // stages share the usual time; the last one waits for the answer
  const active = Math.min(steps.length - 1, Math.floor((elapsed / expectedSeconds) * steps.length))
  const overlay = variant === 'overlay'

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`${title}: ${steps[active]}`}
      className={`isolate overflow-hidden ${overlay ? 'absolute inset-0 z-30 overflow-y-auto bg-[color-mix(in_srgb,var(--color-stage)_80%,transparent)] backdrop-blur-[3px]' : 'relative rounded-3xl border border-line bg-[var(--color-stage)]'}`}
    >
      <div className="bp-grid pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div className="bp-scan pointer-events-none absolute inset-x-0 -z-10 h-24" aria-hidden />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_35%,var(--color-stage)_100%)]" aria-hidden />

      <div className={`mx-auto grid h-full max-w-5xl items-center gap-8 px-6 ${overlay ? 'py-6 md:grid-cols-[1fr_1.1fr]' : 'min-h-[520px] py-10 md:grid-cols-[1.1fr_1fr]'}`}>
        {/* the blueprint drafting itself */}
        <div className={`relative mx-auto w-full ${overlay ? 'hidden max-w-[300px] md:block' : 'max-w-[440px]'}`}>
          <Blueprint />
          {photoUrl ? (
            <div className="absolute -bottom-2 -left-2 rotate-[-4deg] rounded-xl border border-line bg-panel p-1.5 shadow-xl">
              <img src={photoUrl} alt="Your photo" className="h-20 w-20 rounded-lg object-cover" />
              <div className="bp-scan-thin pointer-events-none absolute inset-1.5 overflow-hidden rounded-lg" aria-hidden />
            </div>
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-accent">Solidify AI</p>
          <h2 className={`mt-1.5 font-semibold tracking-[-0.02em] text-ink ${overlay ? 'text-[20px]' : 'text-[26px] sm:text-[30px]'}`}>{title}</h2>
          {prompt ? <p className="mt-2 line-clamp-2 text-[14px] leading-snug text-mute">“{prompt}”</p> : null}

          <ol className={`space-y-2.5 ${overlay ? 'mt-4' : 'mt-6'}`}>
            {steps.map((s, i) => {
              const state = i < active ? 'done' : i === active ? 'active' : 'todo'
              return (
                <li key={s} className={`flex items-center gap-3 text-[14px] transition-colors duration-500 ${state === 'todo' ? 'text-dim' : 'text-ink'}`}>
                  <span className="relative flex h-5 w-5 shrink-0 items-center justify-center">
                    {state === 'done' ? (
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-accent-ink">
                        <Icon.check width={13} height={13} strokeWidth={2.6} />
                      </span>
                    ) : state === 'active' ? (
                      <>
                        <span className="bp-ping absolute inset-0 rounded-full bg-accent/40" />
                        <span className="h-2.5 w-2.5 rounded-full bg-accent" />
                      </>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-line-2" />
                    )}
                  </span>
                  <span className={state === 'active' ? 'font-medium' : ''}>
                    {s}
                    {state === 'active' && i === steps.length - 1 && elapsed > expectedSeconds ? <span className="text-mute"> · almost there</span> : null}
                  </span>
                </li>
              )
            })}
          </ol>

          <div className={overlay ? 'mt-4' : 'mt-7'}>
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
              <div className="bp-bar h-full rounded-full bg-accent transition-[width] duration-500 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <div className="mt-2 flex justify-between font-mono text-[11.5px] text-dim">
              <span>{Math.round(progress * 100)} %</span>
              <span>{Math.floor(elapsed)} s</span>
            </div>
          </div>

          {tips.length && !overlay ? (
            <p key={tip} className="bp-fade mt-6 flex items-start gap-2 rounded-2xl border border-line bg-panel/70 px-3.5 py-2.5 text-[13px] leading-snug text-mute backdrop-blur">
              <span className="mt-0.5 shrink-0 text-accent">
                <Icon.tour width={14} height={14} />
              </span>
              {tips[tip]}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** an isometric assembly drawn line by line: housing, gear, shaft and dimensions, on a loop */
function Blueprint() {
  // isometric helpers: x to the right-down, z to the left-down, y up
  const c = 0.866
  const P = (x: number, y: number, z: number): [number, number] => [200 + (x - z) * c * 1, 200 + (x + z) * 0.5 - y]
  const pt = (p: [number, number]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`
  const line = (...ps: [number, number][]) => `M${ps.map(pt).join(' L')}`
  /** an ellipse in the x–z plane (a circle seen in isometric) at height y */
  const ring = (cx: number, y: number, cz: number, r: number, n = 48) => line(...Array.from({ length: n + 1 }, (_, i) => P(cx + r * Math.cos((i / n) * 2 * Math.PI), y, cz + r * Math.sin((i / n) * 2 * Math.PI))))
  const gearTeeth = (y: number, r: number, teeth = 18) =>
    line(
      ...Array.from({ length: teeth * 4 + 1 }, (_, i) => {
        const a = (i / (teeth * 4)) * 2 * Math.PI
        const rr = i % 4 < 2 ? r : r * 0.86
        return P(rr * Math.cos(a), y, rr * Math.sin(a))
      }),
    )
  const box = (x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) =>
    [
      line(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), P(x0, y0, z0)),
      line(P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1), P(x0, y1, z0)),
      line(P(x0, y0, z0), P(x0, y1, z0)),
      line(P(x1, y0, z0), P(x1, y1, z0)),
      line(P(x1, y0, z1), P(x1, y1, z1)),
      line(P(x0, y0, z1), P(x0, y1, z1)),
    ].join(' ')

  const housing = box(-110, 110, -70, -40, -110, 110)
  const groups: { d: string; cls: string; delay: number; dashed?: boolean }[] = [
    { d: housing, cls: 'text-mute', delay: 0, dashed: true },
    { d: ring(0, -40, 0, 70), cls: 'text-ink', delay: 0.35 },
    { d: ring(0, 0, 0, 70), cls: 'text-ink', delay: 0.55 },
    { d: gearTeeth(0, 82), cls: 'text-accent', delay: 0.8 },
    { d: gearTeeth(-40, 82), cls: 'text-accent', delay: 1.0 },
    { d: [line(P(82, -40, 0), P(82, 0, 0)), line(P(-82, -40, 0), P(-82, 0, 0)), line(P(0, -40, 82), P(0, 0, 82))].join(' '), cls: 'text-accent', delay: 1.15 },
    { d: [ring(0, 80, 0, 16, 32), ring(0, -110, 0, 16, 32), line(P(16, 80, 0), P(16, -110, 0)), line(P(-16, 80, 0), P(-16, -110, 0))].join(' '), cls: 'text-ink', delay: 1.3 },
    // dimension: the gear's outside diameter
    { d: [line(P(-82, 40, -82), P(82, 40, 82)), line(P(-82, 34, -82), P(-82, 46, -82)), line(P(82, 34, 82), P(82, 46, 82))].join(' '), cls: 'text-mute', delay: 1.6 },
    // dimension: the shaft length
    { d: [line(P(130, 80, -30), P(130, -110, -30)), line(P(124, 80, -30), P(136, 80, -30)), line(P(124, -110, -30), P(136, -110, -30))].join(' '), cls: 'text-mute', delay: 1.75 },
  ]
  const [lx, ly] = P(-6, 52, 6)
  const [sx, sy] = P(140, -15, -30)

  return (
    <svg viewBox="0 0 400 400" className="h-auto w-full overflow-visible" aria-hidden>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {groups.map((g, i) => (
          <path
            key={i}
            d={g.d}
            pathLength={1}
            className={`${g.dashed ? 'bp-fadein' : 'bp-draw'} ${g.cls}`}
            stroke="currentColor"
            strokeWidth={g.cls === 'text-accent' ? 1.6 : 1.3}
            strokeDasharray={g.dashed ? '0.012 0.01' : undefined}
            style={{ ['--d' as string]: `${g.delay}s` }}
            opacity={g.dashed ? 0.55 : 1}
          />
        ))}
      </g>
      <g className="bp-label font-mono text-mute" fill="currentColor" fontSize="11">
        <text x={lx} y={ly - 6} textAnchor="middle">
          Ø 164
        </text>
        <text x={sx + 8} y={sy} textAnchor="start">
          190
        </text>
      </g>
      <g className="bp-spin-slow text-accent" opacity="0.5">
        <circle cx="200" cy="200" r="176" fill="none" stroke="currentColor" strokeWidth="0.8" strokeDasharray="2 10" />
      </g>
    </svg>
  )
}
