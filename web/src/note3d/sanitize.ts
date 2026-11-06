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
      recommendedCut:
        candidate.recommendedCut && typeof candidate.recommendedCut === 'object'
          ? (candidate.recommendedCut as NoteSceneSpec['recommendedCut'])
          : { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: Array.isArray(candidate.parameters) ? (candidate.parameters as NoteParameterSpec[]) : [],
      calculations: Array.isArray(candidate.calculations)
        ? (candidate.calculations as NoteCalculationSpec[])
        : [],
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
