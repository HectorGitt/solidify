import { unpack, type Packed } from './serialize'
import { get, set } from 'idb-keyval'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
const cache = new Map<string, Promise<unknown>>()

/** Cached geometry is keyed to the build, so a new build never shows outdated models. */
declare const __BUILD_ID__: string
const KEY = (builder: string) => `csg_${typeof __BUILD_ID__ === 'string' ? __BUILD_ID__ : 'dev'}_${builder}`

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; packed?: Packed; error?: string }>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.error) p.reject(new Error(e.data.error))
    else p.resolve(e.data.packed!)
  }
  return worker
}

/**
 * Build a scene's static geometry in the worker (once per session). Falls back to building on
 * the main thread if workers are unavailable.
 */
export function buildGeometry<T>(builder: string, fallback: () => T): Promise<T> {
  const hit = cache.get(builder)
  if (hit) return hit as Promise<T>
  let p: Promise<T>
  if (typeof Worker === 'undefined') {
    p = Promise.resolve(fallback())
  } else {
    p = (async () => {
      // in development the build id lasts as long as the server, so a cache would serve stale shapes
      if (!import.meta.env.DEV) {
        try {
          const cached = await get(KEY(builder))
          if (cached) return unpack(cached as Packed) as T
        } catch (e) {
          // ignore IDB errors on read
        }
      }

      return new Promise<Packed>((resolve, reject) => {
        const id = nextId++
        pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
        getWorker().postMessage({ id, builder })
      })
        .then(async (packed) => {
          try {
            if (!import.meta.env.DEV) await set(KEY(builder), packed)
          } catch (e) {
            // ignore IDB errors on write
          }
          return unpack(packed) as T
        })
        .catch((err) => {
          console.warn(`Geometry worker failed for ${builder}; building on the main thread.`, err)
          return fallback()
        })
    })()
  }
  cache.set(builder, p)
  return p
}
