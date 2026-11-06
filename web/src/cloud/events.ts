import { api } from './api'
import { useAuth } from './auth'

export type EventKind = 'rating-up' | 'rating-down' | 'fix-layout' | 'layout-issue' | 'rebuild' | 'delete'

/**
 * Tells the team what happened to a model (a thumbs up or down, a layout flagged or fixed), counted without
 * names, so the nightly work goes where students struggle. Only when signed in; never gets in the way.
 */
export function logEvent(kind: EventKind, subject?: string, detail?: string) {
  if (useAuth.getState().status !== 'signed-in') return
  api('/v1/events', { method: 'POST', body: { kind, subject: subject?.slice(0, 120), detail: detail?.slice(0, 300) } }).catch(() => {
    /* best effort */
  })
}
