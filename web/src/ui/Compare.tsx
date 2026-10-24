import { useEffect, useState } from 'react'
import { compareTable } from '@/content/compare'
import type { CompareMetric, SceneDef } from '@/modules/types'

/**
 * Compare variants: the same readouts for a few versions of the current settings, side by side
 * (bias against radial, 2WD against front assist…). Computed from the scene's model, so the scene
 * itself is untouched until you pick one to show.
 */

const fmt = (m: CompareMetric) => (m.text ? m.text : Number.isFinite(m.value) ? m.value.toFixed(m.digits ?? 1) : '—')

/** a value per variant that matches the current settings (to mark "now") */
const matches = (cur: Record<string, unknown>, p: Record<string, unknown>) => Object.entries(p).every(([k, v]) => cur[k] === v)

export function ComparePanel({ scene }: { scene: SceneDef }) {
  const def = scene.compare
  const [open, setOpen] = useState(false)
  const [cur, setCur] = useState<Record<string, unknown> | null>(null)
  // follow the scene's settings while open (they live in each scene's own store)
  useEffect(() => {
    if (!open || !def) return
    const tick = () => setCur((prev) => {
      const next = def.current()
      return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next
    })
    tick()
    const t = window.setInterval(tick, 500)
    return () => window.clearInterval(t)
  }, [open, def])
  if (!def) return null
  const table = open && cur ? compareTable(def, cur) : null
  return (
    <div className="border-b border-line px-4 py-2.5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 text-left text-[12.5px] font-medium text-ink hover:text-accent">
        <span className={`inline-block transition-transform ${open ? 'rotate-90' : ''}`}>›</span>
        Compare: {def.title}
      </button>
      {table ? (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr>
                <th />
                {table.cols.map((c) => (
                  <th key={c.label} className="px-1.5 pb-1 text-right font-medium text-ink">
                    {c.label}
                    {matches(cur!, def.variants.find((v) => v.label === c.label)!.params) ? <span className="ml-1 text-[10px] font-normal text-accent">now</span> : null}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r.label} className="border-t border-line/60">
                  <td className="py-1 pr-1 text-mute">
                    {r.label}
                    {r.unit ? <span className="text-dim"> ({r.unit})</span> : null}
                  </td>
                  {r.cells.map((c, k) => (
                    <td key={k} className={`px-1.5 py-1 text-right tabular-nums ${c.v.text ? 'text-danger' : c.best ? 'font-semibold text-accent' : 'text-ink/90'}`}>
                      {fmt(c.v)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td />
                {table.cols.map((c) => (
                  <td key={c.label} className="px-1.5 pt-1.5 text-right">
                    <button onClick={() => scene.applyParams?.(c.params)} className="rounded border border-line-2 px-1.5 py-0.5 text-[11px] text-mute hover:border-accent/50 hover:text-ink">
                      Show
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          <p className="mt-1.5 text-[11px] text-dim">Same job and settings; only the named change differs. Best value in each row is highlighted.</p>
        </div>
      ) : null}
    </div>
  )
}
