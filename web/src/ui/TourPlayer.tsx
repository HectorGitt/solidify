import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { useSim } from '@/core/sim'
import type { SceneDef, TourCheck, TourStep } from '@/modules/types'
import { useView } from '@/render/view'
import { flyTo } from './camera'
import { Icon } from './icons'
import { onTourFinished } from '@/study/bridge'
import { useProgress } from '@/study/progress'

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

/** A checkpoint: pick an answer, see why, and the scene shows it. */
function Checkpoint({ check, sceneId, step, scene, onAnswered }: { check: TourCheck; sceneId: string; step: number; scene: SceneDef; onAnswered: () => void }) {
  const [picked, setPicked] = useState<number | null>(null)
  useEffect(() => setPicked(null), [sceneId, step])
  const answered = picked !== null
  const right = picked === check.answer
  const pick = (i: number) => {
    if (answered) return
    setPicked(i)
    useProgress.getState().recordCheck(sceneId, step, i === check.answer)
    if (check.reveal) applyStep({ title: '', body: '', ...check.reveal }, scene)
    onAnswered()
  }
  return (
    <div className="mt-2.5 rounded-lg border border-info/30 bg-info/5 px-3 py-2.5">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-info">Checkpoint</div>
      <p className="mb-2 text-[13px] font-medium text-ink">
        <Rich text={check.question} />
      </p>
      <div className="grid gap-1.5" role="radiogroup" aria-label="Checkpoint answers">
        {check.options.map((o, i) => {
          const state = !answered ? 'idle' : i === check.answer ? 'right' : i === picked ? 'wrong' : 'other'
          return (
            <button
              key={i}
              role="radio"
              aria-checked={picked === i}
              disabled={answered}
              onClick={() => pick(i)}
              className={`rounded-md border px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                state === 'right' ? 'border-accent/60 bg-accent/15 text-accent' : state === 'wrong' ? 'border-danger/50 bg-danger/10 text-danger' : state === 'other' ? 'border-line text-dim' : 'border-line-2 text-ink/90 hover:border-info/50'
              }`}
            >
              {o}
            </button>
          )
        })}
      </div>
      {answered ? (
        <p className={`mt-2 text-[12.5px] leading-relaxed ${right ? 'text-accent' : 'text-ink/85'}`}>
          <strong className="font-semibold">{right ? 'Right. ' : 'Not quite. '}</strong>
          <Rich text={check.explain} />
          {check.reveal ? <span className="text-dim"> Watch the scene.</span> : null}
        </p>
      ) : null}
    </div>
  )
}

export function TourPlayer({ scene }: { scene: SceneDef }) {
  const { active, index, go, stop } = useTour()
  const steps = scene.tour ?? []
  const step = steps[index]
  const [answered, setAnswered] = useState(false)
  useEffect(() => setAnswered(false), [index, active])

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
        {step.check ? <Checkpoint check={step.check} sceneId={scene.id} step={index} scene={scene} onAnswered={() => setAnswered(true)} /> : null}
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
          <button onClick={() => go(index + 1)} className={`rounded-md px-3 py-1 text-[12.5px] font-semibold ${step.check && !answered ? 'text-mute hover:bg-panel-3 hover:text-ink' : 'bg-accent text-accent-ink hover:brightness-110'}`}>
            {step.check && !answered ? 'Skip' : 'Next'}
          </button>
        ) : (
          <button
            onClick={() => {
              onTourFinished(scene.id)
              stop()
            }}
            className="rounded-md bg-accent px-3 py-1 text-[12.5px] font-semibold text-accent-ink hover:brightness-110"
          >
            Finish
          </button>
        )}
      </div>
    </div>
  )
}
