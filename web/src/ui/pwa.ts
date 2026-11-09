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
