import type { NavigateFunction } from 'react-router-dom'
import { create } from 'zustand'
import { sceneTitle } from '@/content/drilldown'
import type { SceneDef } from '@/modules/types'
import { focusPart } from './camera'
import { currentCamera, useTrail } from './trail'

/**
 * One way to move between scenes from inside a scene (drill-down, "seen in", search): remember
 * the way back, say what to select on arrival, carry the live context, and dive in with a fade.
 */

/** the scene currently on screen (set by the Viewer once it has loaded) */
export const active: { scene: SceneDef | null; route: string } = { scene: null, route: '' }

/** 0 = clear, 1 = faded out (the dive-in transition) */
export const useFade = create<{ fade: number; set: (f: number) => void }>((set) => ({ fade: 0, set: (fade) => set({ fade }) }))

export interface GoOptions {
  /** select this part (by name) in the scene you arrive at */
  selectName?: string
  /** the part you are diving into: the camera flies to it first */
  fromPartId?: string
  /** its name, for the breadcrumbs */
  fromPartName?: string
  /** hand the live values of this scene to the next (drill-down) */
  carryContext?: boolean
}

export function goTo(navigate: NavigateFunction, route: string, o: GoOptions = {}) {
  const here = active.route
  const trail = useTrail.getState()
  if (here && here !== route) {
    trail.push({ route: here, title: sceneTitle(here) ?? 'Back', camera: currentCamera(), selected: o.fromPartId ?? null, via: o.fromPartName })
  }
  let context: Record<string, number | string> | undefined
  if (o.carryContext && active.scene?.context) {
    try {
      context = active.scene.context() as Record<string, number | string>
    } catch {
      context = undefined
    }
  }
  trail.arrive({ route, selectName: o.selectName, context })
  if (o.fromPartId) {
    // dive in: fly to the part, fade, then change scene
    focusPart(o.fromPartId)
    window.setTimeout(() => useFade.getState().set(1), 380)
    window.setTimeout(() => navigate(`/m/${route}`), 640)
  } else {
    useFade.getState().set(1)
    window.setTimeout(() => navigate(`/m/${route}`), 220)
  }
}
