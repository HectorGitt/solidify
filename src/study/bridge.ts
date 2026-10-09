import type { SceneDef } from '@/modules/types'
import { useProgress } from './progress'

/**
 * Hand-off between the study pages and the 3D viewer. A question queues its data here,
 * navigates to the scene, and the Viewer applies it once the scene has loaded.
 */
let pending: { sceneId: string; params: Record<string, unknown> } | null = null

export function queueParams(sceneId: string, params: Record<string, unknown> | undefined) {
  pending = params ? { sceneId, params } : null
}

/** Called by the Viewer after a scene has loaded and reset. */
export function onSceneReady(sceneId: string, def: SceneDef) {
  useProgress.getState().markOpened(sceneId)
  if (pending && pending.sceneId === sceneId) {
    const { params } = pending
    pending = null
    try {
      def.applyParams?.(params)
    } catch {
      /* a scene that cannot take these params simply keeps its defaults */
    }
  }
}

/** Called by the TourPlayer when the last step is finished. */
export function onTourFinished(sceneId: string) {
  useProgress.getState().markTour(sceneId)
}
