import { create } from 'zustand'
import { toast } from './toast'

declare const __BUILD_ID__: string

/**
 * After a deploy, a tab opened earlier still runs the old app, and the page files it asks for are gone.
 * This recognises that failure and tells the user before reloading into the new version (UpdateNotice shows
 * it); open tabs are also told when a new version is live, before they hit it.
 */
export function isUpdateError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|ChunkLoadError/i.test(msg)
}

const KEY = 'solidify.updateReload'
/** seconds shown before the reload */
export const RELOAD_IN = 3

/** `due`: when the reload happens (null: waiting for the user, after a reload that did not help, or "Not now") */
export const useAppUpdate = create<{ shown: boolean; due: number | null }>(() => ({ shown: false, due: null }))

let timer: number | undefined

const reloadedJustNow = () => {
  try {
    return Date.now() - Number(sessionStorage.getItem(KEY) ?? 0) < 30_000
  } catch {
    return false
  }
}

export function reloadNow() {
  try {
    sessionStorage.setItem(KEY, String(Date.now()))
  } catch {
    /* storage blocked: reload anyway */
  }
  window.location.reload()
}

/** a page file from before the deploy failed: say so, then reload in a few seconds (once; a second time, wait for the user) */
export function announceUpdate() {
  if (useAppUpdate.getState().shown) return
  if (reloadedJustNow()) {
    useAppUpdate.setState({ shown: true, due: null })
    return
  }
  useAppUpdate.setState({ shown: true, due: Date.now() + RELOAD_IN * 1000 })
  timer = window.setTimeout(reloadNow, RELOAD_IN * 1000)
}

/** "Not now": keep the page as it is; the notice stays with its Reload button */
export function postponeUpdate() {
  window.clearTimeout(timer)
  useAppUpdate.setState({ due: null })
}

let started = false
let told = false

/** from start-up: notice failed page files, and check now and then for a newer deploy */
export function startUpdateWatch() {
  if (started || typeof window === 'undefined') return
  started = true
  // Vite reports a page file that failed to load here; the import still fails, and the page's error
  // screen says it is an update, but the notice (and its reload) starts straight away
  window.addEventListener('vite:preloadError', () => announceUpdate())
  if (!import.meta.env.PROD || typeof __BUILD_ID__ !== 'string') return
  const check = async () => {
    if (told) return
    try {
      const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) return
      const { build } = (await res.json()) as { build?: string }
      if (build && build !== __BUILD_ID__) {
        told = true
        toast('A new version of Solidify is available.', { action: { label: 'Reload', run: reloadNow } })
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
