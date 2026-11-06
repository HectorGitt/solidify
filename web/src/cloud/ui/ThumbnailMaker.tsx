import { useEffect, useMemo, useRef } from 'react'
import { useGeometryPending } from '@/geometry/build'
import { useLiveSceneDef } from '@/note3d/NoteSceneRenderer'
import { sanitizeGeneratedSpec } from '@/note3d/sanitize'
import type { NoteSceneSpec } from '@/note3d/schema'
import { requestSnapshot } from '@/render/snapshot'
import { Stage } from '@/ui/Stage'

/**
 * Draws a model off screen, once it has finished building takes its picture, and hands it back (null if it
 * would not draw in time). For cards of models that were never opened in the workspace: drafts from the
 * nightly run, library models. Mount one at a time: it uses the page's one 3D view.
 */
export function ThumbnailMaker({ spec, prompt, onDone }: { spec: Record<string, unknown>; prompt: string; onDone: (url: string | null) => void }) {
  const clean = useMemo(() => sanitizeGeneratedSpec({ spec }, prompt) ?? (spec as unknown as NoteSceneSpec), [spec, prompt])
  const params = useMemo(() => Object.fromEntries((clean.parameters ?? []).map((p) => [p.id, p.value])), [clean])
  const scene = useLiveSceneDef(clean, params)
  const pending = useGeometryPending((s) => s.count)
  const doneRef = useRef(false)
  const finish = (url: string | null) => {
    if (doneRef.current) return
    doneRef.current = true
    onDone(url)
  }

  // give up after 25 s: a model that will not draw keeps its placeholder
  useEffect(() => {
    const t = window.setTimeout(() => finish(null), 25_000)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // once every part is built, let it settle, then take the picture
  useEffect(() => {
    if (!scene || pending > 0) return
    const t = window.setTimeout(() => void requestSnapshot({ width: 480, timeoutMs: 5000 }).then(finish), 1800)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, pending])

  if (!scene) return null
  return (
    <div aria-hidden className="pointer-events-none fixed left-[-10000px] top-0 h-[400px] w-[640px]">
      <Stage scene={scene} cover={false} smooth={false} />
    </div>
  )
}
