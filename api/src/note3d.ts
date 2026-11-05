import { GoogleGenAI } from '@google/genai'
import { z } from 'zod'
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
})

export type Create3dRequest = z.infer<typeof create3dRequest>

export interface NoteVisionModel {
  analyzePage(req: NoteAnalyzeRequest): Promise<{ figures: unknown[] }>
  refineSpec(req: NoteRefineRequest): Promise<{ spec: Record<string, unknown> }>
  createOrEdit3D(req: Create3dRequest): Promise<{
    spec: Record<string, unknown>
    explanation: string
    isNewMachine: boolean
  }>
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
- Otherwise, for a single machine part shown in orthographic, isometric or sectional views, use "kind": "procedural" with a NoteSceneSpec built from simple solids (box, cylinder, tube, cone, lathe, extrude, gear) and holes cut from them.
- For graphs, equations, photos and anything else, use "kind": "none". Do not force a figure onto a rig it is not.`

const CREATE_3D_PROMPT = `You are the Solidify 3D Parametric CAD & Engineering Physics Compiler.
Given any natural-language machine description, edit instruction, or uploaded photo, compile a complete interactive 3D NoteSceneSpec JSON object with:
- parts (housing with cut: true, moving parts with motion: rotate/translate/oscillate, explode vectors, and CSG shapes: box, cylinder, tube, cone, sphere, torus, gear, bevelGear, rack, pulley, sprocket, spring, lathe, extrude)
- parameters (4-7 sliders referenced in shape dimension expressions)
- calculations (3-6 live engineering formulas with latex and units)
Return valid JSON: { "explanation": "...", "isNewMachine": true, "spec": { ... } }`

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

  async createOrEdit3D(req: Create3dRequest) {
    const parsed = await this.json<{ spec?: Record<string, unknown>; explanation?: string; isNewMachine?: boolean }>(
      CREATE_3D_PROMPT,
      [...imagePart(req.photoBase64), { text: req.currentSpec ? `User prompt: "${req.prompt}"\nCurrent NoteSceneSpec:\n${JSON.stringify(req.currentSpec)}` : `Build a complete 3D NoteSceneSpec for: "${req.prompt}"` }],
      32768,
      0.25,
    )
    return {
      spec: parsed.spec ?? req.currentSpec ?? {},
      explanation: parsed.explanation ?? 'Compiled 3D assembly.',
      isNewMachine: parsed.isNewMachine ?? true,
    }
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

  async createOrEdit3D(req: Create3dRequest) {
    return {
      spec: req.currentSpec ?? { id: 'fake-3d', title: req.prompt, units: 'mm', parameters: [], parts: [] },
      explanation: `Built ${req.prompt}`,
      isNewMachine: true,
    }
  }
}
