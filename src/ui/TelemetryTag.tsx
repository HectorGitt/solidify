import { useParts } from '@/parts/registry'
import { useTelemetry } from '@/render/Telemetry'
import { useView } from '@/render/view'
import { fmt } from './controls'

/** A small live readout for the hovered (or selected) moving part: its measured speed. */
export function TelemetryTag() {
  const t = useTelemetry()
  const name = useParts((s) => (t.id ? s.parts[t.id]?.name : undefined))
  const role = useParts((s) => (t.id ? s.parts[t.id]?.role : undefined))
  const hovered = useView((s) => s.hoveredId)
  if (!t.id || !name) return null
  const turning = t.rpm >= 1
  const moving = t.speed >= 0.01
  if (!turning && !moving && role !== 'moving') return null
  return (
    <div className="pointer-events-none absolute bottom-16 right-3 z-10 rounded-lg border border-line-2 bg-panel/90 px-2.5 py-1.5 font-mono text-[11.5px] text-ink shadow-xl">
      <div className="text-[10.5px] uppercase tracking-wide text-dim">{hovered === t.id ? 'under the pointer' : 'selected'} · live</div>
      <div className="font-sans text-[12.5px] font-medium">{name}</div>
      <div>
        {t.tooFast ? (
          <span className="text-warn" title="Turning more than about half a revolution per frame — slow the simulation down to read it exactly">≥ {fmt(t.rpm, 3)} rpm (slow down to read)</span>
        ) : turning ? (
          <span className="text-accent">{fmt(t.rpm, 3)} rpm</span>
        ) : (
          <span className="text-mute">not turning</span>
        )}
        {moving ? <span className="text-info"> · {fmt(t.speed, 3)} m/s</span> : null}
      </div>
    </div>
  )
}
