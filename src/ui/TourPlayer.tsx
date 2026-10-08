import { useEffect } from 'react'
import { create } from 'zustand'
import { useSim } from '@/core/sim'
import type { SceneDef, TourStep } from '@/modules/types'
import { useView } from '@/render/view'
import { flyTo } from './camera'
import { Icon } from './icons'

interface TourState {
  active: boolean
  index: number
  start: () => void
  stop: () => void
  go: (i: number) => void
}

export const useTour = create<TourState>((set) => ({
  active: false,
  index: 0,
  start: () => set({ active: true, index: 0 }),
  stop: () => set({ active: false }),
  go: (index) => set({ index }),
}))

export function applyStep(step: TourStep, scene: SceneDef) {
  const v = useView.getState()
  if (step.camera) flyTo(step.camera)
  if (step.select !== undefined) v.select(step.select)
  if (step.isolate !== undefined) v.isolate(step.isolate)
  if (step.cut === false) v.setCut({ enabled: false })
  else if (typeof step.cut === 'string') v.applyPreset(step.cut)
  if (step.sectionMoving !== undefined) v.setCut({ sectionMoving: step.sectionMoving })
  if (step.explode !== undefined) v.setExplode(step.explode)
  if (step.xray !== undefined) v.setXray(step.xray)
  const sim = useSim.getState()
  if (step.playing !== undefined) sim.setPlaying(step.playing)
  if (step.timeScale !== undefined) sim.setTimeScale(step.timeScale)
  if (step.params && scene.applyParams) scene.applyParams(step.params)
}

/** Renders **bold** in tour text. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') ? (
          <strong key={i} className="font-semibold text-ink">
            {p.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function TourPlayer({ scene }: { scene: SceneDef }) {
  const { active, index, go, stop } = useTour()
  const steps = scene.tour ?? []
  const step = steps[index]

  useEffect(() => {
    if (active && step) applyStep(step, scene)
  }, [active, index, step, scene])

  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(Math.min(steps.length - 1, index + 1))
      if (e.key === 'ArrowLeft') go(Math.max(0, index - 1))
      if (e.key === 'Escape') stop()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, index, steps.length, go, stop])

  if (!active || !step) return null
  return (
    <div className="pointer-events-auto w-[min(420px,calc(100vw-1.5rem))] rounded-xl border border-accent/40 bg-panel/95 shadow-2xl shadow-black/50 backdrop-blur" role="dialog" aria-label="Guided tour">
      <div className="flex items-center gap-2 border-b border-line px-3.5 py-2">
        <Icon.tour width={16} height={16} className="text-accent" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-mute">
          Guided tour · {index + 1}/{steps.length}
        </span>
        <button aria-label="End tour" className="ml-auto grid h-7 w-7 place-items-center rounded-md text-mute hover:bg-panel-3 hover:text-ink" onClick={stop}>
          <Icon.close width={16} height={16} />
        </button>
      </div>
      <div className="px-3.5 py-2.5">
        <h3 className="mb-1 text-[15px] font-semibold text-ink">{step.title}</h3>
        <div className="space-y-1.5 text-[13px] leading-relaxed text-ink/85">
          {step.body.split('\n\n').map((para, i) => (
            <p key={i}>
              <Rich text={para} />
            </p>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <div className="flex flex-1 gap-1" aria-hidden>
          {steps.map((_, i) => (
            <button key={i} onClick={() => go(i)} className={`h-1.5 flex-1 rounded-full ${i <= index ? 'bg-accent' : 'bg-line-2'}`} tabIndex={-1} />
          ))}
        </div>
        <button disabled={index === 0} onClick={() => go(index - 1)} className="rounded-md px-2.5 py-1 text-[12.5px] text-ink/85 hover:bg-panel-3 disabled:opacity-40">
          Back
        </button>
        {index < steps.length - 1 ? (
          <button onClick={() => go(index + 1)} className="rounded-md bg-accent px-3 py-1 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
            Next
          </button>
        ) : (
          <button onClick={stop} className="rounded-md bg-accent px-3 py-1 text-[12.5px] font-semibold text-accent-ink hover:brightness-110">
            Finish
          </button>
        )}
      </div>
    </div>
  )
}
