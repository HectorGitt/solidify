import type { ReactNode } from 'react'
import { sectionForAudience, useAcademic } from './audience'

export function fmt(v: number, digits = 3) {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2)
  return Number(v.toPrecision(digits)).toLocaleString('en-GB', { maximumFractionDigits: 6 })
}

/**
 * A titled block in a scene panel. Exam drills and marking-scheme sections are shown only in
 * academic mode; exam tags are stripped from other titles for professionals.
 */
export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  const academic = useAcademic()
  const view = sectionForAudience(title, academic)
  if (!view.show) return null
  return (
    <section className="border-b border-line px-4 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-mute">{view.title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  digits = 3,
  hint,
}: {
  label: ReactNode
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
  digits?: number
  hint?: string
}) {
  const fill = ((value - min) / (max - min)) * 100
  return (
    <label className="mb-2.5 block" title={hint}>
      <div className="mb-0.5 flex items-baseline justify-between text-[12.5px]">
        <span className="text-ink/90">{label}</span>
        <span className="font-mono text-[12px] text-accent">
          {fmt(value, digits)}
          {unit ? <span className="ml-0.5 text-mute">{unit}</span> : null}
        </span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ ['--fill' as string]: `${fill}%` }}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T
  options: { value: T; label: ReactNode; title?: string }[]
  onChange: (v: T) => void
  label?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="mb-2.5">
      {label ? <div className="mb-1 text-[12.5px] text-ink/90">{label}</div> : null}
      <div role="radiogroup" aria-label={label} className="flex rounded-md border border-line-2 bg-panel-2 p-0.5">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-[5px] px-2 ${size === 'sm' ? 'py-0.5 text-[11.5px]' : 'py-1 text-[12.5px]'} font-medium transition-colors ${
              o.value === value ? 'bg-accent text-accent-ink' : 'text-mute hover:text-ink'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toggle({ label, checked, onChange, hint }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  return (
    <label className="mb-2 flex cursor-pointer items-center justify-between gap-3 text-[12.5px]" title={hint}>
      <span className="text-ink/90">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line-2'}`}
      >
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-ink transition-all ${checked ? 'left-[16px]' : 'left-[2px]'}`} />
      </button>
    </label>
  )
}

export function Readout({ label, value, unit, tone = 'ink' }: { label: ReactNode; value: ReactNode; unit?: string; tone?: 'ink' | 'accent' | 'warn' | 'info' }) {
  const toneCls = { ink: 'text-ink', accent: 'text-accent', warn: 'text-warn', info: 'text-info' }[tone]
  return (
    <div className="rounded-md border border-line bg-panel-2 px-2.5 py-1.5">
      <div className="text-[10.5px] uppercase tracking-wide text-dim">{label}</div>
      <div className={`font-mono text-[14px] ${toneCls}`}>
        {value}
        {unit ? <span className="ml-1 text-[11px] text-mute">{unit}</span> : null}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'mute', title }: { children: ReactNode; tone?: 'mute' | 'warn' | 'info' | 'accent' | 'danger'; title?: string }) {
  const cls = {
    mute: 'border-line-2 text-mute',
    warn: 'border-warn/50 text-warn',
    info: 'border-info/50 text-info',
    accent: 'border-accent/50 text-accent',
    danger: 'border-danger/50 text-danger',
  }[tone]
  return (
    <span title={title} className={`inline-flex items-center rounded border px-1.5 py-px text-[10.5px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

export function IconButton({
  label,
  onClick,
  active,
  children,
  disabled,
}: {
  label: string
  onClick: () => void
  active?: boolean
  children: ReactNode
  disabled?: boolean
}) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md transition-colors disabled:opacity-40 ${
        active ? 'bg-accent text-accent-ink' : 'text-ink/85 hover:bg-panel-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
