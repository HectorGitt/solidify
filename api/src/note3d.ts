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
  /** up to 4000 characters: a pasted exam or textbook question can be long */
  prompt: z.string().trim().min(1).max(4000),
  currentSpec: z.record(z.string(), z.unknown()).optional(),
  photoBase64: z.string().max(12_000_000).optional(),
  /** the conversation about this model so far, oldest first */
  history: z.array(z.object({ prompt: z.string().max(2000), response: z.string().max(4000) })).max(12).optional(),
  /** plan the parts and how each is held first, then build to the plan (a new model only: two model calls) */
  plan: z.boolean().optional(),
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
  /** looks at a picture of a built model, as a reviewer would, and says what is visibly wrong with it */
  lookAtModel(req: LookRequest): Promise<{ ok: boolean; problems: string[]; usage?: ModelUsage }>
}

/** a drawn model to look at: its picture, what it is meant to be, and its parts by name */
export const lookRequest = z.object({
  image: z.string().max(1_500_000).regex(/^data:image\/(jpeg|webp|png);base64,/),
  title: z.string().trim().max(200),
  prompt: z.string().trim().max(2000).optional(),
  parts: z.array(z.string().max(120)).max(60).optional(),
})
export type LookRequest = z.infer<typeof lookRequest>

const LOOK_PROMPT = `You check 3D engineering models for Solidify, an engineering-education app. You are shown a picture of a model that was built automatically, with what it is meant to be and the names of its parts. Look at it as an engineering lecturer would before showing it to a class, and say only what is plainly, visibly wrong with how it is put together:

- a part hanging in mid-air, or a group of parts not joined to the rest (a gear and shaft above a base with nothing holding them; a bearing block with no pedestal under it)
- a part in the wrong place for what it is (a worm wheel outside its gearbox; a key at the centre of a shaft; balls not between their races; a piston beside its cylinder)
- parts that pass through each other where they should not (gear teeth cutting deep into each other; a lever through a ram), or that should touch and do not (gears that do not reach each other; a shaft above its bearing)
- a part lying the wrong way (a rack along the shaft; a ring of balls on its side)
- a main part of the named machine plainly missing

Do not report: style, colours, proportions, level of detail, simplified shapes, labels or arrows, a housing shown cut open (cut faces are hatched; parts inside a cut-away are meant to show, and in a half section the parts that are not cut stand clear of the cut half), anything you cannot actually see in the picture, or anything you are unsure of. A correct model has no problems: say so. Never invent a fault to have something to say.

Return JSON only: { "ok": true | false, "problems": [ "<one short plain sentence naming the part and what is wrong>" ] }. At most 4 problems, the worst first. "ok" is false only if there is at least one problem.`


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
  /** a request with nothing to build: `explanation` is the full worked answer, and there is no model */
  answerOnly?: boolean
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

const PLAN_PROMPT = `You plan 3D engineering models for Solidify before they are built. Given a request, list every part the model needs and how each one is held, in words, as an engineer would before drawing anything. The build that follows draws exactly this plan, so a part you leave out, or one held by nothing, will be wrong in the model.

For each part give:
- id: short snake_case, unique
- name: what a student would call it
- held: how it is held, naming the other part by id ("in the bores of base_pedestals", "keyed to input_shaft", "meshes with pinion", "on the crank pin of crank, sliding in the slot of yoke"). The one part that holds the rest (a base, a frame, a casing) says "the anchor". Never "floating", never "nothing".
- moves: "drives" (exactly one part per mechanism: the motor, input shaft, crank or handwheel), "driven" (moves because of what it is held by), or "fixed".
- standard: if it is a standard machine part, which one ("ball bearing", "spur gear", "helical gear", "rack", "worm", "key", "universal joint", "spring", "bolt", "nut", "pulley", "sprocket"); otherwise "none".

Rules: a part that turns freely on a pin (a slider in a slot, an idler) is "on" the pin, not fixed to it; every shaft runs in bearings or bores of something fixed; gears in mesh say so; what the student asked about is in the plan. Keep it to the parts that matter (3 to 16).

Return JSON only: { "parts": [ { "id": "", "name": "", "held": "", "moves": "", "standard": "" } ] }`

/** a plan's parts as lines for the build prompt, and what is wrong with it (a part held by nothing, no driver) */
export function planText(plan: unknown): { text: string; problems: string[] } {
  const parts = (Array.isArray((plan as { parts?: unknown })?.parts) ? (plan as { parts: unknown[] }).parts : []).filter(
    (p): p is { id: string; name: string; held: string; moves?: string; standard?: string } => !!p && typeof (p as { id?: unknown }).id === 'string' && typeof (p as { held?: unknown }).held === 'string',
  )
  const problems: string[] = []
  const ids = new Set(parts.map((p) => p.id))
  const anchors = parts.filter((p) => /\banchor\b/i.test(p.held))
  if (!parts.length) problems.push('the plan has no parts')
  if (!anchors.length) problems.push('no part is the anchor that holds the rest')
  for (const p of parts) {
    if (/\b(floating|nothing|none)\b/i.test(p.held)) problems.push(`${p.name} is held by nothing`)
    else if (!/\banchor\b/i.test(p.held) && ![...ids].some((id) => id !== p.id && p.held.includes(id))) problems.push(`${p.name} does not say which part holds it`)
  }
  const moving = parts.filter((p) => /driv/i.test(p.moves ?? ''))
  if (moving.length && !moving.some((p) => /^drives?$/i.test((p.moves ?? '').trim()))) problems.push('nothing drives the mechanism')
  const text = parts.map((p) => `- ${p.id} (${p.name}): ${p.held}; ${p.moves ?? 'fixed'}${p.standard && p.standard !== 'none' ? `; standard part: ${p.standard}` : ''}`).join('\n')
  return { text, problems }
}

/** two calls' tokens together */
function addUsage(a?: ModelUsage, b?: ModelUsage): ModelUsage | undefined {
  if (!a) return b
  if (!b) return a
  return { ...a, input: (a.input ?? 0) + (b.input ?? 0), output: (a.output ?? 0) + (b.output ?? 0) } as ModelUsage
}

/** reads Gemini's whole reply into a build result (throws ModelReplyError when it is unusable) */
export function readCreateReply(text: string, req: Create3dRequest): CreateReply {
  const parsed = parseModelJson<{ spec?: Record<string, unknown>; explanation?: string; isNewMachine?: boolean; isQuestion?: boolean; answerOnly?: boolean; labMatch?: unknown }>(text)
  // a request with nothing to build (a transportation problem, statistics): a written answer and no model
  if (parsed.answerOnly === true && typeof parsed.explanation === 'string' && parsed.explanation.trim()) {
    return { spec: req.currentSpec ?? {}, explanation: parsed.explanation, isNewMachine: false, isQuestion: true, answerOnly: true }
  }
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

  async lookAtModel(req: LookRequest) {
    const res = await this.ai.models.generateContent({
      model: this.model,
      contents: [{ role: 'user', parts: [...imagePart(req.image), { text: `Model: ${req.title}\n${req.prompt ? `Asked for: ${req.prompt}\n` : ''}Parts: ${(req.parts ?? []).join('; ') || '(not given)'}` }] }],
      config: { systemInstruction: LOOK_PROMPT, responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 2048 },
    })
    const parsed = parseModelJson<{ ok?: unknown; problems?: unknown }>(res.text)
    const problems = (Array.isArray(parsed.problems) ? parsed.problems : [])
      .filter((x): x is string => typeof x === 'string' && x.trim().length > 3)
      .map((x) => x.trim().slice(0, 200))
      .slice(0, 4)
    return { ok: problems.length === 0, problems, usage: usageOf(res.usageMetadata) }
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

  /**
   * For a new model asked to plan first: the parts and how each is held, checked (every part held by a named part,
   * one anchor, something driving), asked again once if it is not right, then given to the build as what to draw.
   */
  private async planned(req: Create3dRequest): Promise<{ req: Create3dRequest; usage?: ModelUsage }> {
    if (!req.plan || req.currentSpec) return { req }
    const ask = async (extra: string) => {
      const res = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [...imagePart(req.photoBase64), { text: `Plan the parts for: "${req.prompt}"${extra}` }] }],
        config: { systemInstruction: PLAN_PROMPT, responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 4096 },
      })
      return { plan: planText(parseModelJson(res.text)), usage: usageOf(res.usageMetadata) }
    }
    let { plan, usage } = await ask('')
    if (plan.problems.length) {
      const again = await ask(`\n\nA first plan had these problems; fix them: ${plan.problems.join('; ')}`)
      if (again.plan.problems.length < plan.problems.length) plan = again.plan
      usage = addUsage(usage, again.usage)
    }
    if (!plan.text) return { req, usage }
    return { req: { ...req, prompt: `${req.prompt}\n\nBuild it to this plan (every part held as said, the anchor placed, the rest mounted by those relations; standard parts as the standard shapes):\n${plan.text}` }, usage }
  }

  async createOrEdit3D(req: Create3dRequest) {
    const p = await this.planned(req)
    const res = await this.ai.models.generateContent({ model: this.model, contents: [{ role: 'user', parts: createParts(p.req) }], config: this.createConfig() })
    return { ...readCreateReply(res.text ?? '', req), usage: addUsage(p.usage, usageOf(res.usageMetadata)) }
  }

  async *streamCreate3D(req: Create3dRequest, signal?: AbortSignal, onUsage?: (u: ModelUsage) => void) {
    const p = await this.planned(req)
    const res = await this.ai.models.generateContentStream({ model: this.model, contents: [{ role: 'user', parts: createParts(p.req) }], config: this.createConfig(signal) })
    let usage: ModelUsage | undefined = p.usage
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

  /** tests: a model titled "floating ..." is seen to have a floating part; anything else looks right */
  async lookAtModel(req: LookRequest) {
    return /floating/i.test(req.title) ? { ok: false, problems: ['The gear is hanging in mid-air above the base.'] } : { ok: true, problems: [] }
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
