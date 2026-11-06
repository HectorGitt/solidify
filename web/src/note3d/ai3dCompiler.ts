import { ApiError, api, stream } from '@/cloud/api'
import { findModule } from '@/modules/catalog'
import { readProgress, type LiveProgress } from './liveBuild'
import {
  type BuildOrRefineResult,
  matchCatalogSceneFromPrompt,
} from './createCatalog'
import {
  ALLOWED_MATERIALS,
  noteSceneSpecSchema,
  noteShapeSchema,
  type NoteCalculationSpec,
  type NoteParameterSpec,
  type NotePartSpec,
  type NoteSceneSpec,
} from './schema'

function sanitizeGeneratedSpec(raw: Record<string, unknown>, fallbackTitle: string): NoteSceneSpec | null {
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

/**
 * Builds or edits a model through Solidify's API, as the signed-in student. Every failure (sign-in, daily
 * allowance, connection, an unusable reply) is thrown for the page to show.
 */
async function callBackendCreate3D(
  prompt: string,
  currentSpec?: NoteSceneSpec,
  photoDataUrl?: string,
): Promise<{ spec: NoteSceneSpec; explanation: string; isNewMachine: boolean; labMatch?: { moduleId: string; sceneId: string } }> {
  const ctrl = new AbortController()
  // a full build can take the model well over a minute
  const timer = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const parsed = await api<{ explanation?: string; isNewMachine?: boolean; spec?: Record<string, unknown>; labMatch?: { moduleId: string; sceneId: string } }>('/v1/create-3d', {
      body: { prompt, currentSpec, photoBase64: photoDataUrl },
      signal: ctrl.signal,
    })
    const cleanSpec = sanitizeGeneratedSpec(parsed as Record<string, unknown>, prompt)
    if (!cleanSpec) throw new ApiError('The model gave an incomplete answer. Try again, or describe it a little differently.', 502)
    return {
      spec: cleanSpec,
      explanation: parsed.explanation || `Compiled 3D assembly “${cleanSpec.title}” with ${cleanSpec.parts.length} parts.`,
      isNewMachine: parsed.isNewMachine ?? true,
      labMatch: parsed.labMatch,
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Builds a model from a description or photo, or edits the current one, with Solidify's API (Gemini),
 * as the signed-in student. Nothing is built without the model: any problem is shown to the student.
 */
export async function generateOrEdit3DScene(
  prompt: string,
  currentSpec?: NoteSceneSpec,
  photoDataUrl?: string,
): Promise<BuildOrRefineResult & { source: 'gemini' }> {
  const { labMatch, ...res } = await callBackendCreate3D(prompt, currentSpec, photoDataUrl)
  return {
    ...res,
    matchedCatalogScene: labFor(labMatch, prompt, res.isNewMachine),
    source: 'gemini',
  }
}

/** the lab model the AI named, or one the request's words point to */
function labFor(labMatch: { moduleId: string; sceneId: string } | undefined, prompt: string, isNewMachine: boolean) {
  const mod = labMatch ? findModule(labMatch.moduleId) : undefined
  const scene = mod?.scenes.find((sc) => sc.id === labMatch?.sceneId && sc.load)
  return mod && scene ? { module: mod, scene } : isNewMachine ? matchCatalogSceneFromPrompt(prompt) : null
}

/** what has arrived so far, as a spec the viewer can show (null until the first part is complete) */
export function previewSpec(progress: LiveProgress): NoteSceneSpec | null {
  if (!progress.parts.length) return null
  const spec = sanitizeGeneratedSpec({ spec: progress.draft }, progress.title ?? 'Building')
  // a fixed id, so the view does not reset as each part lands
  return spec ? { ...spec, id: 'live-build' } : null
}

export interface LiveResult extends BuildOrRefineResult {
  /** the student asked a question: the model is unchanged and `explanation` is the answer */
  isQuestion: boolean
}

/**
 * Builds, changes or answers a question about a model with Solidify's API, streamed: `onProgress` hears
 * about each size, formula and part as Gemini writes it. Problems are thrown for the page to show.
 */
export async function streamOrEdit3DScene(
  req: { prompt: string; currentSpec?: NoteSceneSpec; photoDataUrl?: string; history?: { prompt: string; response: string }[] },
  onProgress: (p: LiveProgress) => void,
  signal?: AbortSignal,
): Promise<LiveResult> {
  let text = ''
  let lastChars = -1
  for await (const ev of stream('/v1/create-3d/stream', { prompt: req.prompt, currentSpec: req.currentSpec, photoBase64: req.photoDataUrl, history: req.history?.slice(-12) }, signal)) {
    const data = JSON.parse(ev.data || '{}') as Record<string, unknown>
    if (ev.event === 'delta' && typeof data.text === 'string') {
      text += data.text
      // re-read only when a list item may have closed
      if (text.length - lastChars > 40 || /[}\]]/.test(data.text)) {
        lastChars = text.length
        onProgress(readProgress(text))
      }
    } else if (ev.event === 'error') {
      throw new ApiError(typeof data.error === 'string' ? data.error : 'Solidify couldn’t build that just now. Please try again.', 502)
    } else if (ev.event === 'done') {
      const reply = data as { spec?: Record<string, unknown>; explanation?: string; isNewMachine?: boolean; isQuestion?: boolean; labMatch?: { moduleId: string; sceneId: string } }
      if (reply.isQuestion && req.currentSpec) {
        return { spec: req.currentSpec, explanation: reply.explanation ?? '', isNewMachine: false, isQuestion: true, matchedCatalogScene: null }
      }
      const spec = sanitizeGeneratedSpec(reply as Record<string, unknown>, req.prompt)
      if (!spec) throw new ApiError('The model gave an incomplete answer. Try again, or describe it a little differently.', 502)
      const isNewMachine = reply.isNewMachine ?? true
      return {
        spec,
        explanation: reply.explanation || `Built “${spec.title}” with ${spec.parts.length} parts.`,
        isNewMachine,
        isQuestion: false,
        matchedCatalogScene: labFor(reply.labMatch, req.prompt, isNewMachine),
      }
    }
  }
  throw new ApiError('The connection closed before the model was finished. Please try again.', 0)
}
