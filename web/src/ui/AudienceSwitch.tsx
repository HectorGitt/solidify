import { useAudience, type Audience } from './audience'

const OPTIONS: { value: Audience; label: string; short: string; hint: string }[] = [
  { value: 'professional', label: 'Professional', short: 'Pro', hint: 'Engineering content only' },
  { value: 'academic', label: 'Academic', short: 'Study', hint: 'Adds worked exam examples, study notes and corrections' },
]

/** Compact Professional / Academic toggle for headers. */
export function AudienceSwitch({ compact = false }: { compact?: boolean }) {
  const audience = useAudience((s) => s.audience)
  const setAudience = useAudience((s) => s.setAudience)
  return (
    <div role="radiogroup" aria-label="Audience" className="flex rounded-full border border-line-2 bg-panel-2/90 p-0.5 backdrop-blur-sm shadow-inner shadow-black/20">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={audience === o.value}
          title={o.hint}
          onClick={() => setAudience(o.value)}
          className={`rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-all ${
            audience === o.value
              ? 'bg-ink text-bg font-semibold shadow-sm shadow-black/30'
              : 'text-mute hover:text-ink hover:bg-ink/[0.04]'
          }`}
        >
          {compact ? o.short : o.label}
        </button>
      ))}
    </div>
  )
}
