import type { ReactNode } from 'react'
import { ERRATA } from '@/content/errata'
import { Badge } from '@/ui/controls'

export interface Preset {
  id: string
  label: string
  /** what the notes / marking guide expect */
  note: string
  apply: () => void
  /** errata id from src/content/errata.ts shown with this preset */
  errata?: string
  /** a discrepancy that is not (yet) in the shared errata list */
  flag?: string
}

/** The shared erratum's corrected statement (for Working steps). */
export const erratum = (id: string) => ERRATA.find((e) => e.id === id)?.correct

/** Grid of exam / example presets; the chosen one's note (and any errata) is shown underneath. */
export function PresetGrid({ presets, active, onPick }: { presets: Preset[]; active: string | null; onPick: (id: string) => void }) {
  const cur = presets.find((p) => p.id === active)
  const err = cur?.errata ? ERRATA.find((e) => e.id === cur.errata) : undefined
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
            className={`rounded-md border px-2 py-1.5 text-left text-[12px] leading-tight ${active === p.id ? 'border-accent bg-accent/10 text-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
          >
            {p.label}
            {p.errata || p.flag ? (
              <span className="ml-1 align-middle">
                <Badge tone="warn">!</Badge>
              </span>
            ) : null}
          </button>
        ))}
      </div>
      {cur ? <p className="mt-1.5 text-[11.5px] leading-snug text-mute">{cur.note}</p> : null}
      {err ? (
        <div className="mt-1.5 rounded-md border border-warn/40 bg-warn/5 px-2 py-1.5 text-[11px] leading-snug">
          <Badge tone="warn">discrepancy</Badge> <span className="text-mute">{err.topic}.</span> <span className="text-dim">Printed: {err.says}</span>{' '}
          <span className="text-warn/90">Correct: {err.correct}</span>
        </div>
      ) : null}
      {cur?.flag ? (
        <div className="mt-1.5 rounded-md border border-warn/40 bg-warn/5 px-2 py-1.5 text-[11px] leading-snug text-warn/90">
          <Badge tone="warn">discrepancy</Badge> {cur.flag}
        </div>
      ) : null}
    </>
  )
}

export function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' | 'mute' | 'info' }) {
  const cls = { dim: 'text-dim', warn: 'text-warn', mute: 'text-mute', info: 'text-info' }[tone]
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

/** A small labelled number input for catalogue values that the student reads off a table. */
export function NumberField({ label, value, onChange, step = 0.01, unit, hint }: { label: ReactNode; value: number; onChange: (v: number) => void; step?: number; unit?: string; hint?: string }) {
  return (
    <label className="mb-1.5 flex items-center justify-between gap-2 text-[12px]" title={hint}>
      <span className="text-ink/90">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="number"
          step={step}
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="w-20 rounded border border-line-2 bg-panel-2 px-1.5 py-0.5 text-right font-mono text-[12px] text-accent"
        />
        {unit ? <span className="w-8 text-[11px] text-mute">{unit}</span> : null}
      </span>
    </label>
  )
}

/** Live mode switcher button row for scenes that hold several assemblies. */
export function ModeTabs<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md border px-2 py-1 text-[12px] ${o.value === value ? 'border-accent bg-accent text-accent-ink' : 'border-line-2 text-ink/80 hover:border-accent/50'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
