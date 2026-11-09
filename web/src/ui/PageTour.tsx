import { useEffect, useLayoutEffect, useState } from 'react'
import { create } from 'zustand'

/**
 * A short walk round a page for someone new: each step lights one control (found by its `data-tour` name) and
 * says what it is for. It opens by itself the first time a page is visited and can be opened again from the
 * header's "?" (or the phone menu). Steps whose control is not on screen (a phone hides some) are passed over.
 */
export interface PageTourStep {
  /** the `data-tour` name of the control to light; none puts the card in the middle */
  target?: string
  title: string
  text: string
}

interface TourStore {
  /** the tour the current page offers, for the "?" button */
  current: { id: string; steps: PageTourStep[] } | null
  /** the tour that is showing */
  open: { id: string; steps: PageTourStep[] } | null
  set: (t: TourStore['current']) => void
  show: () => void
  close: () => void
}

export const usePageTour = create<TourStore>((set, get) => ({
  current: null,
  open: null,
  set: (current) => set({ current }),
  show: () => set({ open: get().current }),
  close: () => set({ open: null }),
}))

const seenKey = (id: string) => `solidify.tour.${id}`
const seen = (id: string) => {
  try {
    return localStorage.getItem(seenKey(id)) === '1'
  } catch {
    return true
  }
}
const markSeen = (id: string) => {
  try {
    localStorage.setItem(seenKey(id), '1')
  } catch {
    /* private window: it may show again */
  }
}
/** automated browsers (picture capture, checks) never get a tour unless a check asks for one */
const automated = () => {
  try {
    return navigator.webdriver && localStorage.getItem('solidify.tour.test') !== '1'
  } catch {
    return navigator.webdriver
  }
}

const visible = (name?: string) => {
  if (!name) return null
  for (const el of document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

/**
 * Offer a tour on this page; it opens by itself once, after `ready` turns true and the first step's control is
 * on screen (a 3D page can take seconds).
 */
export function usePageTourOn(id: string, steps: PageTourStep[], ready = true) {
  useEffect(() => {
    usePageTour.getState().set({ id, steps })
    return () => {
      const s = usePageTour.getState()
      if (s.current?.id === id) s.set(null)
      if (s.open?.id === id) s.close()
    }
    // the steps are written inline by each page: the id stands for them
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => {
    if (!ready || seen(id) || automated()) return
    let tries = 0
    const t = window.setInterval(() => {
      tries++
      const first = steps.find((s) => !s.target || visible(s.target))
      // wait for the page to settle; give up quietly after ~12 s
      if ((first && (!first.target || visible(first.target)) && tries > 3) || tries > 40) {
        window.clearInterval(t)
        if (tries <= 40 && usePageTour.getState().current?.id === id && !usePageTour.getState().open) usePageTour.getState().show()
      }
    }, 300)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, ready])
}

/** The tour itself: mounted once, near the root. */
export function PageTourHost() {
  const open = usePageTour((s) => s.open)
  if (!open) return null
  return <TourOverlay key={open.id} id={open.id} steps={open.steps} />
}

function TourOverlay({ id, steps }: { id: string; steps: PageTourStep[] }) {
  const close = () => {
    markSeen(id)
    usePageTour.getState().close()
  }
  // only the steps that can be shown on this screen
  const [shown] = useState(() => steps.filter((s) => !s.target || visible(s.target)))
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const step = shown[i]

  useLayoutEffect(() => {
    if (!step) return
    const el = visible(step.target)
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    const place = () => {
      setSize({ w: window.innerWidth, h: window.innerHeight })
      const e = visible(step.target)
      setRect(e ? e.getBoundingClientRect() : null)
    }
    place()
    const t = window.setInterval(place, 250)
    window.addEventListener('resize', place)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('resize', place)
    }
  }, [step])

  // nothing of it is on this screen: done
  useEffect(() => {
    if (!shown.length) close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setI((n) => Math.min(shown.length - 1, n + 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown.length])

  if (!step) return null
  const last = i === shown.length - 1
  const pad = 6
  const hole = rect ? { x: rect.left - pad, y: rect.top - pad, w: rect.width + pad * 2, h: rect.height + pad * 2 } : null
  // the card goes below the control if there is room, else above, else over the middle
  const cardW = Math.min(340, size.w - 24)
  const cardH = 190
  let left = (size.w - cardW) / 2
  let top = (size.h - cardH) / 2
  if (hole) {
    left = Math.min(Math.max(12, hole.x + hole.w / 2 - cardW / 2), size.w - cardW - 12)
    if (hole.y + hole.h + 12 + cardH < size.h) top = hole.y + hole.h + 12
    else if (hole.y - 12 - cardH > 0) top = hole.y - 12 - cardH
    else top = Math.max(12, size.h - cardH - 12)
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label={`Tour: ${step.title}`}>
      {/* the dimmed page, with a window round the control */}
      {hole ? (
        <div
          className="pointer-events-none absolute rounded-xl ring-2 ring-accent transition-all duration-300"
          style={{ left: hole.x, top: hole.y, width: hole.w, height: hole.h, boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}
      {/* clicks outside the card do nothing but keep the tour (an accidental tap should not end it) */}
      <div className="absolute inset-0" />
      <div className="absolute rounded-2xl border border-line bg-panel p-4 shadow-2xl transition-all duration-300" style={{ left, top, width: cardW }}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-dim">
            {i + 1} of {shown.length}
          </p>
          <button type="button" onClick={close} className="text-[12px] text-mute hover:text-ink">
            Skip tour
          </button>
        </div>
        <h3 className="mt-1.5 text-[15px] font-semibold text-ink">{step.title}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-mute">{step.text}</p>
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex gap-1" aria-hidden>
            {shown.map((_, n) => (
              <span key={n} className={`h-1.5 rounded-full transition-all ${n === i ? 'w-4 bg-accent' : 'w-1.5 bg-line-2'}`} />
            ))}
          </div>
          <div className="flex gap-2">
            {i > 0 ? (
              <button type="button" onClick={() => setI(i - 1)} className="rounded-full border border-line-2 px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:border-ink/40">
                Back
              </button>
            ) : null}
            <button type="button" autoFocus onClick={() => (last ? close() : setI(i + 1))} className="rounded-full bg-accent px-4 py-1.5 text-[12.5px] font-semibold text-accent-ink hover:opacity-90">
              {last ? 'Done' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The header's "?": opens the page's tour again. Nothing when the page has none. */
export function TourHelpButton({ className = '' }: { className?: string }) {
  const has = usePageTour((s) => !!s.current)
  if (!has) return null
  return (
    <button
      type="button"
      onClick={() => usePageTour.getState().show()}
      aria-label="Show me around this page"
      title="Show me around this page"
      className={`grid h-8 w-8 place-items-center rounded-full border border-line-2 bg-[var(--color-scrim)] text-[13px] font-semibold text-mute backdrop-blur-xl hover:text-ink ${className}`}
    >
      ?
    </button>
  )
}
