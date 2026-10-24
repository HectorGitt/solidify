import type { ReactNode } from 'react'
import { sectionForAudience, useAcademic } from './audience'

export function fmt(v: number, digits = 3) {
  if (!Number.isFinite(v)) return '—'
  const a = Math.abs(v)
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) return v.toExponential(2)
  if (digits < 1) return Math.round(v).toLocaleString('en-GB')
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
      {label ? <div className="mb-1 text-[12.5px] font-medium text-ink/90">{label}</div> : null}
      <div role="radiogroup" aria-label={label} className="flex rounded-lg border border-line-2 bg-panel-2 p-0.5 shadow-inner shadow-black/20">
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={o.value === value}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`flex-1 rounded-md px-2 ${size === 'sm' ? 'py-0.5 text-[11.5px]' : 'py-1 text-[12px]'} font-medium transition-all ${
              o.value === value ? 'bg-ink font-semibold text-bg shadow-sm' : 'text-mute hover:bg-white/[0.04] hover:text-ink'
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
    <div data-readout className="rounded-xl border border-line bg-panel-2/90 px-3 py-2 shadow-sm ring-1 ring-white/[0.02]">
      <div data-readout-label className="text-[10px] font-medium uppercase tracking-wider text-dim">{label}</div>
      <div data-readout-value className={`mt-0.5 font-mono text-[14px] font-semibold ${toneCls}`}>
        {value}
        {unit ? <span className="ml-1 text-[11.5px] font-normal text-mute">{unit}</span> : null}
      </div>
    </div>
  )
}

export function Badge({ children, tone = 'mute', title }: { children: ReactNode; tone?: 'mute' | 'warn' | 'info' | 'accent' | 'danger'; title?: string }) {
  const cls = {
    mute: 'border-line-2 bg-panel-3/50 text-mute',
    warn: 'border-warn/30 bg-warn/10 text-warn',
    info: 'border-info/30 bg-info/10 text-info',
    accent: 'border-accent/30 bg-accent/10 text-accent',
    danger: 'border-danger/30 bg-danger/10 text-danger',
  }[tone]
  return (
    <span title={title} className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10.5px] font-medium tracking-tight ${cls}`}>
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
      className={`grid h-8 w-8 place-items-center rounded-xl transition-all disabled:opacity-30 ${
        active ? 'bg-accent font-semibold text-accent-ink shadow-sm' : 'text-ink/80 hover:bg-panel-3 hover:text-ink active:scale-95'
      }`}
    >
      {children}
    </button>
  )
}
