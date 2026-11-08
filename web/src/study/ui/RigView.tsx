import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSim } from '@/core/sim'
import { findModule } from '@/modules/catalog'
import type { SceneDef } from '@/modules/types'
import { DEFAULT_CUT_PRESETS, useView } from '@/render/view'
import { ErrorBoundary } from '@/ui/ErrorBoundary'
import { OrientationGizmo, Stage } from '@/ui/Stage'
import { Toolbar } from '@/ui/Toolbar'

/**
 * A lab rig live in 3D inside another page (a practice problem beside its rig), set to the problem's numbers:
 * loaded and reset the way the rig's own page does, then given `params` (again whenever they change, as with
 * "New numbers"). The full rig, with its panel, is a link away.
 */
export function RigView({ moduleId, sceneId, params, className = '' }: { moduleId: string; sceneId: string; params?: Record<string, unknown>; className?: string }) {
  const mod = findModule(moduleId)
  const entry = mod?.scenes.find((s) => s.id === sceneId)
  const [scene, setScene] = useState<SceneDef | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setScene(null)
    setFailed(false)
    if (!entry?.load) return
    entry
      .load()
      .then(async ({ default: def }) => {
        await def.prepare?.()
        return def
      })
      .then((def) => {
        if (!alive) return
        const v = useView.getState()
        v.resetView()
        v.setPresets(def.cutPresets ?? DEFAULT_CUT_PRESETS)
        v.applyPreset(def.defaultPreset ?? (def.cutPresets ?? DEFAULT_CUT_PRESETS)[0].id)
        if (def.defaultPreset === undefined) v.setCut({ enabled: false })
        useSim.setState({ playing: true, timeScale: def.timeScale ?? 1 / 50, time: 0 })
        def.reset?.()
        setScene(def)
      })
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [entry])

  // the problem's numbers, now and whenever they change
  useEffect(() => {
    if (!scene || !params) return
    try {
      scene.applyParams?.(params)
    } catch {
      /* a rig that cannot take these numbers keeps its own */
    }
  }, [scene, params])

  if (!entry) return null
  return (
    <div className={`relative overflow-hidden rounded-3xl border border-line bg-[var(--color-stage)] ${className}`}>
      {scene ? (
        <ErrorBoundary label="3D model" resetKey={scene.id}>
          {/* further back than on the rig's own page: this view is narrower, and the whole machine should show */}
          <Stage scene={scene} frame={{ back: 1.3, lift: 0 }} loadingLabel="Building the rig" poster={`scenes/${moduleId}--${sceneId}`} />
        </ErrorBoundary>
      ) : (
        <div className="absolute inset-0 grid place-items-center text-[12.5px] text-mute">{failed ? 'This rig could not be loaded.' : 'Building the rig…'}</div>
      )}
      {scene ? (
        <>
          <div className="pointer-events-none absolute right-3 top-3 z-10 hidden sm:block">
            <OrientationGizmo scene={scene} />
          </div>
          {/* on a phone the view is too small for the toolbar; the full rig has it */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-10 hidden justify-center px-2 sm:flex [&>div]:max-w-full">
            <Toolbar scene={scene} />
          </div>
        </>
      ) : null}
      <Link to={`/m/${moduleId}/${sceneId}`} className="absolute left-3 top-3 z-10 rounded-full border border-line bg-panel/90 px-3 py-1.5 text-[12px] font-medium text-ink shadow-sm backdrop-blur hover:border-accent/50">
        {entry.title} · full rig →
      </Link>
    </div>
  )
}
