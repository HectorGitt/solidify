import type { ReactNode } from 'react'

export interface PresetDef {
  id: string
  label: string
  note: ReactNode
  apply: () => void
}

/** Grid of exam-preset buttons with the active preset's note underneath. */
export function PresetGrid({ presets, active, onPick }: { presets: PresetDef[]; active: string | null; onPick: (id: string) => void }) {
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

/** Small explanatory paragraph. */
export function Note({ children, tone = 'dim' }: { children: ReactNode; tone?: 'dim' | 'warn' | 'mute' }) {
  const cls = { dim: 'text-dim', warn: 'text-warn/90', mute: 'text-mute' }[tone]
  return <p className={`mt-1 text-[11px] leading-snug ${cls}`}>{children}</p>
}
