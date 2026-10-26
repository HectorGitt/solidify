import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { MODULES } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { Stage } from './Stage'
import { useGeometryPending } from '@/geometry/build'

/**
 * Dev-only: one scene, full window, no interface, for scripts/capture-tiles.mjs to photograph.
 * Sets window.__shotReady once the scene is built and has had time to settle.
 */
export default function ShotPage() {
  const { moduleId, sceneId } = useParams()
  // ?frame=back,shift photographs the scene as the home hero frames it
  const [query] = useSearchParams()
  const [back, shift] = (query.get('frame') ?? '').split(',').map(Number)
  const frame = query.get('frame') ? { back, shift } : undefined
  const [scene, setScene] = useState<SceneDef | null>(null)

  useEffect(() => {
    const entry = MODULES.find((m) => m.id === moduleId)?.scenes.find((s) => s.id === sceneId)
    const w = window as unknown as { __shotReady?: boolean; __shotError?: string }
    w.__shotReady = false
    w.__shotError = undefined
    if (!entry?.load) {
      w.__shotError = `no scene ${moduleId}/${sceneId}`
      return
    }
    let alive = true
    const t0 = performance.now()
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        if (!alive) return
        const v = useView.getState()
        v.resetView()
        v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
        v.applyPreset(def.defaultPreset ?? (def.cutPresets ?? DEFAULT_CUT_PRESETS)[0].id)
        useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 40, time: 0 })
        def.reset?.()
        ;(window as unknown as { __shotBuiltMs?: number }).__shotBuiltMs = Math.round(performance.now() - t0)
        setScene(def)
      })
      .catch((err) => {
        w.__shotError = String(err)
      })
    return () => {
      alive = false
    }
  }, [moduleId, sceneId])

  const pending = useGeometryPending((s) => s.count)
  useEffect(() => {
    if (!scene || pending > 0) return
    // once the parts are in, let the loader fade and the scene settle
    const t = setTimeout(() => ((window as unknown as { __shotReady?: boolean }).__shotReady = true), 2000)
    return () => clearTimeout(t)
  }, [scene, pending])

  return <div className="relative h-full w-full bg-bg">{scene ? <Stage key={scene.id} scene={scene} smooth={false} pageScroll={!!frame} frame={frame} cover={false} /> : null}</div>
}
