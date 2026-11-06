import { toast } from './toast'

declare const __BUILD_ID__: string

/**
 * After a deploy, a tab opened earlier still runs the old app, and the page files it asks for are gone.
 * This recognises that failure, reloads once to pick up the new version, and warns open tabs of a new
 * version before they hit it.
 */
export function isUpdateError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(msg)
}

const KEY = 'solidify.updateReload'

/** reloads to the new version, unless that was just tried (then the caller shows the update screen) */
export function reloadForUpdate(): boolean {
  let last = 0
  try {
    last = Number(sessionStorage.getItem(KEY) ?? 0)
  } catch {
    /* storage blocked */
  }
  if (Date.now() - last < 30_000) return false
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage blocked: reload anyway */
  }
  window.location.reload()
  return true
}

let started = false
let told = false

/** from start-up: recover from missing page files, and check now and then for a newer deploy */
export function startUpdateWatch() {
  if (started || typeof window === 'undefined') return
  started = true
  // Vite reports a page file that failed to preload here
  window.addEventListener('vite:preloadError', (e) => {
    e.preventDefault()
    reloadForUpdate()
  })
  if (!import.meta.env.PROD || typeof __BUILD_ID__ !== 'string') return
  const check = async () => {
    if (told) return
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { build } = (await res.json()) as { build?: string }
      if (build && build !== __BUILD_ID__) {
        told = true
        toast('A new version of Solidify is available.', { action: { label: 'Reload', run: () => window.location.reload() } })
      }
    } catch {
      /* offline: try again later */
    }
  }
  window.setInterval(() => void check(), 10 * 60_000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check()
  })
}
