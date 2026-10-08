/// <reference lib="webworker" />
import { pack } from './serialize'

/**
 * Builds heavy (CSG) scene geometry off the main thread. Each scene folder may have a
 * worker-safe geometry.ts exporting `buildStatic()` (no React, no DOM). Builders are imported
 * lazily so a scene only pays for its own geometry code.
 */
const FILES = import.meta.glob<{ buildStatic: () => unknown }>('/src/modules/*/*/geometry.ts')

/** Builder key "<moduleId>/<folder>" → that scene's geometry.ts `buildStatic`. */
const BUILDERS: Record<string, () => Promise<() => unknown>> = Object.fromEntries(
  Object.entries(FILES).map(([path, load]) => {
    const key = path.replace('/src/modules/', '').replace('/geometry.ts', '')
    return [key, () => load().then((m) => m.buildStatic)]
  }),
)

self.onmessage = async (e: MessageEvent<{ id: number; builder: string }>) => {
  const { id, builder } = e.data
  try {
    const load = BUILDERS[builder]
    if (!load) throw new Error(`Unknown geometry builder "${builder}"`)
    const build = await load()
    const transfers: Transferable[] = []
    const packed = pack(build(), transfers)
    ;(self as unknown as Worker).postMessage({ id, packed }, transfers)
  } catch (err) {
    ;(self as unknown as Worker).postMessage({ id, error: String(err) })
  }
}
