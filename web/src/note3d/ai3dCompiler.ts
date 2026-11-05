import { ApiError, api } from '@/cloud/api'
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

export const CREATE_3D_SYSTEM_PROMPT = `You are the Solidify 3D Parametric CAD & Engineering Physics Compiler.
The user will describe ANY machine, mechanism, device, tool, appliance, vehicle, structure, or component (or upload a photo/diagram of one), OR ask to modify the current 3D model.
Your job is to compile a complete, physically accurate, interactive 3D assembly in Solidify's NoteSceneSpec JSON format.

CRITICAL GEOMETRY & ENGINEERING RULES:
1. Coordinate system & scale:
   - All 3D coordinates and shape dimensions are in METERS (m), centered near [0, 0, 0].
   - Typical machine assembly size is 0.25 m to 0.70 m across (\`extent\`: 0.45 to 0.65, \`floorY\`: -0.22).
   - Default cylinder/tube/cone/gear/pulley/spring axis in local space is the Y-axis [0, 1, 0].
     * To align a cylinder/tube/gear/pulley/spring along the X-axis, set \`rotation: [0, 0, 1.5708]\`.
     * To align a cylinder/tube/gear/pulley/spring along the Z-axis, set \`rotation: [1.5708, 0, 0]\`.
2. Every machine MUST be decomposed into 3 to 8 distinct functional \`parts\`:
   - Outer casings, bodies, shells, guards, hoppers, or frames MUST have \`role: "housing"\` and \`cut: true\` so the user can click "Cut Open" to slice the housing and see the internal moving parts!
   - Internal rotors, shafts, gears, impellers, pistons, screws, blades, cams, followers, handles, or linkages MUST have \`role: "moving"\`, \`cut: false\`, and a realistic \`motion\` object (\`rotate\`, \`translate\`, or \`oscillate\`) so "Animate" brings the mechanism to life!
   - Every part MUST have a meaningful \`explode: [dx, dy, dz]\` offset (magnitude 0.06 to 0.18 m along its natural disassembly axis) so "Take Apart" produces a clean exploded CAD view!
   - Every part MUST have \`info: { summary: "...", role: "..." }\` explaining what the component is and what engineering function it performs.
3. Supported CSG shape primitives (\`shapes\` array inside each part):
   - \`box\`: \`{ kind: "box", op?: "add"|"subtract", sx, sy, sz, position?, rotation?, radialCount?, radialRadius? }\`
   - \`cylinder\`: \`{ kind: "cylinder", op?: "add"|"subtract", r, rTop?, rBot?, h, position?, rotation?, radialCount?, radialRadius? }\`
   - \`tube\`: \`{ kind: "tube", op?: "add"|"subtract", rOuter, rInner, h, position?, rotation?, radialCount?, radialRadius? }\`
   - \`cone\`: \`{ kind: "cone", op?: "add"|"subtract", rBot, rTop, h, position?, rotation? }\`
   - \`sphere\`: \`{ kind: "sphere", op?: "add"|"subtract", r, position?, radialCount?, radialRadius? }\`
   - \`torus\`: \`{ kind: "torus", op?: "add"|"subtract", r, tubeRadius, position?, rotation? }\`
   - \`gear\`: \`{ kind: "gear", teeth, module, h, rInner?, helixAngle?, position?, rotation?, radialCount?, radialRadius? }\`
   - \`bevelGear\`: \`{ kind: "bevelGear", teeth, module, h, rInner?, position?, rotation? }\`
   - \`pulley\`: \`{ kind: "pulley", rOuter, rInner, h, position?, rotation? }\`
   - \`sprocket\`: \`{ kind: "sprocket", teeth, module, h, rInner?, position?, rotation? }\`
   - \`rack\`: \`{ kind: "rack", sx, sy, sz, teeth?, position?, rotation? }\`
   - \`spring\`: \`{ kind: "spring", r, wireRadius, h, turns, position?, rotation? }\`
   - \`lathe\`: \`{ kind: "lathe", profile: [[r1, y1], [r2, y2], ...], position?, rotation? }\`
   - \`extrude\`: \`{ kind: "extrude", polygon: [[x1, y1], [x2, y2], ...], depth, position?, rotation? }\`
4. Allowed materials (\`material\` field on each part):
   ${ALLOWED_MATERIALS.join(', ')}
5. Parametric Dimensions (\`parameters\`) & Live Physics (\`calculations\`):
   - Define 4 to 7 \`parameters\` with \`id\`, \`label\`, \`symbol\`, \`value\`, \`min\`, \`max\`, \`step\`, \`unit\`.
   - Use parameter \`id\`s inside shape dimension expressions (e.g. \`"rOuter": "D * 0.5"\`, \`"h": "L"\`, \`"teeth": "z1"\`, \`"radialCount": "blades"\`, \`"speed": "rpm / 60 * 0.4"\`) so dragging any slider visibly morphs the 3D geometry or animation speed!
   - Define 3 to 6 \`calculations\` with \`id\`, \`label\`, \`symbol\`, \`formula\` (using parameter IDs, preceding calculation IDs, \`pi\`, \`sqrt\`, \`sin\`, \`cos\`, \`^\`), \`unit\`, \`latex\`, and optional \`limit: { kind: "max"|"min", value: number, label: string }\`.

Return ONLY a JSON object with this exact top-level structure:
{
  "explanation": "Clear 1-2 sentence summary of the 3D assembly built or the modifications applied.",
  "isNewMachine": true,
  "spec": {
    "id": "create-...",
    "title": "...",
    "summary": "...",
    "units": "mm",
    "extent": 0.5,
    "floorY": -0.2,
    "camera": { "position": [0.52, 0.38, 0.58], "target": [0, 0, 0] },
    "recommendedCut": { "enabled": true, "normal": [0, 0, 1], "pos": 0.01 },
    "parameters": [...],
    "calculations": [...],
    "parts": [...]
  }
}`

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
): Promise<{ spec: NoteSceneSpec; explanation: string; isNewMachine: boolean }> {
  const ctrl = new AbortController()
  // a full build can take the model well over a minute
  const timer = setTimeout(() => ctrl.abort(), 120_000)
  try {
    const parsed = await api<{ explanation?: string; isNewMachine?: boolean; spec?: Record<string, unknown> }>('/v1/create-3d', {
      body: { prompt, currentSpec, photoBase64: photoDataUrl },
      signal: ctrl.signal,
    })
    const cleanSpec = sanitizeGeneratedSpec(parsed as Record<string, unknown>, prompt)
    if (!cleanSpec) throw new ApiError('The model gave an incomplete answer. Try again, or describe it a little differently.', 502)
    return {
      spec: cleanSpec,
      explanation: parsed.explanation || `Compiled 3D assembly “${cleanSpec.title}” with ${cleanSpec.parts.length} parts.`,
      isNewMachine: parsed.isNewMachine ?? true,
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
  const res = await callBackendCreate3D(prompt, currentSpec, photoDataUrl)
  return {
    ...res,
    // a new machine that resembles one of the lab rigs links to the real rig
    matchedCatalogScene: res.isNewMachine ? matchCatalogSceneFromPrompt(prompt) : null,
    source: 'gemini',
  }
}
