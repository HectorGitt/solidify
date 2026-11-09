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
