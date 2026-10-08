import { unpack, type Packed } from './serialize'

let worker: Worker | null = null
let nextId = 1
const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
const cache = new Map<string, Promise<unknown>>()

function getWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./geometry.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (e: MessageEvent<{ id: number; packed?: Packed; error?: string }>) => {
    const p = pending.get(e.data.id)
    if (!p) return
    pending.delete(e.data.id)
    if (e.data.error) p.reject(new Error(e.data.error))
    else p.resolve(unpack(e.data.packed!))
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
    p = new Promise<T>((resolve, reject) => {
      const id = nextId++
      pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
      getWorker().postMessage({ id, builder })
    }).catch((err) => {
      console.warn(`Geometry worker failed for ${builder}; building on the main thread.`, err)
      return fallback()
    })
  }
  cache.set(builder, p)
  return p
}
