import type { ReactNode } from 'react'

/** Panel helpers shared by the chassis and traction-lab scenes. */

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

/** A true/false chip for a live condition. */
export function Truth({ ok, children }: { ok: boolean; children?: ReactNode }) {
  return (
    <span className={`inline-block rounded px-1.5 py-px font-mono text-[10.5px] ${ok ? 'bg-accent/15 text-accent' : 'bg-line/60 text-mute'}`}>
      {children ?? (ok ? 'true' : 'false')}
    </span>
  )
}

/** Bulleted exam points. */
export function Points({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-4 text-[11.5px] leading-snug text-ink/85">
      {items.map((it, i) => (
        <li key={i}>{it}</li>
      ))}
    </ul>
  )
}

/** Horizontal bar pair for front/rear wheel loads (kN), with the static value ticked. */
export function LoadBars({ rows, max }: { rows: { label: string; value: number; stat: number; color: string }[]; max: number }) {
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const w = Math.max(0, Math.min(100, (r.value / max) * 100))
        const s = Math.max(0, Math.min(100, (r.stat / max) * 100))
        return (
          <div key={r.label}>
            <div className="flex justify-between text-[11.5px]">
              <span className="text-ink/85">{r.label}</span>
              <span className={`font-mono ${r.value <= 0 ? 'text-warn' : 'text-ink'}`}>
                {r.value.toFixed(2)} kN <span className="text-mute">(static {r.stat.toFixed(2)})</span>
              </span>
            </div>
            <div className="relative h-2.5 rounded-sm bg-line/50">
              <div className="h-full rounded-sm" style={{ width: `${w}%`, background: r.value <= 0 ? '#e0564a' : r.color }} />
              <div className="absolute top-[-2px] h-[14px] w-[2px] bg-ink/70" style={{ left: `${s}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
