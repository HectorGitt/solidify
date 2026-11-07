import { create } from 'zustand'
import { toast } from './toast'

/**
 * Work that takes a while (a model being built, notes being read, a test run) runs as a background task:
 * it keeps going while the student uses the rest of the app, shows in the task tray, and says when it is
 * done, with a link back to the result. Tasks live as long as the tab does.
 */
export interface BgTask {
  id: string
  title: string
  /** what it is doing now ("Reading page 3 of 6") */
  detail?: string
  done?: number
  total?: number
  state: 'running' | 'done' | 'failed'
  /** where its result is (or where it was started), as an app path ("/create/abc") */
  href?: string
  startedAt: number
  endedAt?: number
}

export const useTasks = create<{ tasks: BgTask[] }>(() => ({ tasks: [] }))

const patch = (id: string, p: Partial<BgTask>) => useTasks.setState((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }))

export const goTo = (href: string) => {
  window.location.hash = href.startsWith('#') ? href : `#${href}`
}

export interface TaskHandle {
  id: string
  /** progress: what it is doing, and how far through (done of total) */
  update: (detail?: string, done?: number, total?: number) => void
  /** finished: where the result is, and what to tell the student (a toast with Open) */
  finish: (opts?: { href?: string; message?: string }) => void
  fail: (message: string) => void
}

export function startTask(title: string, href?: string): TaskHandle {
  const id = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
  useTasks.setState((s) => ({ tasks: [{ id, title, href, state: 'running' as const, startedAt: Date.now() }, ...s.tasks].slice(0, 12) }))
  return {
    id,
    update: (detail, done, total) => patch(id, { detail, done, total }),
    finish: ({ href: to, message } = {}) => {
      const target = to ?? useTasks.getState().tasks.find((t) => t.id === id)?.href
      patch(id, { state: 'done', endedAt: Date.now(), detail: undefined, ...(to ? { href: to } : {}) })
      // no toast when the student is already looking at the result
      const here = window.location.hash.replace(/^#/, '') || '/'
      if (target && here === target) return
      toast(message ?? `${title} is ready.`, target ? { tone: 'ok', action: { label: 'Open', run: () => goTo(target) } } : { tone: 'ok' })
    },
    fail: (message) => {
      patch(id, { state: 'failed', endedAt: Date.now(), detail: message })
      toast(`${title}: ${message}`, { tone: 'warn' })
    },
  }
}

export const dismissTask = (id: string) => useTasks.setState((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }))
export const clearFinished = () => useTasks.setState((s) => ({ tasks: s.tasks.filter((t) => t.state === 'running') }))
