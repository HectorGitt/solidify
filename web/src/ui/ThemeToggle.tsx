import { Icon } from './icons'
import { useTheme, type ThemeChoice } from './theme'

const OPTIONS: { value: ThemeChoice; label: string; icon: keyof typeof Icon }[] = [
  { value: 'light', label: 'Light', icon: 'sun' },
  { value: 'dark', label: 'Dark', icon: 'moon' },
  { value: 'system', label: 'System', icon: 'monitor' },
]

/** Light / dark / system switch: three icon buttons in a pill. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const choice = useTheme((s) => s.choice)
  const setChoice = useTheme((s) => s.setChoice)
  return (
    <div role="radiogroup" aria-label="Theme" className={`flex shrink-0 items-center rounded-full border border-line-2 bg-panel-2/80 p-0.5 backdrop-blur-md ${className}`}>
      {OPTIONS.map((o) => {
        const I = Icon[o.icon]
        const on = choice === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={`${o.label} theme`}
            title={o.value === 'system' ? 'Match this device' : `${o.label} theme`}
            onClick={() => setChoice(o.value)}
            className={`grid h-7 w-7 place-items-center rounded-full transition-colors ${on ? 'bg-ink text-bg' : 'text-mute hover:text-ink'}`}
          >
            <I width={14} height={14} />
          </button>
        )
      })}
    </div>
  )
}
