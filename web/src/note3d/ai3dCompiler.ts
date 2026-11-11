import { ApiError, api, stream } from '@/cloud/api'
import { findModule } from '@/modules/catalog'
import { readProgress, type LiveProgress } from './liveBuild'
import {
  type BuildOrRefineResult,
  matchCatalogSceneFromPrompt,
} from './createCatalog'
import type { NoteSceneSpec } from './schema'
import { sanitizeGeneratedSpec } from './sanitize'

export { sanitizeGeneratedSpec }

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
  /** a request with nothing to build (a transportation problem, statistics): `explanation` is the whole worked
   *  answer and there is no model (`spec` is the current one, if any) */
  answerOnly?: boolean
}

/**
 * Builds, changes or answers a question about a model with Solidify's API, streamed: `onProgress` hears
 * about each size, formula and part as Gemini writes it. Problems are thrown for the page to show.
 */
export async function streamOrEdit3DScene(
  req: { prompt: string; currentSpec?: NoteSceneSpec; photoDataUrl?: string; history?: { prompt: string; response: string }[]; plan?: boolean },
  onProgress: (p: LiveProgress) => void,
  signal?: AbortSignal,
): Promise<LiveResult> {
  let text = ''
  let lastChars = -1
  for await (const ev of stream('/v1/create-3d/stream', { prompt: req.prompt, currentSpec: req.currentSpec, photoBase64: req.photoDataUrl, history: req.history?.slice(-12), ...(req.plan && !req.currentSpec ? { plan: true } : {}) }, signal)) {
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
      const reply = data as { spec?: Record<string, unknown>; explanation?: string; isNewMachine?: boolean; isQuestion?: boolean; answerOnly?: boolean; labMatch?: { moduleId: string; sceneId: string } }
      if (reply.answerOnly && reply.explanation) {
        return { spec: (req.currentSpec ?? null) as unknown as NoteSceneSpec, explanation: reply.explanation, isNewMachine: false, isQuestion: true, answerOnly: true, matchedCatalogScene: null }
      }
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
