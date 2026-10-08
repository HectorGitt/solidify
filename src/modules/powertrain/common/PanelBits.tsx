import type { ReactNode } from 'react'

export interface Preset {
  id: string
  label: string
  note: string
  apply: () => void
}

/** Grid of exam / example presets; the chosen one's note is shown underneath. */
export function PresetGrid({ presets, active, onPick }: { presets: Preset[]; active: string | null; onPick: (id: string) => void }) {
  return (
    <>
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
    </>
  )
}

export function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' | 'mute' }) {
  const cls = { dim: 'text-dim', warn: 'text-warn', mute: 'text-mute' }[tone]
  return <p className={`mt-1 text-[11px] leading-snug ${cls}`}>{children}</p>
}

/** Small legend chip for the power-flow colouring. */
export function PowerLegend() {
  return (
    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-mute">
      <span className="inline-block h-2 w-4 rounded-sm" style={{ background: '#d0631c' }} />
      parts carrying power are drawn orange
    </div>
  )
}

/** Compact table. */
export function Table({ head, rows, highlight }: { head: ReactNode[]; rows: ReactNode[][]; highlight?: number }) {
  return (
    <table className="w-full border-collapse font-mono text-[11.5px]">
      <thead>
        <tr className="text-left text-dim">
          {head.map((h, i) => (
            <th key={i} className="border-b border-line px-1 py-0.5 font-normal">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={i === highlight ? 'bg-accent/10 text-ink' : 'text-ink/80'}>
            {r.map((c, j) => (
              <td key={j} className="border-b border-line/50 px-1 py-0.5">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
