import { create } from 'zustand'

/**
 * Light or dark, or follow the device. The resolved theme is written to <html data-theme> so the
 * colour tokens in index.css switch; index.html applies the saved choice before first paint so
 * pages don't flash the wrong theme.
 */
export type ThemeChoice = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'solidify.theme'
const media = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null

function load(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY)
    if (v === 'system' || v === 'light' || v === 'dark') return v
  } catch {
    /* storage unavailable (private mode, previews) */
  }
  return 'system'
}

const resolve = (c: ThemeChoice): Theme => (c === 'system' ? (media?.matches ? 'light' : 'dark') : c)

function apply(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f6f2' : '#050607')
}

interface ThemeState {
  choice: ThemeChoice
  theme: Theme
  setChoice: (c: ThemeChoice) => void
}

export const useTheme = create<ThemeState>((set, get) => {
  const choice = load()
  const theme = resolve(choice)
  apply(theme)
  media?.addEventListener('change', () => {
    if (get().choice !== 'system') return
    const t = resolve('system')
    apply(t)
    set({ theme: t })
  })
  return {
    choice,
    theme,
    setChoice: (c) => {
      try {
        localStorage.setItem(KEY, c)
      } catch {
        /* ignore */
      }
      const t = resolve(c)
      apply(t)
      set({ choice: c, theme: t })
    },
  }
})

export const useIsLight = () => useTheme((s) => s.theme === 'light')
