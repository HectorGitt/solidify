import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
import { CREATE_3D_PROMPT } from './createPrompt.js'
import { LAB_SCENES } from './labCatalog.js'
import { catalogPromptText } from './noteCatalog.js'

export const noteAnalyzeRequest = z.object({
  pageNumber: z.number().int().min(1).max(500).default(1),
  pageImageBase64: z.string().max(12_000_000).optional(),
  pageText: z.string().max(30_000).default(''),
  fileName: z.string().max(240).default('document.pdf'),
  cropBox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
})

export type NoteAnalyzeRequest = z.infer<typeof noteAnalyzeRequest>

export const noteRefineRequest = z.object({
  currentSpec: z.record(z.string(), z.unknown()),
  instruction: z.string().trim().min(1).max(1000),
})

export type NoteRefineRequest = z.infer<typeof noteRefineRequest>

export const create3dRequest = z.object({
  prompt: z.string().trim().min(1).max(2000),
  currentSpec: z.record(z.string(), z.unknown()).optional(),
  photoBase64: z.string().max(12_000_000).optional(),
  /** the conversation about this model so far, oldest first */
  history: z.array(z.object({ prompt: z.string().max(2000), response: z.string().max(2000) })).max(12).optional(),
})

export type Create3dRequest = z.infer<typeof create3dRequest> & {
  /** a checked library model close to the request, to start from (the server sets it; clients cannot) */
  reference?: { title: string; spec: Record<string, unknown> }
}

export interface NoteVisionModel {
  analyzePage(req: NoteAnalyzeRequest): Promise<{ figures: unknown[] }>
  refineSpec(req: NoteRefineRequest): Promise<{ spec: Record<string, unknown> }>
  createOrEdit3D(req: Create3dRequest): Promise<CreateReply>
  /** the same answer as it is written, as raw JSON text; read the whole of it with `readCreateReply` */
  streamCreate3D(req: Create3dRequest, signal?: AbortSignal, onUsage?: (u: ModelUsage) => void): AsyncIterable<string>
  /** new requests for the model library, none of them already in `avoid` */
  suggestTopics(count: number, avoid: string[]): Promise<{ topic: string; prompt: string }[]>
}

const TOPICS_PROMPT = `You plan the model library of Solidify, an engineering-education app where each request is built as an interactive 3D model with its engineering worked out (sizes on sliders, calculations, graphs, loads as arrows).

Suggest new requests, each one machine, mechanism, structure or test piece a university engineering student studies, with the key numbers given, in one line, like:
"A worm and worm wheel reducer, 30 : 1, with the worm on a steel shaft"
"A simply supported beam, 5 m span, with two 8 kN point loads at the third points"

Spread them across these subjects: gears and drives; shafts, bearings and couplings; fasteners and joints; strength of materials (beams, shafts in torsion, columns, pressure vessels, stress states); fluids and hydraulic machines (pumps, turbines, meters, cylinders); thermodynamics and heat transfer (engines, compressors, exchangers, refrigeration); mechanisms and machine dynamics; agricultural machinery and processing; structures and farm buildings; soil and water engineering (irrigation, drainage, wells). Each must be something that can be drawn as a 3D model, not a concept, a graph or a calculation alone. No course codes or textbook names.

Return JSON only: { "topics": [ { "topic": "<subject, as above>", "prompt": "<the request>" } ] }`

/** tokens a model call used: what it was sent, and what it wrote (thinking included, as it is billed) */
export interface ModelUsage {
  input: number
  output: number
}

const usageOf = (m?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number }): ModelUsage | undefined =>
  m ? { input: m.promptTokenCount ?? 0, output: (m.candidatesTokenCount ?? 0) + (m.thoughtsTokenCount ?? 0) } : undefined

export interface CreateReply {
  spec: Record<string, unknown>
  explanation: string
  isNewMachine: boolean
  /** the student asked a question: `explanation` answers it and the model is unchanged */
  isQuestion?: boolean
  labMatch?: { moduleId: string; sceneId: string }
  usage?: ModelUsage
}

/** what Gemini is sent for a build, change or question */
export function createParts(req: Create3dRequest): Part[] {
  const chat = req.history?.length ? `Conversation so far (oldest first):\n${req.history.map((h) => `Student: ${h.prompt}\nSolidify: ${h.response}`).join('\n')}\n\n` : ''
  const reference = req.reference && !req.currentSpec ? JSON.stringify(req.reference.spec) : ''
  const text = req.currentSpec
    ? `${chat}Student: "${req.prompt}"\nCurrent NoteSceneSpec:\n${JSON.stringify(req.currentSpec)}`
    : reference && reference.length < 80_000
      ? `Build a complete 3D NoteSceneSpec for: "${req.prompt}"\n\nSolidify's library has a checked model of something close to this, "${req.reference!.title}". Start from its layout, parts and relations where they fit the request, and change the parts, sizes, values, calculations and graphs to match exactly what was asked. Give it a new title for this request.\nChecked model:\n${reference}`
      : `Build a complete 3D NoteSceneSpec for: "${req.prompt}"`
  return [...imagePart(req.photoBase64), { text }]
}

/** reads Gemini's whole reply into a build result (throws ModelReplyError when it is unusable) */
export function readCreateReply(text: string, req: Create3dRequest): CreateReply {
  const parsed = parseModelJson<{ spec?: Record<string, unknown>; explanation?: string; isNewMachine?: boolean; isQuestion?: boolean; labMatch?: unknown }>(text)
  const isQuestion = parsed.isQuestion === true && !!req.currentSpec
  return {
    spec: isQuestion ? (req.currentSpec ?? {}) : (parsed.spec ?? req.currentSpec ?? {}),
    explanation: parsed.explanation ?? 'Compiled 3D assembly.',
    isNewMachine: isQuestion ? false : (parsed.isNewMachine ?? true),
    isQuestion: isQuestion || undefined,
    labMatch: toLabMatch(parsed.labMatch),
  }
}

/** The model's reply wasn't usable JSON (most often cut off at the length limit). */
export class ModelReplyError extends Error {}

/** JSON from a model reply, tolerating a code fence around it; anything else is a ModelReplyError. */
export function parseModelJson<T>(text: string | undefined): T {
  const raw = (text ?? '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  try {
    return JSON.parse(raw) as T
  } catch {
    throw new ModelReplyError('The model returned an incomplete answer.')
  }
}

const NOTE_SYSTEM_PROMPT = `You read one page of an engineering textbook, handout or note (an image of the page, and its text if it has a text layer). Find every engineering figure on the page and say how Solidify can show it in 3D.

Return JSON only, in this shape:
{ "figures": [ {
  "id": "fig-1",
  "pageNumber": 1,
  "box": [ymin, xmin, ymax, xmax],
  "title": "Figure 4.2",
  "caption": "the figure's caption, or a short description",
  "confidence": 0.0,
  "extractedGivens": [{ "symbol": "L", "label": "Beam span", "value": 3.2, "unit": "m" }],
  "visualization": { "kind": "catalog", "moduleId": "...", "sceneId": "...", "params": { } }
} ] }

Rules:
- box is in 0 to 1000 page coordinates, tight around the drawing, not its caption.
- Take values from the figure, its caption and the paragraphs around it (a worked example often gives the numbers the figure leaves out).
- confidence (0 to 1) is how sure you are that the figure really is the chosen rig AND that the values are right. Use below 0.75 if either is a guess. Never omit it.
- Use "kind": "catalog" only for one of these rigs, with params named exactly as listed and in the units listed:
${catalogPromptText()}
- Otherwise, for a single machine part shown in orthographic, isometric or sectional views, use "kind": "procedural" with a NoteSceneSpec built from simple solids (box, cylinder, tube, cone, lathe, extrude, gear, hexNut, hexBolt) and holes cut from them.
- For a drawing of a machine, mechanism or structure that is neither one of those rigs nor a single part (a truss, a frame, a beam with its supports, an assembly, a linkage), use "kind": "build" with nothing else in visualization: Solidify builds it from the drawing.
- For graphs, equations, tables, photos and anything else, use "kind": "none". Do not force a figure onto a rig it is not.`


/** a lab model id the model named, kept only if it is a real one */
export function toLabMatch(v: unknown): { moduleId: string; sceneId: string } | undefined {
  if (typeof v !== 'string') return undefined
  const [moduleId, sceneId] = v.split('/')
  return LAB_SCENES.some(([m, sc]) => m === moduleId && sc === sceneId) ? { moduleId, sceneId } : undefined
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } }

/** an inline image part from a data URL, if it is one */
function imagePart(dataUrl?: string): Part[] {
  const m = dataUrl ? /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl) : null
  return m ? [{ inlineData: { mimeType: m[1], data: m[2] } }] : []
}

export class GeminiNoteVision implements NoteVisionModel {
  private ai: GoogleGenAI
  constructor(
    private model: string,
    project: string,
    location: string,
  ) {
    this.ai = new GoogleGenAI({ enterprise: true, project, location })
  }

  private async json<T>(system: string, parts: Part[], maxOutputTokens: number, temperature = 0.2): Promise<T> {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts }],
      config: { systemInstruction: system, responseMimeType: 'application/json', temperature, maxOutputTokens },
    })
    return parseModelJson<T>(res.text)
  }

  async suggestTopics(count: number, avoid: string[]) {
    const parsed = await this.json<{ topics?: { topic?: unknown; prompt?: unknown }[] }>(
      TOPICS_PROMPT,
      [{ text: `Give ${count} new requests. Do not repeat or closely rephrase any of these, already in the library or planned:\n${avoid.slice(-400).map((a) => `- ${a}`).join('\n')}` }],
      8192,
      0.9,
    )
    return (parsed.topics ?? [])
      .filter((t) => typeof t.topic === 'string' && typeof t.prompt === 'string' && t.prompt.trim().length >= 12)
      .map((t) => ({ topic: String(t.topic).trim().slice(0, 60), prompt: String(t.prompt).trim().slice(0, 400) }))
  }

  async analyzePage(req: NoteAnalyzeRequest): Promise<{ figures: unknown[] }> {
    const parsed = await this.json<{ figures?: unknown[] }>(
      NOTE_SYSTEM_PROMPT,
      [...imagePart(req.pageImageBase64), { text: `File: ${req.fileName}\nPage: ${req.pageNumber}\nOnly this region: ${req.cropBox ? JSON.stringify(req.cropBox) : 'the whole page'}\nExtracted text:\n${req.pageText}` }],
      16384,
    )
    return { figures: Array.isArray(parsed.figures) ? parsed.figures : [] }
  }

  async refineSpec(req: NoteRefineRequest): Promise<{ spec: Record<string, unknown> }> {
    const parsed = await this.json<{ spec?: Record<string, unknown> }>(
      NOTE_SYSTEM_PROMPT,
      [{ text: `Current NoteSceneSpec JSON:\n${JSON.stringify(req.currentSpec)}\n\nStudent instruction:\n${req.instruction}\n\nReturn the updated NoteSceneSpec JSON object under { "spec": ... }.` }],
      16384,
    )
    return { spec: parsed.spec ?? req.currentSpec }
  }

  private createConfig(signal?: AbortSignal) {
    return { systemInstruction: CREATE_3D_PROMPT, responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 32768, abortSignal: signal }
  }

  async createOrEdit3D(req: Create3dRequest) {
    const res = await this.ai.models.generateContent({ model: this.model, contents: [{ role: 'user', parts: createParts(req) }], config: this.createConfig() })
    return { ...readCreateReply(res.text ?? '', req), usage: usageOf(res.usageMetadata) }
  }

  async *streamCreate3D(req: Create3dRequest, signal?: AbortSignal, onUsage?: (u: ModelUsage) => void) {
    const res = await this.ai.models.generateContentStream({ model: this.model, contents: [{ role: 'user', parts: createParts(req) }], config: this.createConfig(signal) })
    let usage: ModelUsage | undefined
    for await (const chunk of res) {
      usage = usageOf(chunk.usageMetadata) ?? usage
      const t = chunk.text
      if (t) yield t
    }
    if (usage) onUsage?.(usage)
  }
}

export class FakeNoteVision implements NoteVisionModel {
  async analyzePage(req: NoteAnalyzeRequest): Promise<{ figures: unknown[] }> {
    const box = req.cropBox ?? [200, 80, 620, 920]
    return {
      figures: [
        {
          id: `fig-p${req.pageNumber}-1`,
          pageNumber: req.pageNumber,
          box,
          title: `Figure ${req.pageNumber}.1`,
          caption: `3D model extracted from ${req.fileName}`,
          confidence: 0.9,
          extractedGivens: [{ symbol: 'L', label: 'Span', value: 3.0, unit: 'm' }],
          visualization: { kind: 'catalog', moduleId: 'materials', sceneId: 'beam', params: { support: 'simple', L: 3.0, P1: 15, x1: 1.5, w: 4 } },
        },
      ],
    }
  }

  async refineSpec(req: NoteRefineRequest): Promise<{ spec: Record<string, unknown> }> {
    return { spec: { ...req.currentSpec, refinedWith: req.instruction } }
  }

  /** a small working model: a shaft with a gear, so tests can build, change and stream it */
  fakeReply(req: Create3dRequest) {
    if (req.currentSpec && /\?$/.test(req.prompt)) return { explanation: `About your question: ${req.prompt}`, isQuestion: true }
    return {
      explanation: `Built ${req.prompt}`,
      isNewMachine: !req.currentSpec,
      spec: {
        id: 'fake-3d',
        title: req.prompt,
        units: 'mm',
        parameters: [{ id: 'D', label: 'Shaft diameter', symbol: 'd', value: 30, min: 10, max: 60, step: 1, unit: 'mm' }],
        calculations: [{ id: 'area', label: 'Shaft area', symbol: 'A', formula: 'pi * D^2 / 4', unit: 'mm²', latex: 'A = \\pi d^2 / 4' }],
        parts: [
          { id: 'shaft', name: 'Shaft', material: 'steel', role: 'moving', shapes: [{ kind: 'cylinder', r: 'D / 2000', h: 0.3 }] },
          { id: 'gear', name: 'Gear', material: 'steel', role: 'moving', shapes: [{ kind: 'gear', teeth: 24, module: 0.004, h: 0.03 }] },
        ],
      },
    }
  }

  /** a stand-in token count: the photo costs the most, then the current model sent back, then the words */
  private fakeUsage(req: Create3dRequest, text: string): ModelUsage {
    return { input: 1000 + (req.photoBase64 ? 1500 : 0) + (req.currentSpec ? JSON.stringify(req.currentSpec).length : 0), output: text.length }
  }

  /** numbered stand-ins, so tests can see new ones arrive */
  suggested = 0
  async suggestTopics(count: number, avoid: string[]) {
    const out: { topic: string; prompt: string }[] = []
    while (out.length < count) {
      const prompt = `Suggested machine number ${++this.suggested}`
      if (!avoid.includes(prompt)) out.push({ topic: 'Machines', prompt })
    }
    return out
  }

  async createOrEdit3D(req: Create3dRequest) {
    const text = JSON.stringify(this.fakeReply(req))
    return { ...readCreateReply(text, req), usage: this.fakeUsage(req, text) }
  }

  async *streamCreate3D(req: Create3dRequest, _signal?: AbortSignal, onUsage?: (u: ModelUsage) => void) {
    const text = JSON.stringify(this.fakeReply(req))
    for (let i = 0; i < text.length; i += 60) yield text.slice(i, i + 60)
    onUsage?.(this.fakeUsage(req, text))
  }
}
