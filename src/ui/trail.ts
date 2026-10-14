import * as THREE from 'three'
import { create } from 'zustand'
import { getCameraControls } from './camera'

/**
 * Drill-down trail: each "view in detail" jump remembers where it came from — the scene, the
 * camera view and the selected part — so Back returns there exactly.
 */
export interface TrailStop {
  /** scene route "module/scene" */
  route: string
  title: string
  camera?: { position: [number, number, number]; target: [number, number, number] }
  selected?: string | null
  /** the part that was opened from here */
  via?: string
}

/** what to do on arriving at a scene: select a part by name, hand it live context from the scene left */
export interface Arrival {
  route: string
  selectName?: string
  context?: Record<string, number | string>
}

interface TrailState {
  stops: TrailStop[]
  arrival: Arrival | null
  arrive: (a: Arrival | null) => void
  consumeArrival: (route: string) => Arrival | null
  /** a stop waiting to be restored once its scene has loaded */
  restore: TrailStop | null
  push: (s: TrailStop) => void
  /** pop back to stop i (default: the last one) and mark it for restoring */
  back: (i?: number) => TrailStop | null
  clear: () => void
  consumeRestore: (route: string) => TrailStop | null
}

const MAX = 8

export const useTrail = create<TrailState>((set, get) => ({
  stops: [],
  restore: null,
  arrival: null,
  arrive: (a) => set({ arrival: a }),
  consumeArrival: (route) => {
    const a = get().arrival
    if (!a || a.route !== route) return null
    set({ arrival: null })
    return a
  },
  push: (s) => set({ stops: [...get().stops, s].slice(-MAX) }),
  back: (i) => {
    const stops = get().stops
    if (!stops.length) return null
    const k = i ?? stops.length - 1
    const stop = stops[k]
    set({ stops: stops.slice(0, k), restore: stop })
    return stop
  },
  clear: () => set({ stops: [], restore: null }),
  consumeRestore: (route) => {
    const r = get().restore
    if (!r || r.route !== route) return null
    set({ restore: null })
    return r
  },
}))

/** The camera view right now, for a trail stop. */
export function currentCamera(): TrailStop['camera'] {
  const c = getCameraControls()
  if (!c) return undefined
  const p = c.getPosition(new THREE.Vector3())
  const t = c.getTarget(new THREE.Vector3())
  return { position: [p.x, p.y, p.z], target: [t.x, t.y, t.z] }
}

/** Put the camera back where a trail stop left it. */
export function restoreCamera(cam: TrailStop['camera']) {
  const c = getCameraControls()
  if (!c || !cam) return
  void c.setLookAt(...cam.position, ...cam.target, true)
}
