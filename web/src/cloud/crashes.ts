import { API_URL } from './config'

declare const __BUILD_ID__: string

/**
 * When something breaks in a student's browser, tell the team: which part broke (a page, the 3D view, a
 * panel), the error, the page and the kind of device. No account, no names, nothing typed. The admin page
 * (Admin → Activity → Crashes) groups the same fault from many students into one line with a count.
 *
 * Only from the real site (a local build stays quiet unless localStorage `solidify.crash.test` is "1"); each
 * fault is sent once per page load, and at most ten per load.
 */
const sent = new Set<string>()
let budget = 10

const enabled = () => {
  if (import.meta.env.PROD) return true
  try {
    return localStorage.getItem('solidify.crash.test') === '1'
  } catch {
    return false
  }
}

/** a short, name-free description of the browser and device ("Edge · Windows", "Quest Browser · Quest") */
export function deviceOf(ua: string): string {
  const browser = /OculusBrowser/.test(ua) ? 'Quest Browser' : /SamsungBrowser/.test(ua) ? 'Samsung Internet' : /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Other browser'
  const os = /Quest|OculusBrowser/.test(ua) ? 'Quest' : /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'Mac' : /Linux|CrOS/.test(ua) ? 'Linux' : 'Other'
  return `${browser} · ${os}`
}

/** errors that are not faults in the app: a browser extension, a cancelled request, a known browser quirk */
export function isNoise(message: string, filename?: string, origin = typeof location === 'undefined' ? '' : location.origin): boolean {
  if (!message || message === 'Script error.' || /ResizeObserver loop/.test(message)) return true
  if (/AbortError|The user aborted|signal is aborted/i.test(message)) return true
  if (filename && origin && filename.startsWith('http') && !filename.startsWith(origin)) return true
  if (filename && /^(chrome|moz|safari)-extension:/.test(filename)) return true
  return false
}

/** where the student is, without anything identifying (ids in the path are kept; they name models, not people) */
const routeNow = () => (typeof location === 'undefined' ? '' : (location.hash.replace(/^#/, '').split('?')[0] || '/').slice(0, 200))

export function reportCrash(where: string, error: unknown, extra?: { headset?: boolean }) {
  if (!enabled() || budget <= 0) return
  const e = error instanceof Error ? error : new Error(typeof error === 'string' ? error : JSON.stringify(error ?? 'unknown'))
  const message = (e.message || e.name || 'Unknown error').slice(0, 500)
  const key = `${where}|${message}`
  if (sent.has(key)) return
  sent.add(key)
  budget--
  const body = {
    where: where.slice(0, 60),
    message,
    stack: e.stack?.slice(0, 4000),
    route: routeNow(),
    build: typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : undefined,
    device: typeof navigator === 'undefined' ? undefined : deviceOf(navigator.userAgent),
    headset: extra?.headset,
  }
  try {
    void fetch(`${API_URL}/v1/crashes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {})
  } catch {
    /* never let reporting break anything */
  }
}

/** errors nothing caught: thrown in an event handler, or a promise nobody waited on */
export function watchCrashes(isExpected: (e: unknown) => boolean, inHeadset: () => boolean) {
  window.addEventListener('error', (ev) => {
    const err = ev.error ?? ev.message
    if (isExpected(err) || isNoise(String(ev.message ?? ''), ev.filename)) return
    reportCrash('page script', err, { headset: inHeadset() })
  })
  window.addEventListener('unhandledrejection', (ev) => {
    const err = ev.reason
    const message = err instanceof Error ? err.message : String(err)
    if (isExpected(err) || isNoise(message)) return
    reportCrash('background task', err, { headset: inHeadset() })
  })
}
