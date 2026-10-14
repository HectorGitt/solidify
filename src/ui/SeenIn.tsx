import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { detailLinks, sceneTitle } from '@/content/drilldown'
import { goTo } from './navigate'

type Index = Record<string, string[]>
let indexPromise: Promise<Index> | null = null
/** the part index, loaded on first use (kept out of the main bundle) */
export function loadPartIndex() {
  return (indexPromise ??= import('@/content/partIndex.json').then((m) => m.default as Index))
}

export interface SeenHit {
  route: string
  title: string
  part: string
}

/** Scenes whose parts drill down to `route` — where this scene's subject also appears. */
export function seenIn(index: Index, route: string, max = 6): SeenHit[] {
  const out: SeenHit[] = []
  for (const [other, names] of Object.entries(index)) {
    if (other === route) continue
    const name = names.find((n) => detailLinks({ id: '', name: n }, other).some((l) => l.route === route))
    const title = name ? sceneTitle(other) : null
    if (name && title) out.push({ route: other, title, part: name })
    if (out.length >= max) break
  }
  return out
}

/** "Seen in" chips for the scene info panel. */
export function SeenIn({ route }: { route: string }) {
  const [hits, setHits] = useState<SeenHit[]>([])
  const navigate = useNavigate()
  useEffect(() => {
    let alive = true
    loadPartIndex().then((idx) => alive && setHits(seenIn(idx, route)))
    return () => {
      alive = false
    }
  }, [route])
  if (!hits.length) return null
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1 text-[11.5px]">
      <span className="text-dim">Seen in</span>
      {hits.map((h) => (
        <button
          key={h.route}
          onClick={() => goTo(navigate, h.route, { selectName: h.part })}
          title={`Open ${h.title} with the ${h.part.toLowerCase()} selected`}
          className="rounded-full border border-line-2 px-2 py-0.5 text-ink/85 hover:border-accent/50 hover:text-accent"
        >
          {h.title} <span className="text-dim">· {h.part}</span>
        </button>
      ))}
    </div>
  )
}
