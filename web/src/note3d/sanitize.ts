import {
  ALLOWED_MATERIALS,
  noteAnnotationSchema,
  noteChartSchema,
  noteMountSchema,
  noteSceneSpecSchema,
  noteShapeSchema,
  type NoteCalculationSpec,
  type NoteParameterSpec,
  type NotePartSpec,
  type NoteSceneSpec,
} from './schema'

/**
 * Gemini's answer turned into a model Solidify can draw: missing fields filled, unknown shapes and parts
 * with nothing to draw dropped, bad relations, charts and arrows left out one by one. No app or network
 * code, so the nightly test run can use it as it is.
 */
/** a section plane as Gemini wrote it, or the default (cut through Z) if any part of it is missing or not a number */
export function cleanCut(raw: unknown): NonNullable<NoteSceneSpec['recommendedCut']> {
  const fallback = { enabled: true, normal: [0, 0, 1] as [number, number, number], pos: 0 }
  if (!raw || typeof raw !== 'object') return fallback
  const c = raw as { enabled?: unknown; normal?: unknown; pos?: unknown }
  const n = Array.isArray(c.normal) && c.normal.length === 3 && c.normal.every((v) => typeof v === 'number' && Number.isFinite(v)) ? (c.normal as [number, number, number]) : null
  if (!n || Math.hypot(...n) < 1e-6) return { ...fallback, enabled: c.enabled !== false }
  return { enabled: c.enabled !== false, normal: n, pos: typeof c.pos === 'number' && Number.isFinite(c.pos) ? c.pos : 0 }
}

/**
 * A part's motion as the renderer reads it: kind rotate / oscillate / translate, axis x / y / z. The model
 * sometimes gives the axis as a vector ([0, 1, 0]) or a signed letter ("-z"): that becomes its main letter.
 * Anything else unusable drops the motion (the part then moves only by its mount, or not at all).
 */
export function cleanMotion(m: unknown): NotePartSpec['motion'] {
  if (!m || typeof m !== 'object') return undefined
  const o = m as Record<string, unknown>
  if (o.kind !== 'rotate' && o.kind !== 'oscillate' && o.kind !== 'translate') return undefined
  let axis: 'x' | 'y' | 'z' | undefined
  if (Array.isArray(o.axis) && o.axis.length === 3 && o.axis.every((v) => typeof v === 'number' && Number.isFinite(v))) {
    const a = (o.axis as number[]).map(Math.abs)
    if (Math.max(...a) > 0) axis = (['x', 'y', 'z'] as const)[a.indexOf(Math.max(...a))]
  } else if (typeof o.axis === 'string') {
    const l = o.axis.trim().toLowerCase().replace(/^[+-]/, '')
    if (l === 'x' || l === 'y' || l === 'z') axis = l
  }
  const speed = typeof o.speed === 'number' || typeof o.speed === 'string' ? o.speed : 1
  const out: NonNullable<NotePartSpec['motion']> = { kind: o.kind, axis: axis ?? 'y', speed }
  if (typeof o.amplitude === 'number' || typeof o.amplitude === 'string') out.amplitude = o.amplitude
  if (typeof o.phase === 'number' && Number.isFinite(o.phase)) out.phase = o.phase
  return out
}

/** a pasted problem: its text and what it asks for, as plain strings of sane length; anything else is dropped */
export function cleanQuestion(q: unknown): NoteSceneSpec['question'] {
  if (!q || typeof q !== 'object') return undefined
  const o = q as Record<string, unknown>
  const text = typeof o.text === 'string' ? o.text.trim().slice(0, 4000) : ''
  if (!text) return undefined
  const find = (Array.isArray(o.find) ? o.find : [])
    .filter((f): f is string => typeof f === 'string' && !!f.trim())
    .map((f) => f.trim().slice(0, 300))
    .slice(0, 8)
  return { text, find, ...(o.symbolic === true ? { symbolic: true } : {}) }
}

/** a calculation's worked-solution fields: the step as a short string, answer only when truly set */
const cleanStep = (c: NoteCalculationSpec): NoteCalculationSpec => {
  if (!c || typeof c !== 'object') return c
  const out = { ...c }
  if (typeof out.step === 'string' && out.step.trim()) out.step = out.step.trim().slice(0, 400)
  else delete out.step
  if (out.answer === true) out.answer = true
  else delete out.answer
  return out
}

export function sanitizeGeneratedSpec(raw: Record<string, unknown>, fallbackTitle: string): NoteSceneSpec | null {
  try {
    const candidate = (raw.spec ?? raw) as Record<string, unknown>
    if (!candidate || typeof candidate !== 'object') return null
    if (!Array.isArray(candidate.parts) || candidate.parts.length === 0) return null

    const spec: NoteSceneSpec = {
      id: `${String(candidate.id || 'create-ai-model').replace(/-rev\d+$/, '')}-rev${Date.now() % 100000}`,
      title: String(candidate.title || fallbackTitle),
      summary: String(candidate.summary || `Parametric 3D model of ${fallbackTitle}`),
      units: candidate.units === 'm' ? 'm' : 'mm',
      extent: typeof candidate.extent === 'number' && candidate.extent > 0.05 ? candidate.extent : 0.5,
      floorY: typeof candidate.floorY === 'number' ? candidate.floorY : -0.2,
      camera:
        candidate.camera && typeof candidate.camera === 'object'
          ? (candidate.camera as NoteSceneSpec['camera'])
          : { position: [0.52, 0.38, 0.58], target: [0, 0, 0] },
      recommendedCut: cleanCut(candidate.recommendedCut),
      parameters: Array.isArray(candidate.parameters) ? (candidate.parameters as NoteParameterSpec[]) : [],
      calculations: Array.isArray(candidate.calculations) ? (candidate.calculations as NoteCalculationSpec[]).map(cleanStep) : [],
      question: cleanQuestion(candidate.question),
      parts: candidate.parts as NotePartSpec[],
      // loads, reactions and dimensions drawn as arrows; each checked on its own
      annotations: (Array.isArray(candidate.annotations) ? candidate.annotations : [])
        .map((a) => noteAnnotationSchema.safeParse(a))
        .filter((r) => r.success)
        .map((r) => r.data)
        // an arrow needs a part to attach to or a place of its own
        .filter((a) => a.anchor || a.from)
        .slice(0, 16),
      // graphs: each one checked on its own, so a bad chart never costs the model
      charts: (Array.isArray(candidate.charts) ? candidate.charts : [])
        .map((c) => noteChartSchema.safeParse(c))
        .filter((r) => r.success)
        .map((r) => r.data)
        .slice(0, 6),
    }

    // keep only shapes the builder can make, and only parts that still have a shape (children included)
    const kinds = new Set<string>(noteShapeSchema.shape.kind.options)
    const usable = (list: unknown): NotePartSpec[] =>
      (Array.isArray(list) ? list : [])
        .filter((pt): pt is NotePartSpec => !!pt && typeof pt === 'object')
        .map((pt) => ({
          ...pt,
          shapes: (Array.isArray(pt.shapes) ? pt.shapes : []).filter((sh) => !!sh && kinds.has((sh as { kind?: string }).kind ?? '')),
          children: pt.children ? usable(pt.children) : undefined,
          // a relation that is not well formed is dropped; the part falls back to its position
          mount: pt.mount && noteMountSchema.safeParse(pt.mount).success ? pt.mount : undefined,
          motion: cleanMotion(pt.motion),
        }))
        .filter((pt) => pt.shapes.length > 0 || (pt.children?.length ?? 0) > 0)
    spec.parts = usable(spec.parts)
    if (!spec.parts.length) return null

    const validMatSet = new Set<string>(ALLOWED_MATERIALS)
    for (const pt of spec.parts) {
      if (!pt.material || !validMatSet.has(pt.material)) {
        pt.material = pt.role === 'housing' ? 'castIron' : 'steel'
      }
      if (!pt.role || !['housing', 'moving', 'fluid', 'static'].includes(pt.role)) {
        pt.role = pt.motion ? 'moving' : 'static'
      }
      if (!Array.isArray(pt.explode) || pt.explode.length !== 3) {
        pt.explode = pt.role === 'housing' ? [0, 0.14, 0] : [0, 0, 0.1]
      }
    }

    const parsed = noteSceneSpecSchema.safeParse(spec)
    if (parsed.success) {
      return parsed.data
    }
    return spec
  } catch {
    return null
  }
}
