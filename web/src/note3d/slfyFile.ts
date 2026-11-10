import type { NoteSceneSpec } from './schema'
import { SLFY_EXTENSION, SLFY_MIME, toSlfy } from './slfyFormat'

/** a file name from a model's title: "Worm reducer 30:1" → "worm-reducer-30-1.slfy" */
export function slfyFileName(title: string) {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'model'}${SLFY_EXTENSION}`
}

/**
 * Saves a model as a .slfy file at the sizes on screen: each parameter's value is the slider's current one,
 * so the file opens as the student left it.
 */
export function downloadSlfy(spec: NoteSceneSpec, values?: Record<string, number>) {
  const atNow: NoteSceneSpec = {
    ...spec,
    parameters: (spec.parameters ?? []).map((p) => {
      const v = values?.[p.id]
      return typeof v === 'number' && Number.isFinite(v) ? { ...p, value: Math.min(p.max, Math.max(p.min, v)) } : p
    }),
  }
  const file = toSlfy(atNow, { generator: 'Solidify (solidify.studio)', created: new Date().toISOString().slice(0, 10) })
  const url = URL.createObjectURL(new Blob([JSON.stringify(file, null, 2)], { type: SLFY_MIME }))
  const a = Object.assign(document.createElement('a'), { href: url, download: slfyFileName(spec.title) })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
