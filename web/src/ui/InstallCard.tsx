import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'
import { dismissInstall, installApp, isIosSafari, mayOfferInstall, useInstall } from './pwa'
import { usePageTour } from './PageTour'

/**
 * A small card offering to install Solidify, once the browser offers it (Chrome, Edge, Android) or on an
 * iPhone (where it can only be added from the Share menu). It waits a few seconds into the visit, never
 * over a page tour, and "Not now" keeps it away for a month; the menus keep "Install the app".
 */
export function InstallCard() {
  const offer = useInstall((s) => s.offer)
  const touring = usePageTour((s) => !!s.open)
  const [ready, setReady] = useState(false)
  const [gone, setGone] = useState(false)
  const ios = isIosSafari()
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), 8000)
    return () => window.clearTimeout(t)
  }, [])
  if (gone || !ready || touring || !mayOfferInstall() || (!offer && !ios)) return null
  const close = () => {
    dismissInstall()
    setGone(true)
  }
  return (
    <div role="dialog" aria-label="Install Solidify" className="fixed inset-x-4 bottom-4 z-[140] mx-auto max-w-sm rounded-2xl border border-line bg-panel p-3.5 shadow-2xl sm:left-auto sm:right-5 sm:mx-0">
      <p className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
        <LogoMark size={20} />
        Install Solidify
      </p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-mute">
        {ios ? (
          <>
            Open it from your home screen like an app, full screen and quicker to start: tap <span className="font-medium text-ink">Share</span>, then{' '}
            <span className="font-medium text-ink">Add to Home Screen</span>.
          </>
        ) : (
          'Open it from your home screen or desktop like an app: full screen, quicker to start, and pages you have visited work offline.'
        )}
      </p>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={close} className="rounded-full px-3.5 py-1.5 text-[12.5px] font-medium text-mute hover:text-ink">
          {ios ? 'Got it' : 'Not now'}
        </button>
        {!ios ? (
          <button
            type="button"
            onClick={() => {
              setGone(true)
              void installApp()
            }}
            className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:opacity-90"
          >
            Install
          </button>
        ) : null}
      </div>
    </div>
  )
}
