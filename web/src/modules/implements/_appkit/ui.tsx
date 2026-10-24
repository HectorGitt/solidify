import type { ReactNode } from 'react'

export interface Preset {
  id: string
  label: string
  note: string
  apply: () => void
}

/** Grid of exam-preset buttons with the selected preset's note underneath. */
export function PresetGrid({ presets, active, onPick, extra }: { presets: Preset[]; active: string | null; onPick: (id: string) => void; extra?: ReactNode }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              p.apply()
              onPick(p.id)
            }}
            className={`rounded-md border px-2 py-1.5 text-left text-[12px] ${active === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {active ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{presets.find((p) => p.id === active)?.note}</p> : null}
      {extra}
    </div>
  )
}

export function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' }) {
  return <p className={`mt-1 text-[11px] leading-snug ${tone === 'warn' ? 'text-warn/90' : 'text-dim'}`}>{children}</p>
}

/** Compact two-column table. */
export function Table({ head, rows, highlight }: { head: string[]; rows: ReactNode[][]; highlight?: number }) {
  return (
    <table className="w-full text-[11.5px]">
      <thead>
        <tr className="text-mute">
          {head.map((h) => (
            <th key={h} className="pb-1 text-left font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i === highlight ? 'text-accent' : 'text-ink/85'}>
            {r.map((c, j) => (
              <td key={j} className="py-0.5 pr-2 font-mono">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
