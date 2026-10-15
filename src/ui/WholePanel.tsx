import { useState } from 'react'
import { useParts } from '@/parts/registry'
import { useView } from '@/render/view'
import { SYSTEMS } from '@/tractor/systems'
import { focusPart } from './camera'
import { Icon } from './icons'
import { enterInside, exitInside, setExploded, useInside } from './inside'

/** Header button: open the whole machine (shown when the scene has one that can be opened). */
export function WholeButton() {
  const part = useParts((s) => Object.values(s.parts).find((p) => p.info?.insideMode === 'whole'))
  const open = useInside((s) => s.id !== null)
  if (!part || open) return null
  return (
    <button
      onClick={() => enterInside(part)}
      // start building the heavy parts while the pointer is on its way
      onPointerEnter={() => {
        // loaded on demand so the main bundle stays light
        void import('@/machines/engine.geometry').then((m) => m.prepareEngine())
        void import('@/tractor/systems.geometry').then((m) => m.prepareSystems())
      }}
      className="hidden items-center gap-1.5 rounded-md border border-accent/40 px-2 py-1 text-[12px] text-accent hover:bg-accent/10 md:flex"
      title="Every system of the tractor at once, working"
    >
      <Icon.xray width={13} height={13} /> Whole tractor
    </button>
  )
}

/** Legend and controls while the whole machine is open. */
export function WholePanel() {
  const id = useInside((s) => s.id)
  const mode = useInside((s) => s.mode)
  const exploded = useInside((s) => s.exploded)
  const loading = useInside((s) => s.loading)
  const tints = useView((s) => s.tints)
  const [folded, setFolded] = useState(false)
  const hidden = useView((s) => s.hidden)
  // a string, so the selector result is stable between renders
  const keys = useParts((s) =>
    id
      ? SYSTEMS.filter((d) => `${id}-sys-${d.key}` in s.parts)
          .map((d) => d.key)
          .join(',')
      : '',
  )
  const present = SYSTEMS.filter((d) => keys.split(',').includes(d.key))
  if (!id || mode !== 'whole') return null
  const v = useView.getState()
  return (
    <div className="pointer-events-auto absolute right-3 top-3 z-20 w-[min(270px,calc(100%-1.5rem))] rounded-xl border border-line-2 bg-panel/95 p-3 text-[12.5px] shadow-2xl backdrop-blur">
      <div className="flex items-center gap-2">
        <button onClick={() => setFolded(!folded)} className="flex items-center gap-1 font-semibold text-ink" aria-expanded={!folded}>
          <Icon.chevron width={12} height={12} className={`transition-transform ${folded ? '' : 'rotate-90'}`} />
          Inside the whole tractor
        </button>
        <button onClick={exitInside} className="ml-auto rounded-full bg-accent px-2.5 py-0.5 text-[12px] font-medium text-accent-ink hover:brightness-110">
          Back
        </button>
      </div>
      {folded ? null : (
        <>
          <div className="mt-1 text-[11.5px] text-dim">{loading ? 'Building the tractor’s systems…' : 'Slow motion · click any part for its card'}</div>
          <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-panel-3 p-0.5 text-[12px]">
            {(['Assembled', 'Exploded'] as const).map((l) => {
              const on = (l === 'Exploded') === exploded
              return (
                <button key={l} onClick={() => setExploded(l === 'Exploded')} className={`rounded-md py-1 ${on ? 'bg-panel font-medium text-ink shadow-sm' : 'text-mute hover:text-ink'}`}>
                  {l}
                </button>
              )
            })}
          </div>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-ink/90">
            <input type="checkbox" checked={tints} onChange={(e) => v.setTints(e.target.checked)} className="accent-[var(--color-accent)]" />
            Colour by system
          </label>
          <ul className="mt-2 space-y-0.5">
            {present.map((d) => {
              const sid = `${id}-sys-${d.key}`
              const off = hidden.includes(sid)
              return (
                <li key={d.key} className="flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-panel-3">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: d.color, opacity: off ? 0.3 : 1 }} />
                  <button
                    className={`min-w-0 flex-1 truncate text-left ${off ? 'text-dim line-through' : 'text-ink/90'}`}
                    onClick={() => {
                      v.select(sid)
                      focusPart(sid)
                    }}
                    title={d.info.summary}
                  >
                    {d.name}
                  </button>
                  <button aria-label={off ? `Show ${d.name}` : `Hide ${d.name}`} className="grid h-6 w-6 place-items-center rounded text-dim hover:text-ink" onClick={() => v.toggleHidden(sid)}>
                    {off ? <Icon.eyeOff width={14} height={14} /> : <Icon.eye width={14} height={14} />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
