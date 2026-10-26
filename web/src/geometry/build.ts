import { unpack, type Packed } from './serialize'
import { get, set } from 'idb-keyval'
import { create } from 'zustand'

/**
 * Heavy (CSG) geometry is built off the main thread on a small pool of workers, so the parts of one
 * model (or several models) can be built at the same time. Requests queue by priority: anything a
 * scene is waiting for goes ahead of background pre-builds.
 */

type Priority = 'normal' | 'low'
interface Task {
  id: number
  builder: string
  args: unknown
  priority: Priority
  resolve: (p: Packed) => void
  reject: (e: Error) => void
}

/** leave a core for the page; more than four workers buys little and costs memory */
const POOL = typeof navigator !== 'undefined' ? Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1)) : 1
const workers: { w: Worker; busy: Task | null }[] = []
const queue: Task[] = []
let nextId = 1
const cache = new Map<string, Promise<unknown>>()
/** queued (not yet started) task per cache key, so a later normal request can promote it */
const queuedByKey = new Map<string, Task>()

/**
 * How many builds a scene is waiting on (normal priority, not yet finished). The stage keeps its
 * loader up until this reaches zero, so a scene never shows an empty canvas while parts arrive.
 */
export const useGeometryPending = create<{ count: number }>(() => ({ count: 0 }))
const settled = new WeakSet<Promise<unknown>>()
const waiting = new WeakSet<Promise<unknown>>()
function track(p: Promise<unknown>) {
  if (settled.has(p) || waiting.has(p)) return
  waiting.add(p)
  useGeometryPending.setState((s) => ({ count: s.count + 1 }))
  const done = () => useGeometryPending.setState((s) => ({ count: s.count - 1 }))
  p.then(done, done)
}

/** Cached geometry is keyed to the build, so a new build never shows outdated models. */
declare const __BUILD_ID__: string
const KEY = (builder: string) => `csg_${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}_${builder}`

function spawn() {
  const slot = { w: new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' }), busy: null as Task | null }
  slot.w.onmessage = (e: MessageEvent<{ id: number; packed?: Packed; error?: string }>) => {
    const t = slot.busy
    slot.busy = null
    if (t && t.id === e.data.id) {
      if (e.data.error) t.reject(new Error(e.data.error))
      else t.resolve(e.data.packed!)
    }
    pump()
  }
  workers.push(slot)
  return slot
}

/** Hand queued tasks to idle workers, normal priority first. */
function pump() {
  while (queue.length) {
    let slot = workers.find((s) => !s.busy)
    if (!slot && workers.length < POOL) slot = spawn()
    if (!slot) return
    let i = queue.findIndex((t) => t.priority === 'normal')
    if (i < 0) {
      // background work never takes the last free worker, so a scene's own request starts at once
      const lowBusy = workers.filter((w) => w.busy?.priority === 'low').length
      if (POOL > 1 && lowBusy >= POOL - 1) return
      i = 0
    }
    const [t] = queue.splice(i, 1)
    for (const [k, q] of queuedByKey) if (q === t) queuedByKey.delete(k)
    slot.busy = t
    slot.w.postMessage({ id: t.id, builder: t.builder, args: t.args })
  }
}

function run(key: string, builder: string, args: unknown, priority: Priority) {
  return new Promise<Packed>((resolve, reject) => {
    const t: Task = { id: nextId++, builder, args, priority, resolve, reject }
    queue.push(t)
    queuedByKey.set(key, t)
    pump()
  })
}

/**
 * Build a scene's static geometry in a worker (once per session). Falls back to building on the
 * main thread if workers are unavailable. `args` (JSON-safe) are passed to the builder, and each
 * distinct set of args is built and cached separately. `priority: 'low'` queues a background
 * pre-build behind anything a scene asks for; asking again at normal priority promotes it.
 */
export function buildGeometry<T>(builder: string, fallback: () => T, args?: unknown, priority: Priority = 'normal'): Promise<T> {
  const key = args === undefined ? builder : `${builder}:${JSON.stringify(args)}`
  const hit = cache.get(key)
  if (hit) {
    const q = queuedByKey.get(key)
    if (q && priority === 'normal' && q.priority === 'low') {
      // promoted: it may start now on a worker that background work was leaving free
      q.priority = 'normal'
      pump()
    }
    if (priority === 'normal') track(hit)
    return hit as Promise<T>
  }
  let p: Promise<T>
  if (typeof Worker === 'undefined') {
    p = Promise.resolve(fallback())
  } else {
    p = (async () => {
      // in development the build id lasts as long as the server, so a cache would serve stale shapes
      if (!import.meta.env.DEV) {
        try {
          const cached = await get(KEY(key))
          if (cached) return unpack(cached as Packed) as T
        } catch (e) {
          // ignore IDB errors on read
        }
      }

      return run(key, builder, args, priority)
        .then(async (packed) => {
          try {
            if (!import.meta.env.DEV) await set(KEY(key), packed)
          } catch (e) {
            // ignore IDB errors on write
          }
          return unpack(packed) as T
        })
        .catch((err) => {
          console.warn(`Geometry worker failed for ${key}; building on the main thread.`, err)
          return fallback()
        })
    })()
  }
  cache.set(key, p)
  const mark = () => settled.add(p)
  p.then(mark, mark)
  if (priority === 'normal') track(p)
  return p
}
