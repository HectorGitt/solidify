import { useEffect, useMemo, useRef, useState } from 'react'
import { useParts } from '@/parts/registry'
import { useView } from '@/render/view'
import { Icon } from './icons'

/**
 * "Follow the power": walk the power flow stage by stage, highlighting each part with a line on
 * what happens there. Uses the shared tractor's parts when the scene has the tractor.
 */
export interface PowerStage {
  /** part id; the first registered of the alternatives is used */
  ids: string[]
  label: string
  note: string
}

export const TRACTOR_PATH: PowerStage[] = [
  { ids: ['tractor-crank', 'tractor-engine'], label: 'Engine', note: 'Fuel burns in the cylinders; the crankshaft turns. Power = torque × speed (2πNT).' },
  { ids: ['tractor-flywheel'], label: 'Flywheel', note: 'Stores energy between power strokes so the drive turns smoothly.' },
  { ids: ['tractor-clutch-disc', 'tractor-clutch-housing'], label: 'Clutch', note: 'Connects or disconnects the engine and gearbox — friction carries the full engine torque.' },
  { ids: ['tractor-gears', 'tractor-gearbox'], label: 'Gearbox', note: 'Chooses the speed ratio: lower gears trade speed for torque at the wheels (about 98 % per gear pair).' },
  { ids: ['tractor-crown-wheel', 'tractor-centre-housing'], label: 'Crown wheel & differential', note: 'Turns the drive through 90° and reduces it again; the differential lets the wheels turn at different speeds on corners.' },
  { ids: ['tractor-trumpets'], label: 'Final drives', note: 'The last reduction, at the wheel ends: speed falls, torque rises to drive the big rear wheels.' },
  { ids: ['tractor-rear-wheel-l', 'tractor-rear-wheels'], label: 'Rear wheels & soil', note: 'The tyre turns axle torque into pull against the soil — less rolling resistance and slip losses.' },
  { ids: ['tractor-linkage', 'tractor-drawbar'], label: 'Implement', note: 'The pull reaches the implement through the drawbar or the three-point linkage: drawbar power = pull × speed.' },
  { ids: ['tractor-pto'], label: 'PTO (branch)', note: 'A second path straight from the gearbox: 540 or 1000 rpm to drive the implement’s own mechanisms.' },
]

/** The stages present in the scene now (with the part id each will highlight). */
export function presentStages(path: PowerStage[], parts: Record<string, unknown>) {
  return path.map((s) => ({ ...s, id: s.ids.find((id) => id in parts) })).filter((s): s is PowerStage & { id: string } => !!s.id)
}

export function PowerPathButton({ onStart }: { onStart: () => void }) {
  const has = useParts((s) => 'tractor-engine' in s.parts || 'tractor-gearbox' in s.parts)
  if (!has) return null
  return (
    <button onClick={onStart} className="hidden items-center gap-1.5 rounded-md border border-warn/40 px-2 py-1 text-[12px] text-warn hover:bg-warn/10 md:flex" title="Walk the power from the engine to the wheels">
      <Icon.bolt width={13} height={13} /> Follow the power
    </button>
  )
}

export function PowerPath({ onClose }: { onClose: () => void }) {
  const parts = useParts((s) => s.parts)
  const stages = useMemo(() => presentStages(TRACTOR_PATH, parts), [parts])
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)
  const prevXray = useRef(useView.getState().xray)

  useEffect(() => {
    const v = useView.getState()
    prevXray.current = v.xray
    v.setXray(true)
    return () => {
      const w = useView.getState()
      w.setXray(prevXray.current)
      w.select(null)
    }
  }, [])
  useEffect(() => {
    const s = stages[i]
    if (s) useView.getState().select(s.id)
  }, [i, stages])
  useEffect(() => {
    if (!playing || !stages.length) return
    const t = window.setTimeout(() => {
      if (i + 1 < stages.length) setI(i + 1)
      else setPlaying(false)
    }, 2400)
    return () => window.clearTimeout(t)
  }, [i, playing, stages.length])

  if (!stages.length) return null
  const s = stages[i]
  return (
    <div className="pointer-events-auto w-[min(560px,calc(100vw-1.5rem))] rounded-xl border border-warn/40 bg-panel/95 p-3 shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <Icon.bolt width={15} height={15} className="text-warn" />
        <div className="text-[13px] font-semibold text-ink">Follow the power</div>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => setPlaying(!playing)} className="rounded-md px-2 py-0.5 text-[12px] text-ink/85 hover:bg-panel-3">
            {playing ? 'Pause' : i + 1 >= stages.length ? 'Done' : 'Play'}
          </button>
          <button onClick={onClose} aria-label="Stop" className="grid h-6 w-6 place-items-center rounded text-mute hover:bg-panel-3 hover:text-ink">
            <Icon.close width={13} height={13} />
          </button>
        </div>
      </div>
      <ol className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px]">
        {stages.map((st, k) => (
          <li key={st.id} className="flex items-center gap-1">
            <button
              onClick={() => {
                setI(k)
                setPlaying(false)
              }}
              className={`rounded-full border px-2 py-0.5 ${k === i ? 'border-warn bg-warn/15 text-warn' : k < i ? 'border-line-2 text-ink/80' : 'border-line-2 text-dim'}`}
            >
              {st.label}
            </button>
            {k < stages.length - 1 ? <span className="text-dim">→</span> : null}
          </li>
        ))}
      </ol>
      <p className="mt-2 text-[12.5px] leading-snug text-ink/90">
        <b className="text-warn">{s.label}. </b>
        {s.note}
      </p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-3">
        <div className="h-full bg-warn transition-[width] duration-300" style={{ width: `${((i + 1) / stages.length) * 100}%` }} />
      </div>
    </div>
  )
}
