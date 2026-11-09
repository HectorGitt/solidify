/**
 * Reading a model while Gemini is still writing it. The answer is JSON in a fixed order (title, sizes,
 * calculations, then parts), so as each item in those lists is closed it can be shown: sliders as the sizes
 * are chosen, formulas as the engineering is worked out, and parts in the 3D view one by one.
 */

/** the complete objects so far in the first array under `key` (items still being written are left out) */
export function completedItems<T = Record<string, unknown>>(text: string, key: string): T[] {
  const m = new RegExp(`"${key}"\\s*:\\s*\\[`).exec(text)
  if (!m) return []
  const out: T[] = []
  let depth = 0
  let start = -1
  let inString = false
  let escaped = false
  for (let i = m.index + m[0].length; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{' || ch === '[') {
      if (depth === 0 && ch === '{') start = i
      depth++
    } else if (ch === '}' || ch === ']') {
      if (depth === 0) break // the list itself has closed
      depth--
      if (depth === 0 && ch === '}' && start >= 0) {
        try {
          out.push(JSON.parse(text.slice(start, i + 1)) as T)
        } catch {
          /* not valid JSON on its own; skip it */
        }
        start = -1
      }
    }
  }
  return out
}

/** the first complete string value under `key`, if it has been written yet */
export function completedString(text: string, key: string): string | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(text)
  if (!m) return undefined
  try {
    return JSON.parse(`"${m[1]}"`) as string
  } catch {
    return undefined
  }
}

/** a complete number value under `key` */
function completedNumber(text: string, key: string): number | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)\\s*[,}]`).exec(text)
  return m ? Number(m[1]) : undefined
}

/** a complete small object under `key` (camera, recommendedCut) */
function completedObject(text: string, key: string): Record<string, unknown> | undefined {
  const m = new RegExp(`"${key}"\\s*:\\s*\\{`).exec(text)
  if (!m) return undefined
  let depth = 0
  for (let i = m.index + m[0].length - 1; i < text.length; i++) {
    if (text[i] === '{') depth++
    else if (text[i] === '}' && --depth === 0) {
      try {
        return JSON.parse(text.slice(m.index + m[0].length - 1, i + 1)) as Record<string, unknown>
      } catch {
        return undefined
      }
    }
  }
  return undefined
}

export interface LiveProgress {
  /** how much of the answer has arrived, in characters */
  chars: number
  explanation?: string
  isQuestion: boolean
  title?: string
  parameters: { id: string; label?: string; value?: number; unit?: string }[]
  calculations: { id: string; label?: string; latex?: string }[]
  parts: Record<string, unknown>[]
  /** what has arrived, shaped like a spec, for a preview (no parts until the first one closes) */
  draft: Record<string, unknown>
}

export function readProgress(text: string): LiveProgress {
  const parameters = completedItems<LiveProgress['parameters'][number]>(text, 'parameters')
  const calculations = completedItems<LiveProgress['calculations'][number]>(text, 'calculations')
  const parts = completedItems(text, 'parts')
  const title = completedString(text, 'title')
  return {
    chars: text.length,
    explanation: completedString(text, 'explanation'),
    // a question about the model, or a written answer with nothing to build
    isQuestion: /"(?:isQuestion|answerOnly)"\s*:\s*true/.test(text),
    title,
    parameters,
    calculations,
    parts,
    draft: {
      title: title ?? 'Building…',
      extent: completedNumber(text, 'extent'),
      floorY: completedNumber(text, 'floorY'),
      camera: completedObject(text, 'camera'),
      recommendedCut: completedObject(text, 'recommendedCut'),
      parameters,
      calculations,
      charts: completedItems(text, 'charts'),
      annotations: completedItems(text, 'annotations'),
      parts,
    },
  }
}
