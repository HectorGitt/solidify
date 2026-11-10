import { z } from 'zod'
import {
  noteAnnotationSchema,
  noteCalculationSchema,
  noteChartSchema,
  noteParameterSchema,
  notePartSchema,
  type NoteSceneSpec,
} from './schema'

/**
 * The open model file (.slfy, application/vnd.solidify+json): a model as Solidify draws, moves and works it
 * out, in a form other tools can read and write. The spec lives in format/SPEC.md; this is its reference
 * reading and writing. A file is { format, version, model, view?, meta?, extensions? }: `model` is what the
 * model is (parameters, parts, annotations, calculations, charts, question), `view` only how it is first
 * shown (camera, floor, cut), so a viewer may ignore it.
 */

export const SLFY_FORMAT = 'slfy'
export const SLFY_VERSION = '0.1'
export const SLFY_MIME = 'application/vnd.solidify+json'
export const SLFY_EXTENSION = '.slfy'

const vec3 = z.tuple([z.number(), z.number(), z.number()])

export const slfyModelSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  summary: z.string().max(1000),
  units: z.enum(['mm', 'm']).describe('the unit sliders show sizes in; geometry is always in metres'),
  question: z
    .object({ text: z.string().min(1).max(4000), find: z.array(z.string().max(300)).max(8), symbolic: z.boolean().optional() })
    .optional()
    .describe('a problem being solved: its givens are the parameters, its worked solution the calculations, in order'),
  parameters: z.array(noteParameterSchema).max(20),
  parts: z.array(notePartSchema).min(1).max(32),
  annotations: z.array(noteAnnotationSchema).max(24).optional(),
  calculations: z.array(noteCalculationSchema).max(20).optional(),
  charts: z.array(noteChartSchema).max(6).optional(),
})

export const slfyViewSchema = z.object({
  camera: z.object({ position: vec3, target: vec3 }).optional(),
  extent: z.number().positive().optional().describe('the size of the scene in metres, for framing and the floor grid'),
  floorY: z.number().optional().describe('height of the floor, metres'),
  cut: z.object({ enabled: z.boolean(), normal: vec3, pos: z.number() }).optional().describe('the cut-away the model opens with'),
  projectionPlanes: z.enum(['none', 'first-angle', 'third-angle']).optional(),
})

export const slfyFileSchema = z.object({
  $schema: z.string().optional(),
  format: z.literal(SLFY_FORMAT),
  version: z.string().regex(/^\d+\.\d+$/),
  model: slfyModelSchema,
  view: slfyViewSchema.optional(),
  meta: z
    .object({
      generator: z.string().max(120).optional(),
      created: z.string().max(40).optional(),
      license: z.string().max(80).optional(),
      source: z.string().max(400).optional(),
    })
    .optional(),
  extensions: z.record(z.string(), z.unknown()).optional().describe('namespaced additions ("vendor.feature"); readers ignore what they do not know'),
})

export type SlfyFile = z.infer<typeof slfyFileSchema>

/** a model as a .slfy file */
export function toSlfy(spec: NoteSceneSpec, meta?: SlfyFile['meta']): SlfyFile {
  const model: Record<string, unknown> = {
    id: spec.id.replace(/-rev\d+$/, ''),
    title: spec.title,
    summary: spec.summary,
    units: spec.units,
    ...(spec.question ? { question: spec.question } : {}),
    parameters: spec.parameters ?? [],
    parts: spec.parts,
    ...(spec.annotations?.length ? { annotations: spec.annotations } : {}),
    ...(spec.calculations?.length ? { calculations: spec.calculations } : {}),
    ...(spec.charts?.length ? { charts: spec.charts } : {}),
  }
  const view: Record<string, unknown> = {
    ...(spec.camera ? { camera: spec.camera } : {}),
    ...(spec.extent !== undefined ? { extent: spec.extent } : {}),
    ...(spec.floorY !== undefined ? { floorY: spec.floorY } : {}),
    ...(spec.recommendedCut ? { cut: spec.recommendedCut } : {}),
    ...(spec.showProjectionPlanes ? { projectionPlanes: spec.showProjectionPlanes } : {}),
  }
  return {
    format: SLFY_FORMAT,
    version: SLFY_VERSION,
    model: model as SlfyFile['model'],
    ...(Object.keys(view).length ? { view: view as SlfyFile['view'] } : {}),
    ...(meta ? { meta } : {}),
  }
}

export type SlfyRead =
  | { ok: true; spec: Record<string, unknown>; title: string; version: string | null; warnings: string[] }
  | { ok: false; error: string }

/**
 * A file's contents as a model spec for the app (still to be cleaned by sanitizeGeneratedSpec, as anything
 * from outside is). Reads a .slfy file, and also a bare spec or an admin export ({ spec, ... }) so older
 * downloads open too. Never throws.
 */
export function fromSlfy(raw: unknown): SlfyRead {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ok: false, error: 'This file is not a model: it holds no object.' }
  const o = raw as Record<string, unknown>
  const warnings: string[] = []
  if (o.format === SLFY_FORMAT) {
    const version = typeof o.version === 'string' ? o.version : null
    if (!version) warnings.push('The file does not say which version of the format it uses.')
    else if (Number(version.split('.')[0]) > Number(SLFY_VERSION.split('.')[0])) warnings.push(`The file is version ${version}; this app reads ${SLFY_VERSION}, so newer parts of it may not show.`)
    const model = o.model
    if (!model || typeof model !== 'object' || Array.isArray(model)) return { ok: false, error: 'The file has no model in it.' }
    const m = model as Record<string, unknown>
    if (!Array.isArray(m.parts) || !m.parts.length) return { ok: false, error: 'The model has no parts to draw.' }
    const v = (o.view && typeof o.view === 'object' ? o.view : {}) as Record<string, unknown>
    if (o.extensions && typeof o.extensions === 'object' && Object.keys(o.extensions).length) warnings.push(`Extensions this app doesn't use were skipped: ${Object.keys(o.extensions).slice(0, 4).join(', ')}.`)
    const spec: Record<string, unknown> = {
      ...m,
      ...(v.camera !== undefined ? { camera: v.camera } : {}),
      ...(v.extent !== undefined ? { extent: v.extent } : {}),
      ...(v.floorY !== undefined ? { floorY: v.floorY } : {}),
      ...(v.cut !== undefined ? { recommendedCut: v.cut } : {}),
      ...(v.projectionPlanes !== undefined ? { showProjectionPlanes: v.projectionPlanes } : {}),
    }
    return { ok: true, spec, title: String(m.title || 'Model'), version, warnings }
  }
  // an older download: a bare spec, or an export with the spec inside
  const inner = (o.spec && typeof o.spec === 'object' ? o.spec : o) as Record<string, unknown>
  if (Array.isArray(inner.parts) && inner.parts.length) {
    return { ok: true, spec: inner, title: String(inner.title || o.title || 'Model'), version: null, warnings: ['An older Solidify model file (not .slfy); opened as it is.'] }
  }
  return { ok: false, error: 'This file is not a Solidify model: it has no "format": "slfy" and no parts.' }
}

/** checks a file against the v0.1 schema; for the validator, not for opening (opening is forgiving) */
export function validateSlfy(raw: unknown): { ok: true } | { ok: false; issues: string[] } {
  const r = slfyFileSchema.safeParse(raw)
  if (r.success) return { ok: true }
  return { ok: false, issues: r.error.issues.slice(0, 20).map((i) => `${i.path.join('.') || '(file)'}: ${i.message}`) }
}
