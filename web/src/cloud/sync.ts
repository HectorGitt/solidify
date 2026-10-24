import { create } from 'zustand'
import { useProgress, type ProgressData } from '@/study/progress'
import { api } from './api'
import { useAuth } from './auth'

/**
 * Keeps progress (scenes, exam questions, challenges) in step with the user's cloud copy.
 * The server merges without losing anything, so every sync simply sends this device's copy and
 * takes back the merged result. Signed-out use stays local, as before.
 */

type SyncStatus = 'off' | 'syncing' | 'synced' | 'error'

export const useSync = create<{ status: SyncStatus; last: number | null; error: string | null }>(() => ({ status: 'off', last: null, error: null }))

const snapshot = (): ProgressData => {
  const { scenes, questions, challenges } = useProgress.getState()
  return { scenes, questions, challenges }
}
const same = (a: ProgressData, b: ProgressData) => JSON.stringify(a) === JSON.stringify(b)

let running: Promise<void> | null = null
let again = false

export async function syncNow(): Promise<void> {
  if (useAuth.getState().status !== 'signed-in') return
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      useSync.setState({ status: 'syncing' })
      try {
        const sent = snapshot()
        const res = await api<{ progress: ProgressData }>('/v1/progress/sync', { body: { progress: sent } })
        // Only overwrite if nothing changed locally while the request was in flight.
        if (same(snapshot(), sent) && !same(res.progress, sent)) {
          applying = true
          useProgress.getState().replaceAll(res.progress)
          applying = false
        } else if (!same(snapshot(), sent)) again = true
        useSync.setState({ status: 'synced', last: Date.now(), error: null })
      } catch (e) {
        useSync.setState({ status: 'error', error: (e as Error).message })
      }
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

let applying = false
let started = false
let timer: ReturnType<typeof setTimeout> | undefined

/** Call once at app start. */
export function startSync() {
  if (started) return
  started = true
  useAuth.subscribe((s, prev) => {
    if (s.status === 'signed-in' && prev.status !== 'signed-in') void syncNow()
    if (s.status !== 'signed-in') useSync.setState({ status: 'off', last: null, error: null })
  })
  useProgress.subscribe((s, prev) => {
    if (applying || useAuth.getState().status !== 'signed-in') return
    if (s.scenes === prev.scenes && s.questions === prev.questions && s.challenges === prev.challenges) return
    clearTimeout(timer)
    timer = setTimeout(() => void syncNow(), 2500)
  })
  // Push pending changes when the tab is hidden or closed.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer)
      timer = undefined
      void syncNow()
    }
  })
  if (useAuth.getState().status === 'signed-in') void syncNow()
}
