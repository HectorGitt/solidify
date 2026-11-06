import { create } from 'zustand'
import { useSim } from '@/core/sim'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'

/**
 * The home page has two live 3D views (the hero and the rig of the day) but the app's view, camera and
 * clock are shared, so only one runs at a time: whichever owns the stage. The rig of the day takes it while
 * it is on screen and hands it back to the hero when it scrolls away.
 */
export const useHomeStage = create<{ owner: 'hero' | 'rigday'; set: (owner: 'hero' | 'rigday') => void }>((set) => ({
  owner: 'hero',
  set: (owner) => set({ owner }),
}))

/** puts the shared view and clock in the state a scene opens with (its cut, no explode, running) */
export function applySceneView(def: SceneDef) {
  const v = useView.getState()
  v.resetView()
  v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
  v.applyPreset(def.defaultPreset ?? (def.cutPresets ?? DEFAULT_CUT_PRESETS)[0].id)
  if (def.defaultPreset === undefined) v.setCut({ enabled: false })
  useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 40, time: 0 })
  def.reset?.()
}
