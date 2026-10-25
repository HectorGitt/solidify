import { Icon } from './icons'
import { useTheme, type ThemeChoice } from './theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }
const LABEL: Record<ThemeChoice, string> = { system: 'Theme: match device', light: 'Theme: light', dark: 'Theme: dark' }

/** One round button that steps device → light → dark; the icon shows the current choice. */
export function ThemeToggle({ className = '' }: { className?: string }) {
  const choice = useTheme((s) => s.choice)
  const setChoice = useTheme((s) => s.setChoice)
  const I = choice === 'light' ? Icon.sun : choice === 'dark' ? Icon.moon : Icon.monitor
  return (
    <button
      type="button"
      onClick={() => setChoice(NEXT[choice])}
      aria-label={`${LABEL[choice]}. Change theme`}
      title={LABEL[choice]}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line-2 bg-panel-2/80 text-mute backdrop-blur-md transition-colors hover:text-ink ${className}`}
    >
      <I width={16} height={16} />
    </button>
  )
}
