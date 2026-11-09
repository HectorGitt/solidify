import { create } from 'zustand'

/**
 * Solidify as an installed app. The service worker (built by vite-plugin-pwa, see vite.config.ts) is
 * registered here by hand rather than by the plugin's helper, which reloads the page when a new worker takes
 * over: a reload would lose a model build in progress. New versions are announced by appUpdate.ts instead.
 */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch(() => {
      /* private window or blocked: the site works the same, just not offline */
    })
  })
}

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** the browser's install offer, kept for the menus' "Install the app" (Chrome, Edge, Android; Safari has none) */
export const useInstall = create<{ offer: InstallPromptEvent | null }>(() => ({ offer: null }))

export function watchInstallOffer() {
  if (typeof window === 'undefined') return
  window.addEventListener('beforeinstallprompt', (e) => {
    // keep it for our own button instead of the browser's mini bar
    e.preventDefault()
    useInstall.setState({ offer: e as InstallPromptEvent })
  })
  window.addEventListener('appinstalled', () => useInstall.setState({ offer: null }))
}

export async function installApp() {
  const offer = useInstall.getState().offer
  if (!offer) return
  await offer.prompt()
  // an offer can be used once, whatever the answer
  useInstall.setState({ offer: null })
}

const DISMISSED = 'solidify.install.dismissed'
const dismissedRecently = () => {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED) ?? 0) < 30 * 24 * 3600 * 1000
  } catch {
    return true
  }
}
export const dismissInstall = () => {
  try {
    localStorage.setItem(DISMISSED, String(Date.now()))
  } catch {
    /* it may show again */
  }
}
/** already running as the installed app */
export const isStandalone = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
/** iPhone or iPad Safari: no install offer there, only Share > Add to Home Screen */
export const isIosSafari = () => {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)
  return ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}
/** whether the install card may show at all (not installed, not turned down lately, not an automated browser) */
export const mayOfferInstall = () => !isStandalone() && !dismissedRecently() && !navigator.webdriver

const LAST = 'solidify.lastRoute'
/** pages not worth reopening at launch: the home page, sign-in returns, a preview whose model lived only in memory */
const skipRoute = (r: string) => r === '/' || r.startsWith('/create/preview') || r.startsWith('/shot') || r.startsWith('/promo')

/** remember where someone is, so the installed app can open there next time */
export function rememberRoute(route: string) {
  if (skipRoute(route)) return
  try {
    localStorage.setItem(LAST, route)
  } catch {
    /* storage blocked: the app opens on the labs */
  }
}

/**
 * Opened from the home screen: an installed app has no use for the home (sales) page at launch, so go back
 * to the last page used, or the labs the first time. Only at launch and only onto the bare home address:
 * a shared link still opens its own page, and the logo still leads home.
 */
export function openWhereLeftOff() {
  if (!isStandalone()) return
  const hash = window.location.hash
  if (hash && hash !== '#/' && hash !== '#') return
  let last: string | null = null
  try {
    last = localStorage.getItem(LAST)
  } catch {
    last = null
  }
  window.location.replace(`#${last && !skipRoute(last) ? last : '/labs'}`)
}
