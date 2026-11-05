import { ApiError, api } from '@/cloud/api'
import type { MaterialKey } from '@/render/materials'
import {
  buildOrRefineModelFromText,
  type BuildOrRefineResult,
  type CatalogSceneMatch,
  matchCatalogSceneFromPrompt,
} from './createCatalog'
import {
  ALLOWED_MATERIALS,
  noteSceneSpecSchema,
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
 * Builds or edits a model through Solidify's API, as the signed-in student. A missing sign-in or a spent
 * daily allowance is passed on to the caller to show; an unreachable server returns null, so the
 * offline builder can take over.
 */
async function callBackendCreate3D(
  prompt: string,
  currentSpec?: NoteSceneSpec,
  photoDataUrl?: string,
): Promise<{ spec: NoteSceneSpec; explanation: string; isNewMachine: boolean } | null> {
  // outside a browser (tests, tools) there is no student to sign in, so no model is called
  if (typeof window === 'undefined') return null
  const ctrl = new AbortController()
  // a full build can take the model well over a minute
  const timer = window.setTimeout(() => ctrl.abort(), 120_000)
  try {
    const parsed = await api<{ explanation?: string; isNewMachine?: boolean; spec?: Record<string, unknown> }>('/v1/create-3d', {
      body: { prompt, currentSpec, photoBase64: photoDataUrl },
      signal: ctrl.signal,
    })
    const cleanSpec = sanitizeGeneratedSpec(parsed as Record<string, unknown>, prompt)
    if (!cleanSpec) return null
    return {
      spec: cleanSpec,
      explanation: parsed.explanation || `Compiled 3D assembly “${cleanSpec.title}” with ${cleanSpec.parts.length} parts.`,
      isNewMachine: parsed.isNewMachine ?? true,
    }
  } catch (e) {
    if (e instanceof ApiError && e.status !== 0) throw e
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

function formatPromptTitle(prompt: string): string {
  const cleaned = prompt
    .replace(/^(?:(?:build|create|make|design|model|show|generate)\s+(?:me\s+)?)?(?:a|an|the|our|my)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return 'Custom 3D Engineering Assembly'
  return cleaned
    .split(' ')
    .slice(0, 9)
    .map((w) => (w.length > 2 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/[.,;:!?]+$/, '')
}

/**
 * Handles structural chat edits on the current model:
 * - "add a 6-blade cooling fan"
 * - "add a feed hopper on top"
 * - "add a flywheel"
 * - "add a helical spring"
 * - "remove the housing"
 */
function tryApplyStructuralPartEdit(
  prompt: string,
  currentSpec: NoteSceneSpec,
): { spec: NoteSceneSpec; explanation: string } | null {
  const lower = prompt.trim().toLowerCase()
  const spec = JSON.parse(JSON.stringify(currentSpec)) as NoteSceneSpec

  // 1. Remove / delete a part
  const removeMatch = /^(?:remove|delete|hide|drop)\s+(?:the\s+)?(.+)$/i.exec(lower)
  if (removeMatch && spec.parts.length > 1) {
    const target = removeMatch[1].trim()
    const before = spec.parts.length
    const removedNames: string[] = []
    spec.parts = spec.parts.filter((pt) => {
      const hit =
        pt.name.toLowerCase().includes(target) ||
        pt.id.toLowerCase().includes(target) ||
        (target.includes('housing') && pt.role === 'housing')
      if (hit) removedNames.push(pt.name)
      return !hit
    })
    if (spec.parts.length === 0) {
      spec.parts = currentSpec.parts.slice(1)
    }
    if (spec.parts.length < before) {
      spec.id = `${spec.id.replace(/-rev\d+$/, '')}-rev${Date.now() % 10000}`
      return {
        spec,
        explanation: `Removed ${removedNames.join(', ')} from ${spec.title} (${spec.parts.length} parts remaining).`,
      }
    }
  }

  // 2. Add a new part to the current assembly
  if (/^(?:add|attach|include|mount|put|insert)\b/i.test(lower)) {
    const countMatch = /(\d+)\s*(?:blade|vane|fin|spoke|bolt|leg|arm|tooth|teeth|coil)/i.exec(lower)
    const count = countMatch ? Math.max(2, Math.min(24, parseInt(countMatch[1], 10))) : 6
    const speedParam = spec.parameters.find((p) => ['rpm', 'n_motor', 'n'].includes(p.id))?.id ?? '120'
    const speedExpr = speedParam === '120' ? 2.5 : `${speedParam} / 60 * 0.35`

    let newPart: NotePartSpec
    if (lower.includes('fan') || lower.includes('impeller') || lower.includes('propeller') || lower.includes('blade')) {
      newPart = {
        id: `added-fan-${Date.now() % 1000}`,
        name: `${count}-Blade Axial Cooling Fan`,
        material: 'aluminium',
        role: 'moving',
        cut: false,
        position: [-0.18, 0, 0],
        rotation: [0, 0, Math.PI / 2],
        explode: [-0.14, 0, 0],
        motion: { kind: 'rotate', axis: 'y', speed: speedExpr },
        info: {
          summary: `Auxiliary ${count}-blade axial fan mounted on the shaft extension for forced air convection.`,
        },
        shapes: [
          { kind: 'cylinder', r: 0.024, h: 0.024, position: [0, 0, 0] },
          {
            kind: 'box',
            sx: 0.065,
            sy: 0.018,
            sz: 0.005,
            radialCount: count,
            radialRadius: 0.048,
            rotation: [0.35, 0, 0],
            position: [0, 0, 0],
          },
        ],
      }
    } else if (lower.includes('hopper') || lower.includes('funnel') || lower.includes('chute') || lower.includes('inlet')) {
      newPart = {
        id: `added-hopper-${Date.now() % 1000}`,
        name: 'Conical Gravity Feed Hopper',
        material: 'galvanised',
        role: 'housing',
        cut: true,
        position: [0, 0.19, 0],
        explode: [0, 0.16, 0],
        info: {
          summary: 'Conical sheet-steel intake hopper feeding material into the main chamber.',
        },
        shapes: [
          { kind: 'cone', op: 'add', rTop: 0.12, rBot: 0.045, h: 0.14, position: [0, 0, 0] },
          { kind: 'cone', op: 'subtract', rTop: 0.112, rBot: 0.038, h: 0.142, position: [0, 0.002, 0] },
        ],
      }
    } else if (lower.includes('flywheel') || lower.includes('disc') || lower.includes('wheel')) {
      newPart = {
        id: `added-flywheel-${Date.now() % 1000}`,
        name: 'Heavy Cast-Iron Inertia Flywheel',
        material: 'castIron',
        role: 'moving',
        cut: false,
        position: [0.19, 0, 0],
        rotation: [0, 0, Math.PI / 2],
        explode: [0.15, 0, 0],
        motion: { kind: 'rotate', axis: 'y', speed: speedExpr },
        info: {
          summary: 'High-inertia rimmed flywheel smoothing torque fluctuations.',
        },
        shapes: [
          { kind: 'tube', rOuter: 0.11, rInner: 0.078, h: 0.036, position: [0, 0, 0] },
          { kind: 'cylinder', r: 0.082, h: 0.014, position: [0, 0, 0] },
          { kind: 'cylinder', r: 0.026, h: 0.044, position: [0, 0, 0] },
        ],
      }
    } else if (lower.includes('spring') || lower.includes('coil') || lower.includes('damper')) {
      newPart = {
        id: `added-spring-${Date.now() % 1000}`,
        name: 'Helical Suspension / Buffer Spring',
        material: 'steelDark',
        role: 'moving',
        cut: false,
        position: [0, -0.14, 0],
        explode: [0, -0.12, 0],
        info: {
          summary: 'Helical compression coil spring isolating vibration and shock loads.',
        },
        shapes: [
          { kind: 'spring', r: 0.042, wireRadius: 0.006, h: 0.1, turns: count, position: [0, 0, 0] },
        ],
      }
    } else if (lower.includes('gear') || lower.includes('pinion')) {
      newPart = {
        id: `added-gear-${Date.now() % 1000}`,
        name: `Auxiliary Transfer Gear (${count * 3}T)`,
        material: 'forged',
        role: 'moving',
        cut: false,
        position: [0, 0, 0.12],
        rotation: [Math.PI / 2, 0, 0],
        explode: [0, 0, 0.14],
        motion: { kind: 'rotate', axis: 'y', speed: speedExpr },
        info: {
          summary: 'Auxiliary power take-off spur gear stage.',
        },
        shapes: [
          { kind: 'gear', teeth: Math.max(12, count * 3), module: 0.003, h: 0.028, rInner: 0.012, position: [0, 0, 0] },
        ],
      }
    } else {
      const partTitle = formatPromptTitle(prompt.replace(/^(?:add|attach|include|mount|put|insert)\s+/i, ''))
      newPart = {
        id: `added-part-${Date.now() % 1000}`,
        name: partTitle,
        material: 'steel',
        role: 'static',
        cut: false,
        position: [0, -0.15, 0],
        explode: [0, -0.12, 0],
        info: {
          summary: `Custom structural component added from instruction: “${prompt}”.`,
        },
        shapes: [
          { kind: 'box', sx: 0.24, sy: 0.024, sz: 0.18, position: [0, 0, 0] },
          {
            kind: 'cylinder',
            r: 0.012,
            h: 0.06,
            radialCount: 4,
            radialRadius: 0.11,
            position: [0, -0.03, 0],
          },
        ],
      }
    }

    spec.parts.push(newPart)
    spec.id = `${spec.id.replace(/-rev\d+$/, '')}-rev${Date.now() % 10000}`
    return {
      spec,
      explanation: `Added new 3D component “${newPart.name}” to ${spec.title} (now ${spec.parts.length} parts).`,
    }
  }

  return null
}

/**
 * Synthesizes specialized 3D CSG assemblies across a broad range of engineering domains,
 * AND includes a Universal Token-Driven Multi-Part Composer (`composeArbitraryMachineFromPrompt`)
 * so ANY prompt constructs a unique 3D assembly matching the user's exact words and parts.
 */
export function compileCompositional3DScene(prompt: string): NoteSceneSpec | null {
  const lower = prompt.toLowerCase()
  const title = formatPromptTitle(prompt)
  const revId = `create-comp-${Date.now() % 100000}`

  // 1. WIND TURBINE / ROTOR / PROPELLER / AXIAL FAN
  if (
    lower.includes('wind') ||
    lower.includes('turbine') ||
    lower.includes('propeller') ||
    lower.includes('windmill') ||
    (lower.includes('fan') && !lower.includes('belt'))
  ) {
    const bladesMatch = /(\d+)\s*(?:blade|vane)/i.exec(prompt)
    const blades = bladesMatch ? Math.max(2, Math.min(12, parseInt(bladesMatch[1], 10))) : 3
    return {
      id: revId,
      title: lower.includes('wind') ? 'Horizontal-Axis Wind Turbine & Nacelle Drive' : title,
      summary: `Aerodynamic ${blades}-blade rotor hub driving a low-speed main shaft and generator inside a sectioned nacelle housing atop a tubular steel tower.`,
      units: 'mm',
      extent: 0.62,
      floorY: -0.26,
      camera: { position: [0.58, 0.38, 0.64], target: [0, 0.04, 0] },
      recommendedCut: { enabled: true, normal: [1, 0, 0], pos: 0 },
      parameters: [
        { id: 'D_rot', label: 'Rotor Swept ØD', symbol: 'D', value: 0.42, min: 0.24, max: 0.64, step: 0.02, unit: 'm' },
        { id: 'v_wind', label: 'Wind / Flow Speed v', symbol: 'v', value: 11, min: 3, max: 25, step: 0.5, unit: 'm/s' },
        { id: 'blades', label: 'Number of Blades B', symbol: 'B', value: blades, min: 2, max: 8, step: 1, unit: 'blades' },
        { id: 'Cp', label: 'Power Coefficient C_p', symbol: 'C_p', value: 0.44, min: 0.2, max: 0.59, step: 0.02, unit: '' },
        { id: 'towerH', label: 'Tower Height H', symbol: 'H', value: 0.28, min: 0.18, max: 0.42, step: 0.02, unit: 'm' },
      ],
      calculations: [
        {
          id: 'A_swept',
          label: 'Swept Rotor Area',
          symbol: 'A',
          formula: '(pi * (D_rot ^ 2)) / 4',
          unit: 'm²',
          latex: 'A = \\frac{\\pi D^2}{4}',
        },
        {
          id: 'P_wind',
          label: 'Extracted Shaft Power (ρ = 1.225 kg/m³)',
          symbol: 'P',
          formula: '0.5 * 1.225 * A_swept * (v_wind ^ 3) * Cp',
          unit: 'W',
          latex: 'P = \\frac{1}{2} \\rho A v^3 C_p',
        },
        {
          id: 'n_rpm',
          label: 'Rotor Speed (TSR λ = 6)',
          symbol: 'n',
          formula: '((6 * v_wind) / (pi * D_rot)) * 60',
          unit: 'rpm',
          latex: 'n = \\frac{60 \\lambda v}{\\pi D}',
        },
        {
          id: 'F_thrust',
          label: 'Axial Tower Thrust Load',
          symbol: 'F_T',
          formula: '0.5 * 1.225 * A_swept * (v_wind ^ 2) * 0.8',
          unit: 'N',
          latex: 'F_T = \\frac{1}{2} \\rho A v^2 C_T',
        },
      ],
      parts: [
        {
          id: 'nacelle-housing',
          name: 'Fibreglass Nacelle Shroud & Stator Casing',
          material: 'paintGrey',
          role: 'housing',
          cut: true,
          position: [0, 'towerH * 0.45', 0],
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0.14, -0.08],
          info: { summary: 'Aerodynamic nacelle enclosure housing the main shaft bearings and synchronous generator.' },
          shapes: [{ kind: 'tube', rOuter: 0.068, rInner: 0.054, h: 0.2, position: [0, 0, 0] }],
        },
        {
          id: 'turbine-tower',
          name: 'Tapered Tubular Steel Mast & Base Flange',
          material: 'galvanised',
          role: 'static',
          cut: false,
          position: [0, '-towerH * 0.08', 0],
          explode: [0, -0.14, 0],
          info: { summary: 'Conical tubular steel tower reacting rotor thrust and overturning bending moment.' },
          shapes: [
            { kind: 'cone', rBot: 0.048, rTop: 0.032, h: 'towerH', position: [0, 0, 0] },
            { kind: 'cylinder', r: 0.095, h: 0.016, position: [0, '-towerH * 0.5', 0] },
          ],
        },
        {
          id: 'rotor-blades-hub',
          name: 'Aerofoil Rotor Blades & Nose Cone Hub',
          material: 'aluminium',
          role: 'moving',
          cut: false,
          position: [0, 'towerH * 0.45', 0.12],
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0, 0.16],
          motion: { kind: 'rotate', axis: 'y', speed: 'v_wind * 0.22' },
          info: { summary: 'Pitch-controlled rotor blades converting wind kinetic energy into shaft torque.' },
          shapes: [
            { kind: 'cone', rBot: 0.046, rTop: 0.008, h: 0.075, position: [0, 0.025, 0] },
            {
              kind: 'box',
              sx: 'D_rot * 0.46',
              sy: 0.012,
              sz: 0.036,
              radialCount: 'blades',
              radialRadius: 'D_rot * 0.24',
              position: [0, 0, 0],
            },
          ],
        },
        {
          id: 'generator-shaft-core',
          name: 'Main Drive Shaft & Copper Generator Rotor',
          material: 'copper',
          role: 'moving',
          cut: false,
          position: [0, 'towerH * 0.45', 0],
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0.06, 0],
          motion: { kind: 'rotate', axis: 'y', speed: 'v_wind * 0.22' },
          info: { summary: 'Low-speed forged shaft and permanent-magnet copper generator rotor inside the nacelle.' },
          shapes: [
            { kind: 'cylinder', r: 0.016, h: 0.24, position: [0, 0.02, 0] },
            { kind: 'cylinder', r: 0.046, h: 0.085, position: [0, -0.02, 0] },
          ],
        },
      ],
    }
  }

  // 2. SCREW CONVEYOR / AUGER / EXTRUDER / ARCHIMEDES SCREW
  if (lower.includes('auger') || lower.includes('screw conveyor') || lower.includes('extruder') || lower.includes('archimedes')) {
    return {
      id: revId,
      title,
      summary:
        'Helical flighting screw auger rotating inside a sectioned tubular trough with intake feed hopper, drive motor shaft, and live volumetric throughput & power calculations.',
      units: 'mm',
      extent: 0.56,
      floorY: -0.2,
      camera: { position: [0.52, 0.36, 0.58], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'D_scr', label: 'Auger Screw ØD', symbol: 'D', value: 0.16, min: 0.09, max: 0.28, step: 0.01, unit: 'm' },
        { id: 'L_scr', label: 'Conveyor Trough Length L', symbol: 'L', value: 0.42, min: 0.26, max: 0.6, step: 0.02, unit: 'm' },
        { id: 'turns', label: 'Helical Flight Turns N', symbol: 'N', value: 6, min: 3, max: 12, step: 1, unit: 'turns' },
        { id: 'rpm', label: 'Auger Speed n', symbol: 'n', value: 180, min: 40, max: 450, step: 10, unit: 'rpm' },
        { id: 'rho', label: 'Bulk Density ρ_b', symbol: '\\rho_b', value: 750, min: 400, max: 1600, step: 50, unit: 'kg/m³' },
      ],
      calculations: [
        {
          id: 'pitch',
          label: 'Helix Pitch S = L / N',
          symbol: 'S',
          formula: '(L_scr / turns) * 1000',
          unit: 'mm',
          latex: 'S = \\frac{L}{N}',
        },
        {
          id: 'Q_vol',
          label: 'Volumetric Throughput (ψ = 0.45)',
          symbol: 'Q_v',
          formula: '60 * ((pi * (D_scr ^ 2)) / 4) * (L_scr / turns) * rpm * 0.45',
          unit: 'm³/h',
          latex: 'Q_v = 60 \\frac{\\pi D^2}{4} S \\, n \\, \\psi',
        },
        {
          id: 'm_dot',
          label: 'Mass Conveying Capacity',
          symbol: '\\dot{m}',
          formula: '(Q_vol * rho) / 1000',
          unit: 't/h',
          latex: '\\dot{m} = \\rho_b Q_v',
        },
      ],
      parts: [
        {
          id: 'trough-casing',
          name: 'Tubular Steel Conveyor Casing & Feed Hopper',
          material: 'galvanised',
          role: 'housing',
          cut: true,
          rotation: [0, 0, Math.PI / 2],
          explode: [0, 0.14, 0],
          info: { summary: 'Enclosed tubular casing and conical inlet hopper guiding bulk material along the screw.' },
          shapes: [
            { kind: 'tube', rOuter: 'D_scr * 0.5 + 0.018', rInner: 'D_scr * 0.5 + 0.006', h: 'L_scr', position: [0, 0, 0] },
            {
              kind: 'cone',
              rTop: 0.085,
              rBot: 0.04,
              h: 0.1,
              rotation: [0, 0, -Math.PI / 2],
              position: ['D_scr * 0.5 + 0.05', '-L_scr * 0.34', 0],
            },
          ],
        },
        {
          id: 'helical-auger-rotor',
          name: 'Helical Auger Flighting & Centre Pipe Shaft',
          material: 'steel',
          role: 'moving',
          cut: false,
          rotation: [0, 0, Math.PI / 2],
          explode: [0.14, 0, 0],
          motion: { kind: 'rotate', axis: 'y', speed: 'rpm / 60 * 0.5' },
          info: { summary: 'Continuous helical screw flight welded to a hollow steel drive shaft.' },
          shapes: [
            { kind: 'cylinder', r: 'D_scr * 0.16', h: 'L_scr + 0.12', position: [0, 0, 0] },
            {
              kind: 'spring',
              r: 'D_scr * 0.38',
              wireRadius: 'D_scr * 0.1',
              h: 'L_scr * 0.92',
              turns: 'turns',
              position: [0, 0, 0],
            },
          ],
        },
      ],
    }
  }

  // 3. BENCH VICE / CLAMP / SCREW JACK / SCISSOR JACK
  if (lower.includes('vice') || lower.includes('vise') || lower.includes('clamp') || lower.includes('jack')) {
    return {
      id: revId,
      title,
      summary:
        'Heavy cast-iron fixed jaw body, translating sliding jaw, power lead screw with tommy-bar handle, and live thread helix angle, mechanical advantage & clamping force calculations.',
      units: 'mm',
      extent: 0.48,
      floorY: -0.18,
      camera: { position: [0.48, 0.34, 0.54], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'jawGap', label: 'Jaw Opening Span', symbol: 'x', value: 0.11, min: 0.03, max: 0.22, step: 0.01, unit: 'm' },
        { id: 'jawW', label: 'Jaw Width w', symbol: 'w', value: 0.125, min: 0.08, max: 0.18, step: 0.005, unit: 'm' },
        { id: 'd_m', label: 'Lead Screw Mean Ød_m', symbol: 'd_m', value: 0.026, min: 0.016, max: 0.04, step: 0.002, unit: 'm' },
        { id: 'lead', label: 'Thread Pitch / Lead l', symbol: 'l', value: 0.005, min: 0.003, max: 0.01, step: 0.001, unit: 'm' },
        { id: 'F_hand', label: 'Handle Effort Force F_h', symbol: 'F_h', value: 180, min: 40, max: 400, step: 10, unit: 'N' },
      ],
      calculations: [
        {
          id: 'T_in',
          label: 'Input Handle Torque (L_h = 200 mm)',
          symbol: 'T',
          formula: 'F_hand * 0.2',
          unit: 'N·m',
          latex: 'T = F_h L_h',
        },
        {
          id: 'F_clamp',
          label: 'Axial Clamping Force (μ = 0.15)',
          symbol: 'W',
          formula: '((2 * T_in) / (d_m * ((lead + pi * 0.15 * d_m) / (pi * d_m - 0.15 * lead)))) / 1000',
          unit: 'kN',
          latex: 'W = \\frac{2T}{d_m \\tan(\\alpha + \\phi)}',
        },
        {
          id: 'MA',
          label: 'Mechanical Advantage',
          symbol: 'MA',
          formula: '(F_clamp * 1000) / F_hand',
          unit: '×',
          latex: 'MA = \\frac{W}{F_h}',
        },
      ],
      parts: [
        {
          id: 'fixed-jaw-body',
          name: 'Cast-Iron Fixed Base & Guideway Body',
          material: 'paintBlue',
          role: 'housing',
          cut: true,
          explode: [-0.08, -0.06, 0],
          info: { summary: 'Stationary cast-iron body bolted to the workbench, housing the bronze nut.' },
          shapes: [
            { kind: 'box', sx: 0.34, sy: 0.045, sz: 'jawW', position: [0, -0.05, 0] },
            { kind: 'box', sx: 0.055, sy: 0.12, sz: 'jawW', position: [-0.11, 0.02, 0] },
          ],
        },
        {
          id: 'sliding-jaw',
          name: 'Translating Sliding Jaw & Serrated Face',
          material: 'castIron',
          role: 'moving',
          cut: false,
          position: ['jawGap - 0.04', 0.02, 0],
          explode: [0.1, 0.08, 0],
          motion: { kind: 'translate', axis: 'x', speed: 0.8, amplitude: 0.025 },
          info: { summary: 'Movable jaw driven linearly by the acme lead screw.' },
          shapes: [{ kind: 'box', sx: 0.055, sy: 0.12, sz: 'jawW', position: [0, 0, 0] }],
        },
        {
          id: 'acme-lead-screw',
          name: 'Acme Power Lead Screw & Tommy Bar',
          material: 'steel',
          role: 'moving',
          cut: false,
          position: [0.04, -0.05, 0],
          rotation: [0, 0, Math.PI / 2],
          explode: [0.16, 0, 0],
          motion: { kind: 'rotate', axis: 'y', speed: 2.2 },
          info: { summary: 'Square/Acme threaded power screw converting handle torque into axial clamping thrust.' },
          shapes: [
            { kind: 'cylinder', r: 'd_m * 0.5', h: 0.36, position: [0, 0, 0] },
            { kind: 'cylinder', r: 0.008, h: 0.18, rotation: [Math.PI / 2, 0, 0], position: [0, 0.17, 0] },
          ],
        },
      ],
    }
  }

  // 4. VALVE (BALL VALVE / GATE VALVE / GLOBE VALVE / BUTTERFLY VALVE)
  if (lower.includes('valve') || lower.includes('faucet') || lower.includes('tap') || lower.includes('nozzle')) {
    return {
      id: revId,
      title,
      summary:
        'Sectioned flanged valve body with rotating perforated closure element, stem packing gland, manual quarter-turn actuator lever, and live Cv flow coefficient & pressure drop calculations.',
      units: 'mm',
      extent: 0.44,
      floorY: -0.18,
      camera: { position: [0.44, 0.32, 0.5], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'boreD', label: 'Nominal Pipe Bore ØD', symbol: 'D', value: 0.08, min: 0.04, max: 0.16, step: 0.005, unit: 'm' },
        { id: 'dP_bar', label: 'Pressure Drop Δp', symbol: '\\Delta p', value: 1.5, min: 0.2, max: 10, step: 0.2, unit: 'bar' },
        { id: 'openPct', label: 'Valve Opening %', symbol: '\\theta', value: 85, min: 10, max: 100, step: 5, unit: '%' },
      ],
      calculations: [
        {
          id: 'A_flow',
          label: 'Effective Orifice Area',
          symbol: 'A_e',
          formula: '((pi * (boreD ^ 2)) / 4) * (openPct / 100) * 10000',
          unit: 'cm²',
          latex: 'A_e = \\frac{\\pi D^2}{4} \\cdot \\frac{\\theta}{100}',
        },
        {
          id: 'v_jet',
          label: 'Throat Flow Velocity (Cd = 0.82)',
          symbol: 'v',
          formula: '0.82 * sqrt((2 * dP_bar * 100000) / 1000)',
          unit: 'm/s',
          latex: 'v = C_d \\sqrt{\\frac{2 \\Delta p}{\\rho}}',
        },
        {
          id: 'Q_m3h',
          label: 'Volumetric Flow Rate Q',
          symbol: 'Q',
          formula: '(A_flow / 10000) * v_jet * 3600',
          unit: 'm³/h',
          latex: 'Q = A_e \\, v',
        },
      ],
      parts: [
        {
          id: 'valve-body',
          name: 'Flanged Bronze Valve Body & Bonnet',
          material: 'bronze',
          role: 'housing',
          cut: true,
          rotation: [0, 0, Math.PI / 2],
          explode: [0, 0.12, 0],
          info: { summary: 'Pressure-retaining flanged valve housing with PTFE seat rings.' },
          shapes: [
            { kind: 'tube', rOuter: 'boreD * 0.72', rInner: 'boreD * 0.5', h: 0.24, position: [0, 0, 0] },
            { kind: 'tube', rOuter: 'boreD * 1.05', rInner: 'boreD * 0.5', h: 0.022, position: [0, -0.11, 0] },
            { kind: 'tube', rOuter: 'boreD * 1.05', rInner: 'boreD * 0.5', h: 0.022, position: [0, 0.11, 0] },
          ],
        },
        {
          id: 'closure-ball-plug',
          name: 'Perforated Chrome Ball Sphere & Stem',
          material: 'chrome',
          role: 'moving',
          cut: false,
          explode: [0, 0.08, 0],
          motion: { kind: 'oscillate', axis: 'y', speed: 0.6, amplitude: 0.75 },
          info: { summary: 'Precision-ground stainless ball with through-bore rotating 90° between open and shut.' },
          shapes: [
            { kind: 'sphere', op: 'add', r: 'boreD * 0.64', position: [0, 0, 0] },
            {
              kind: 'cylinder',
              op: 'subtract',
              r: 'boreD * 0.45',
              h: 'boreD * 1.5',
              rotation: [0, 0, Math.PI / 2],
              position: [0, 0, 0],
            },
            { kind: 'cylinder', op: 'add', r: 0.012, h: 0.11, position: [0, 'boreD * 0.65', 0] },
          ],
        },
        {
          id: 'actuator-lever',
          name: 'Quarter-Turn Operating Lever Handle',
          material: 'paintYellow',
          role: 'moving',
          cut: false,
          position: [0, 'boreD * 0.65 + 0.055', 0],
          explode: [0, 0.16, 0],
          motion: { kind: 'oscillate', axis: 'y', speed: 0.6, amplitude: 0.75 },
          info: { summary: 'Manual lever handle providing visual indication of valve port orientation.' },
          shapes: [{ kind: 'box', sx: 0.16, sy: 0.012, sz: 0.024, position: [0.065, 0, 0] }],
        },
      ],
    }
  }

  // 5. COFFEE GRINDER / CONICAL BURR MILL / CRUSHER / PULVERIZER / MIXER / ROASTER
  if (
    lower.includes('grinder') ||
    lower.includes('burr') ||
    lower.includes('crusher') ||
    lower.includes('pulverizer') ||
    lower.includes('blender') ||
    lower.includes('mixer') ||
    lower.includes('roaster')
  ) {
    return {
      id: revId,
      title,
      summary:
        'Sectioned cylindrical chamber with top conical feed hopper, rotating fluted conical burr / agitator rotor, central drive shaft, and live torque, tip speed & throughput calculations.',
      units: 'mm',
      extent: 0.48,
      floorY: -0.22,
      camera: { position: [0.46, 0.36, 0.52], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'D_burr', label: 'Rotor / Burr Outer ØD', symbol: 'D', value: 0.14, min: 0.06, max: 0.26, step: 0.01, unit: 'm' },
        { id: 'gap', label: 'Grind / Clearance Gap δ', symbol: '\\delta', value: 0.8, min: 0.2, max: 3.0, step: 0.1, unit: 'mm' },
        { id: 'rpm', label: 'Operating Speed n', symbol: 'n', value: 450, min: 60, max: 1800, step: 30, unit: 'rpm' },
        { id: 'P_w', label: 'Drive Power P', symbol: 'P', value: 750, min: 100, max: 4000, step: 50, unit: 'W' },
      ],
      calculations: [
        {
          id: 'v_tip',
          label: 'Peripheral Cutting Speed',
          symbol: 'v_t',
          formula: '(pi * D_burr * rpm) / 60',
          unit: 'm/s',
          latex: 'v_t = \\frac{\\pi D n}{60}',
        },
        {
          id: 'T_shaft',
          label: 'Rotor Shaft Torque',
          symbol: 'T',
          formula: '(P_w * 60) / (2 * pi * rpm)',
          unit: 'N·m',
          latex: 'T = \\frac{60 P}{2\\pi n}',
        },
        {
          id: 'Q_g_s',
          label: 'Mass Throughput Rate',
          symbol: '\\dot{m}',
          formula: 'D_burr * gap * rpm * 0.42',
          unit: 'g/s',
          latex: '\\dot{m} \\propto D \\cdot \\delta \\cdot n',
        },
      ],
      parts: [
        {
          id: 'upper-hopper-housing',
          name: 'Conical Feed Hopper & Outer Chamber Body',
          material: 'aluminium',
          role: 'housing',
          cut: true,
          explode: [0, 0.14, 0],
          info: { summary: 'Sectioned upper hopper and stator ring guiding material into the milling zone.' },
          shapes: [
            { kind: 'cone', op: 'add', rTop: 'D_burr * 0.85', rBot: 'D_burr * 0.55', h: 0.12, position: [0, 0.1, 0] },
            { kind: 'cone', op: 'subtract', rTop: 'D_burr * 0.79', rBot: 'D_burr * 0.48', h: 0.125, position: [0, 0.102, 0] },
            { kind: 'tube', rOuter: 'D_burr * 0.65', rInner: 'D_burr * 0.52', h: 0.16, position: [0, -0.04, 0] },
          ],
        },
        {
          id: 'conical-burr-rotor',
          name: 'Rotating Fluted Conical Burr & Drive Shaft',
          material: 'steelDark',
          role: 'moving',
          cut: false,
          explode: [0, 0.05, 0],
          motion: { kind: 'rotate', axis: 'y', speed: 'rpm / 60 * 0.25' },
          info: { summary: 'Hardened steel conical rotor shearing and sizing particles across gap δ.' },
          shapes: [
            { kind: 'cylinder', r: 0.012, h: 0.28, position: [0, 0.02, 0] },
            { kind: 'cone', rBot: 'D_burr * 0.48', rTop: 'D_burr * 0.22', h: 0.085, position: [0, -0.02, 0] },
            {
              kind: 'box',
              sx: 'D_burr * 0.46',
              sy: 0.018,
              sz: 0.008,
              radialCount: 6,
              radialRadius: 'D_burr * 0.26',
              position: [0, -0.045, 0],
            },
          ],
        },
        {
          id: 'lower-collection-vessel',
          name: 'Lower Discharge Collector Base',
          material: 'glass',
          role: 'static',
          cut: true,
          position: [0, -0.15, 0],
          explode: [0, -0.12, 0],
          info: { summary: 'Lower collection chamber receiving ground product.' },
          shapes: [
            { kind: 'tube', rOuter: 'D_burr * 0.62', rInner: 'D_burr * 0.55', h: 0.09, position: [0, 0, 0] },
            { kind: 'cylinder', r: 'D_burr * 0.62', h: 0.012, position: [0, -0.045, 0] },
          ],
        },
      ],
    }
  }

  // 6. RACK AND PINION STEERING / LINEAR ACTUATOR
  if (lower.includes('rack') || lower.includes('steering')) {
    return {
      id: revId,
      title,
      summary:
        'Meshing involute spur pinion and linear toothed rack bar inside a sectioned aluminium steering housing with tie-rod ends and live linear displacement, velocity & thrust force calculations.',
      units: 'mm',
      extent: 0.52,
      floorY: -0.18,
      camera: { position: [0.46, 0.34, 0.52], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0.01 },
      parameters: [
        { id: 'z_p', label: 'Pinion Teeth z', symbol: 'z', value: 18, min: 12, max: 30, step: 1, unit: 'teeth' },
        { id: 'm', label: 'Module m', symbol: 'm', value: 0.003, min: 0.002, max: 0.005, step: 0.0005, unit: 'm' },
        { id: 'T_in', label: 'Steering / Pinion Torque T', symbol: 'T', value: 45, min: 10, max: 180, step: 5, unit: 'N·m' },
        { id: 'rpm', label: 'Pinion Speed n', symbol: 'n', value: 60, min: 10, max: 240, step: 10, unit: 'rpm' },
        { id: 'rackL', label: 'Rack Bar Length L', symbol: 'L', value: 0.38, min: 0.24, max: 0.55, step: 0.02, unit: 'm' },
      ],
      calculations: [
        {
          id: 'd_pitch',
          label: 'Pinion Pitch Diameter d = m·z',
          symbol: 'd_p',
          formula: 'm * z_p * 1000',
          unit: 'mm',
          latex: 'd_p = m \\, z',
        },
        {
          id: 'x_rev',
          label: 'Rack Travel per Pinion Rev',
          symbol: 's_{rev}',
          formula: 'pi * m * z_p * 1000',
          unit: 'mm/rev',
          latex: 's = \\pi m z',
        },
        {
          id: 'F_rack',
          label: 'Linear Rack Thrust Force (η = 94%)',
          symbol: 'F_r',
          formula: '(0.94 * 2 * T_in) / (m * z_p) / 1000',
          unit: 'kN',
          latex: 'F_r = \\frac{2 \\eta T}{m z}',
        },
        {
          id: 'v_lin',
          label: 'Linear Rack Velocity',
          symbol: 'v',
          formula: '(pi * m * z_p * rpm) / 60',
          unit: 'm/s',
          latex: 'v = \\omega r_p',
        },
      ],
      parts: [
        {
          id: 'rack-guide-housing',
          name: 'Die-Cast Aluminium Rack Tube Housing',
          material: 'aluminium',
          role: 'housing',
          cut: true,
          explode: [0, -0.12, 0],
          info: { summary: 'Tubular guide housing supporting the translating rack bar and pinion bearings.' },
          shapes: [
            { kind: 'box', op: 'add', sx: 'rackL * 0.75', sy: 0.056, sz: 0.068, position: [0, -0.022, 0] },
            { kind: 'box', op: 'subtract', sx: 'rackL * 0.72', sy: 0.04, sz: 0.048, position: [0, -0.018, 0] },
          ],
        },
        {
          id: 'toothed-rack-bar',
          name: 'Linear Toothed Steel Rack & Tie-Rods',
          material: 'steel',
          role: 'moving',
          cut: false,
          position: [0, -0.02, 0],
          explode: [0.14, 0, 0],
          motion: { kind: 'translate', axis: 'x', speed: 0.85, amplitude: 0.055 },
          info: { summary: 'Broached linear rack bar converting pinion rotation into lateral force.' },
          shapes: [
            { kind: 'rack', sx: 'rackL', sy: 0.028, sz: 0.032, teeth: 24, position: [0, 0, 0] },
          ],
        },
        {
          id: 'steering-pinion-shaft',
          name: 'Meshing Spur Pinion & Input Shaft',
          material: 'forged',
          role: 'moving',
          cut: false,
          position: [0, 'm * z_p * 0.5', 0],
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0.14, 0.08],
          motion: { kind: 'oscillate', axis: 'y', speed: 0.85, amplitude: 1.6 },
          info: { summary: 'Input pinion gear meshing with the linear rack teeth.' },
          shapes: [
            { kind: 'gear', teeth: 'z_p', module: 'm', h: 0.034, rInner: 0.008, position: [0, 0, 0] },
            { kind: 'cylinder', r: 0.011, h: 0.14, position: [0, -0.05, 0] },
          ],
        },
      ],
    }
  }

  // 7. ROBOTIC ARM / MANIPULATOR / EXCAVATOR BOOM / CRANE HOIST
  if (lower.includes('robot') || lower.includes('arm') || lower.includes('crane') || lower.includes('excavator') || lower.includes('gripper')) {
    return {
      id: revId,
      title,
      summary:
        'Articulated robotic manipulator arm with slewing waist turret base, shoulder actuator, tubular lower & upper boom links, and parallel-jaw end-effector gripper with live reach & joint torque calculations.',
      units: 'mm',
      extent: 0.58,
      floorY: -0.22,
      camera: { position: [0.54, 0.38, 0.6], target: [0, 0.04, 0] },
      recommendedCut: { enabled: false, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'L1', label: 'Lower Boom Length L₁', symbol: 'L_1', value: 0.22, min: 0.12, max: 0.36, step: 0.01, unit: 'm' },
        { id: 'L2', label: 'Forearm Link Length L₂', symbol: 'L_2', value: 0.18, min: 0.1, max: 0.32, step: 0.01, unit: 'm' },
        { id: 'm_pay', label: 'Gripper Payload Mass m_p', symbol: 'm_p', value: 12, min: 1, max: 50, step: 1, unit: 'kg' },
        { id: 'm_arm', label: 'Arm Structural Mass m_a', symbol: 'm_a', value: 8.5, min: 2, max: 25, step: 0.5, unit: 'kg' },
      ],
      calculations: [
        {
          id: 'R_max',
          label: 'Maximum Horizontal Reach (L₁ + L₂)',
          symbol: 'R_{max}',
          formula: '(L1 + L2) * 1000',
          unit: 'mm',
          latex: 'R_{\\max} = L_1 + L_2',
        },
        {
          id: 'M_shoulder',
          label: 'Peak Shoulder Holding Torque',
          symbol: 'M_s',
          formula: '9.81 * (m_pay * (L1 + L2) + m_arm * ((L1 + L2) * 0.45))',
          unit: 'N·m',
          latex: 'M_s = g \\left(m_p (L_1+L_2) + m_a r_{\\text{cg}}\\right)',
          limit: { kind: 'max', value: 250, label: 'Servo Limit 250 N·m' },
        },
        {
          id: 'M_elbow',
          label: 'Peak Elbow Joint Torque',
          symbol: 'M_e',
          formula: '9.81 * (m_pay * L2 + (m_arm * 0.4) * (L2 * 0.5))',
          unit: 'N·m',
          latex: 'M_e = g (m_p L_2 + 0.2 m_a L_2)',
        },
      ],
      parts: [
        {
          id: 'slewing-base-turret',
          name: 'Cast-Iron Pedestal & Slewing Ring Turret',
          material: 'castIron',
          role: 'housing',
          cut: true,
          position: [-0.1, -0.14, 0],
          explode: [0, -0.12, 0],
          info: { summary: 'Heavy base pedestal anchoring the arm and housing the waist azimuth servo.' },
          shapes: [
            { kind: 'cylinder', r: 0.095, h: 0.032, position: [0, -0.04, 0] },
            { kind: 'cylinder', r: 0.058, h: 0.075, position: [0, 0.01, 0] },
          ],
        },
        {
          id: 'lower-boom-link',
          name: 'Shoulder Joint & Lower Arm Link (L₁)',
          material: 'paintOrange',
          role: 'moving',
          cut: false,
          position: [-0.06, -0.02, 0],
          rotation: [0, 0, -0.45],
          explode: [-0.06, 0.06, 0],
          motion: { kind: 'oscillate', axis: 'z', speed: 0.65, amplitude: 0.18 },
          info: { summary: 'Primary structural boom link carrying the full overturning moment.' },
          shapes: [
            { kind: 'cylinder', r: 0.036, h: 0.068, rotation: [Math.PI / 2, 0, 0], position: [0, -0.08, 0] },
            { kind: 'box', sx: 0.038, sy: 'L1', sz: 0.042, position: [0, 'L1 * 0.35 - 0.06', 0] },
          ],
        },
        {
          id: 'forearm-and-gripper',
          name: 'Elbow Joint, Forearm (L₂) & Parallel Gripper',
          material: 'aluminium',
          role: 'moving',
          cut: false,
          position: [0.06, 'L1 * 0.6', 0],
          explode: [0.12, 0.12, 0],
          motion: { kind: 'oscillate', axis: 'z', speed: 0.65, amplitude: 0.28 },
          info: { summary: 'Lightweight aluminium forearm link and two-finger parallel gripper.' },
          shapes: [
            { kind: 'cylinder', r: 0.028, h: 0.056, rotation: [Math.PI / 2, 0, 0], position: [-0.05, 0, 0] },
            { kind: 'box', sx: 'L2', sy: 0.03, sz: 0.032, position: ['L2 * 0.45 - 0.04', 0, 0] },
            { kind: 'box', sx: 0.045, sy: 0.012, sz: 0.014, position: ['L2 + 0.01', 0.024, 0] },
            { kind: 'box', sx: 0.045, sy: 0.012, sz: 0.014, position: ['L2 + 0.01', -0.024, 0] },
          ],
        },
      ],
    }
  }

  // 8. 3-JAW LATHE CHUCK / WORKHOLDING SPINDLE
  if (lower.includes('chuck') || lower.includes('lathe')) {
    return {
      id: revId,
      title: 'Three-Jaw Self-Centering Scroll Lathe Chuck',
      summary:
        'Cylindrical forged-steel chuck body with internal spiral scroll plate, 3 radially translating stepped hard jaws, and hollow headstock spindle with live clamping force & centrifugal jaw loss calculations.',
      units: 'mm',
      extent: 0.44,
      floorY: -0.2,
      camera: { position: [0.44, 0.32, 0.48], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [1, 0, 0], pos: 0 },
      parameters: [
        { id: 'D_chuck', label: 'Chuck Body ØD', symbol: 'D', value: 0.24, min: 0.16, max: 0.36, step: 0.02, unit: 'm' },
        { id: 'd_work', label: 'Clamped Workpiece Ød', symbol: 'd_w', value: 0.075, min: 0.02, max: 0.16, step: 0.005, unit: 'm' },
        { id: 'F_jaw0', label: 'Static Total Jaw Clamping Force', symbol: 'F_0', value: 28, min: 5, max: 60, step: 1, unit: 'kN' },
        { id: 'rpm', label: 'Spindle Speed n', symbol: 'n', value: 1800, min: 200, max: 4500, step: 100, unit: 'rpm' },
      ],
      calculations: [
        {
          id: 'F_cent',
          label: 'Centrifugal Jaw Unclamping Force (3 jaws × 0.8 kg)',
          symbol: 'F_c',
          formula: '3 * 0.8 * (((2 * pi * rpm) / 60) ^ 2) * (D_chuck * 0.32) / 1000',
          unit: 'kN',
          latex: 'F_c = 3 m_j \\omega^2 r_g',
        },
        {
          id: 'F_eff',
          label: 'Effective Dynamic Grip Force (F₀ − F_c)',
          symbol: 'F_{eff}',
          formula: 'F_jaw0 - F_cent',
          unit: 'kN',
          latex: 'F_{\\text{eff}} = F_0 - F_c',
          limit: { kind: 'min', value: 8, label: 'Min Safe Grip 8 kN' },
        },
        {
          id: 'T_slip',
          label: 'Max Cutting Torque Before Slip (μ = 0.25)',
          symbol: 'T_{max}',
          formula: '0.25 * (F_eff * 1000) * (d_work * 0.5)',
          unit: 'N·m',
          latex: 'T_{\\max} = \\mu F_{\\text{eff}} \\frac{d_w}{2}',
        },
      ],
      parts: [
        {
          id: 'chuck-body',
          name: 'Forged-Steel Chuck Body & Scroll Ring',
          material: 'steel',
          role: 'housing',
          cut: true,
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0, -0.1],
          motion: { kind: 'rotate', axis: 'y', speed: 'rpm / 60 * 0.2' },
          info: { summary: 'Precision-ground cylindrical body with radial T-slots and spiral scroll plate.' },
          shapes: [
            { kind: 'tube', rOuter: 'D_chuck * 0.5', rInner: 0.032, h: 0.078, position: [0, 0, 0] },
          ],
        },
        {
          id: 'three-stepped-jaws',
          name: '3 × Self-Centering Hardened Master Jaws',
          material: 'steelDark',
          role: 'moving',
          cut: false,
          rotation: [Math.PI / 2, 0, 0],
          explode: [0, 0, 0.12],
          motion: { kind: 'rotate', axis: 'y', speed: 'rpm / 60 * 0.2' },
          info: { summary: 'Three stepped jaws moving radially in unison via the scroll thread.' },
          shapes: [
            {
              kind: 'box',
              sx: 'D_chuck * 0.28',
              sy: 0.042,
              sz: 0.026,
              radialCount: 3,
              radialRadius: 'd_work * 0.5 + D_chuck * 0.14',
              position: [0, 0.048, 0],
            },
          ],
        },
      ],
    }
  }

  // 9. QUADCOPTER / AGRICULTURAL DRONE / UAV
  if (lower.includes('drone') || lower.includes('quadcopter') || lower.includes('uav') || lower.includes('multirotor')) {
    return {
      id: revId,
      title: 'Quadcopter Agricultural Spraying & Survey Drone',
      summary:
        'Four-arm carbon-fibre airframe with underslung liquid spray tank, landing gear skids, and four brushless outrunner motors driving high-thrust propellers with live hover power & endurance calculations.',
      units: 'mm',
      extent: 0.58,
      floorY: -0.18,
      camera: { position: [0.52, 0.38, 0.56], target: [0, 0, 0] },
      recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0 },
      parameters: [
        { id: 'D_prop', label: 'Propeller Diameter D_p', symbol: 'D_p', value: 0.18, min: 0.1, max: 0.28, step: 0.01, unit: 'm' },
        { id: 'armL', label: 'Motor Arm Radius R_a', symbol: 'R_a', value: 0.2, min: 0.14, max: 0.32, step: 0.01, unit: 'm' },
        { id: 'm_tot', label: 'Take-Off Gross Mass m', symbol: 'm', value: 14, min: 3, max: 35, step: 1, unit: 'kg' },
        { id: 'rpm', label: 'Rotor Hover Speed n', symbol: 'n', value: 4200, min: 1500, max: 8000, step: 100, unit: 'rpm' },
      ],
      calculations: [
        {
          id: 'T_hover',
          label: 'Total Hover Thrust Required (m·g)',
          symbol: 'T',
          formula: 'm_tot * 9.81',
          unit: 'N',
          latex: 'T = m \\, g',
        },
        {
          id: 'A_tot',
          label: 'Total 4-Rotor Disc Area',
          symbol: 'A_d',
          formula: '4 * ((pi * (D_prop ^ 2)) / 4)',
          unit: 'm²',
          latex: 'A_d = 4 \\frac{\\pi D_p^2}{4}',
        },
        {
          id: 'P_ideal',
          label: 'Induced Hover Power (Actuator Disc)',
          symbol: 'P_i',
          formula: '((T_hover ^ 1.5) / sqrt(2 * 1.225 * A_tot)) / 1000',
          unit: 'kW',
          latex: 'P_i = \\frac{T^{3/2}}{\\sqrt{2 \\rho A_d}}',
        },
      ],
      parts: [
        {
          id: 'drone-central-body',
          name: 'Central Avionics Hub & Spray Tank',
          material: 'paintBlack',
          role: 'housing',
          cut: true,
          explode: [0, 0.12, 0],
          info: { summary: 'Central carbon-fibre airframe and underslung polyethylene payload tank.' },
          shapes: [
            { kind: 'cylinder', r: 0.085, h: 0.042, position: [0, 0.02, 0] },
            { kind: 'sphere', r: 0.068, position: [0, -0.04, 0] },
            {
              kind: 'box',
              sx: 'armL * 2',
              sy: 0.016,
              sz: 0.018,
              radialCount: 2,
              radialRadius: 0,
              position: [0, 0.02, 0],
            },
          ],
        },
        {
          id: 'four-rotors-props',
          name: '4 × Brushless Motors & Twin-Blade Propellers',
          material: 'aluminium',
          role: 'moving',
          cut: false,
          position: [0, 0.045, 0],
          explode: [0, 0.16, 0],
          motion: { kind: 'rotate', axis: 'y', speed: 'rpm / 60 * 0.15' },
          info: { summary: 'Four outrunner motors and carbon propellers generating vertical lift.' },
          shapes: [
            {
              kind: 'cylinder',
              r: 0.024,
              h: 0.028,
              radialCount: 4,
              radialRadius: 'armL',
              position: [0, -0.01, 0],
            },
            {
              kind: 'box',
              sx: 'D_prop',
              sy: 0.005,
              sz: 0.022,
              radialCount: 4,
              radialRadius: 'armL',
              position: [0, 0.01, 0],
            },
          ],
        },
      ],
    }
  }

  // 10. UNIVERSAL TOKEN-DRIVEN MULTI-PART COMPOSER FOR ANY OTHER DESCRIPTION
  return composeArbitraryMachineFromPrompt(prompt, revId, title)
}

/**
 * Inspects ANY user prompt for structural, mechanical, fluid, and functional component nouns
 * and dynamically composes a bespoke multi-part 3D CSG assembly matching the user's words!
 */
function composeArbitraryMachineFromPrompt(
  prompt: string,
  revId: string,
  title: string,
): NoteSceneSpec | null {
  const lower = prompt.toLowerCase()

  // Do not intercept prompts that clearly belong to the 13 core templates in createCatalog.ts
  const coreKeywords = [
    'two-stage', 'spur gear reducer', 'planetary', 'epicyclic', 'centrifugal', 'volute',
    'hydraulic cylinder', 'piston engine', 'four-stroke', 'belt drive', 'disc brake',
    'heat exchanger', 'shell-and-tube', 'beam', 'cantilever', 'maize sheller',
    'flanged coupling', 'flanged shaft', 'eccentric cam', 'plummer block', 'journal bearing',
  ]
  if (coreKeywords.some((kw) => lower.includes(kw))) {
    return null
  }

  // Check if this is an edit instruction rather than a machine description
  if (
    /^(make|set|change|increase|decrease|reduce|double|halve|switch|use|update|modify|why|how|what)\b/.test(
      lower.trim(),
    ) ||
    /\b(longer|shorter|wider|narrower|bigger|smaller)\b/.test(lower)
  ) {
    return null
  }

  // Extract numbers from prompt if any
  const kwMatch = /(\d+(?:\.\d+)?)\s*kw\b/i.exec(prompt)
  const rpmMatch = /(\d+(?:\.\d+)?)\s*rpm\b/i.exec(prompt)
  const mmMatch = /(\d+(?:\.\d+)?)\s*mm\b/i.exec(prompt)

  const powerVal = kwMatch ? parseFloat(kwMatch[1]) : 7.5
  const rpmVal = rpmMatch ? parseFloat(rpmMatch[1]) : 900
  const mainDimM = mmMatch ? Math.max(0.08, Math.min(0.45, parseFloat(mmMatch[1]) / 1000)) : 0.24

  // Detect primary material colour/finish if mentioned
  let housingMat: MaterialKey = 'paintGreen'
  if (lower.includes('blue')) housingMat = 'paintBlue'
  else if (lower.includes('red')) housingMat = 'paintRed'
  else if (lower.includes('yellow') || lower.includes('orange')) housingMat = 'paintYellow'
  else if (lower.includes('stainless') || lower.includes('steel')) housingMat = 'steel'
  else if (lower.includes('aluminium') || lower.includes('aluminum')) housingMat = 'aluminium'
  else if (lower.includes('bronze') || lower.includes('brass')) housingMat = 'bronze'
  else if (lower.includes('cast iron')) housingMat = 'castIron'

  const parts: NotePartSpec[] = []

  // A. Outer Enclosure / Casing / Tank / Frame / Drum Body
  const hasHopper = lower.includes('hopper') || lower.includes('funnel') || lower.includes('chute') || lower.includes('inlet')
  const isVertical = lower.includes('vertical') || lower.includes('tower') || lower.includes('column') || lower.includes('silo') || lower.includes('tank')

  parts.push({
    id: 'main-chamber-housing',
    name: isVertical ? `${title} Vertical Shell & Frame` : `${title} Sectioned Main Casing`,
    material: housingMat,
    role: 'housing',
    cut: true,
    rotation: isVertical ? [0, 0, 0] : [0, 0, Math.PI / 2],
    explode: [0, 0.15, 0],
    info: {
      summary: `Primary structural housing and protective enclosure for ${title}.`,
      role: 'Supports internal bearings and contains the working medium; sectioned by Cut Open.',
    },
    shapes: [
      {
        kind: 'tube',
        rOuter: 'D_main * 0.55 + 0.016',
        rInner: 'D_main * 0.55',
        h: 'L_main',
        position: [0, 0, 0],
      },
      {
        kind: 'box',
        sx: 'D_main * 1.1',
        sy: 0.02,
        sz: 'L_main * 0.85',
        rotation: isVertical ? [0, 0, 0] : [0, 0, -Math.PI / 2],
        position: isVertical ? [0, '-L_main * 0.5 - 0.01', 0] : ['-D_main * 0.55 - 0.01', 0, 0],
      },
    ],
  })

  // B. Primary Moving Rotor / Drum / Shaft / Rollers / Blades / Mechanism
  parts.push({
    id: 'primary-working-rotor',
    name: `${title} Driven Rotor & Main Shaft`,
    material: 'steel',
    role: 'moving',
    cut: false,
    rotation: isVertical ? [0, 0, 0] : [0, 0, Math.PI / 2],
    explode: isVertical ? [0, 0.08, 0.12] : [0.14, 0, 0],
    motion: {
      kind: 'rotate',
      axis: 'y',
      speed: 'rpm / 60 * 0.35',
    },
    info: {
      summary: `Central rotating shaft and active working elements of ${title}.`,
      role: 'Transmits input shaft torque to the working elements at speed n.',
    },
    shapes: [
      {
        kind: 'cylinder',
        r: 0.02,
        h: 'L_main + 0.16',
        position: [0, 0, 0],
      },
      {
        kind: 'cylinder',
        r: 'D_main * 0.36',
        h: 'L_main * 0.78',
        position: [0, 0, 0],
      },
      {
        kind: 'box',
        sx: 'D_main * 0.28',
        sy: 'L_main * 0.68',
        sz: 0.01,
        radialCount: 'N_elem',
        radialRadius: 'D_main * 0.38',
        position: [0, 0, 0],
      },
    ],
  })

  // C. Optional Feed Hopper or Top Dome if mentioned (or as intake assembly)
  if (hasHopper || !isVertical) {
    parts.push({
      id: 'intake-feed-assembly',
      name: hasHopper ? 'Conical Gravity Feed Hopper' : 'Top Intake Manifold & Cover',
      material: 'galvanised',
      role: 'housing',
      cut: true,
      position: [0, 'D_main * 0.55 + 0.06', 0],
      explode: [0, 0.18, 0],
      info: {
        summary: 'Upper intake assembly directing material or fluid into the active rotor zone.',
      },
      shapes: [
        {
          kind: 'cone',
          op: 'add',
          rTop: 'D_main * 0.42',
          rBot: 'D_main * 0.22',
          h: 0.1,
          position: [0, 0, 0],
        },
        {
          kind: 'cone',
          op: 'subtract',
          rTop: 'D_main * 0.38',
          rBot: 'D_main * 0.18',
          h: 0.105,
          position: [0, 0.002, 0],
        },
      ],
    })
  }

  // D. Drive Transmission Stage (Pulley / Gear / Motor Coupling)
  parts.push({
    id: 'drive-transmission-stage',
    name: 'Input Drive Sheave & Transmission Hub',
    material: 'castIron',
    role: 'moving',
    cut: false,
    position: isVertical ? [0, '-L_main * 0.5 - 0.05', 0] : ['L_main * 0.5 + 0.06', 0, 0],
    rotation: isVertical ? [0, 0, 0] : [0, 0, Math.PI / 2],
    explode: isVertical ? [0, -0.14, 0] : [0.16, 0, 0],
    motion: {
      kind: 'rotate',
      axis: 'y',
      speed: 'rpm / 60 * 0.35',
    },
    info: {
      summary: 'Input transmission sheave coupling motor power P into the main rotor shaft.',
    },
    shapes: [
      {
        kind: 'pulley',
        rOuter: 'D_main * 0.42',
        rInner: 0.02,
        h: 0.036,
        position: [0, 0, 0],
      },
    ],
  })

  return {
    id: revId,
    title,
    summary: `Custom 3D parametric assembly synthesized for “${prompt.trim()}” with sectioned outer housing, rotating working rotor, intake manifold, drive transmission, and live torque, tip speed & power calculations.`,
    units: 'mm',
    extent: 0.54,
    floorY: -0.22,
    camera: { position: [0.54, 0.38, 0.6], target: [0, 0, 0] },
    recommendedCut: { enabled: true, normal: [0, 0, 1], pos: 0.01 },
    parameters: [
      { id: 'P', label: 'Input Drive Power P', symbol: 'P', value: powerVal, min: 0.5, max: 50, step: 0.5, unit: 'kW' },
      { id: 'rpm', label: 'Operating Speed n', symbol: 'n', value: rpmVal, min: 60, max: 3000, step: 20, unit: 'rpm' },
      { id: 'D_main', label: 'Rotor / Chamber ØD', symbol: 'D', value: mainDimM, min: 0.12, max: 0.44, step: 0.01, unit: 'm' },
      { id: 'L_main', label: 'Assembly Length L', symbol: 'L', value: 0.36, min: 0.2, max: 0.56, step: 0.02, unit: 'm' },
      { id: 'N_elem', label: 'Working Blade / Vane Count N', symbol: 'N', value: 6, min: 3, max: 12, step: 1, unit: 'elements' },
    ],
    calculations: [
      {
        id: 'omega',
        label: 'Angular Velocity ω',
        symbol: '\\omega',
        formula: '(2 * pi * rpm) / 60',
        unit: 'rad/s',
        latex: '\\omega = \\frac{2\\pi n}{60}',
      },
      {
        id: 'T_drive',
        label: 'Operating Shaft Torque (η = 94%)',
        symbol: 'T',
        formula: '(0.94 * P * 1000 * 60) / (2 * pi * rpm)',
        unit: 'N·m',
        latex: 'T = \\frac{60 \\, \\eta P}{2\\pi n}',
      },
      {
        id: 'v_periph',
        label: 'Peripheral Tip Speed',
        symbol: 'v_t',
        formula: '(pi * D_main * rpm) / 60',
        unit: 'm/s',
        latex: 'v_t = \\frac{\\pi D n}{60}',
      },
      {
        id: 'V_chamber',
        label: 'Active Chamber Volume',
        symbol: 'V_c',
        formula: '((pi * (D_main ^ 2)) / 4) * L_main * 1000',
        unit: 'L',
        latex: 'V_c = \\frac{\\pi D^2}{4} L',
      },
    ],
    parts,
  }
}

/**
 * Top-level asynchronous compiler for Create in 3D:
 * 1. Asks Solidify's API (`/v1/create-3d`), which compiles the description or photo into a full
 *    `NoteSceneSpec` with Gemini, as the signed-in student. If the server can't be reached:
 * 2. Checks structural part edits ("add a fan", "add a hopper", "remove housing").
 * 3. Checks compositional 3D machine synthesis (wind turbines, augers, vices/jacks, valves, grinders,
 *    rack & pinion, robotic arms, lathe chucks, drones, or any custom multi-part machine).
 * 4. Runs the 13 core parametric engineering archetypes & parameter editor.
 */
export async function generateOrEdit3DScene(
  prompt: string,
  currentSpec?: NoteSceneSpec,
  photoDataUrl?: string,
): Promise<BuildOrRefineResult & { source: 'gemini' | 'compositional' }> {
  const matchedCatalogScene: CatalogSceneMatch | null = matchCatalogSceneFromPrompt(prompt)

  // 1. Solidify's API, as the signed-in student (sign-in and allowance errors go back to the page to show)
  const backendRes = await callBackendCreate3D(prompt, currentSpec, photoDataUrl)
  if (backendRes) {
    return {
      ...backendRes,
      matchedCatalogScene: backendRes.isNewMachine ? matchedCatalogScene : null,
      source: 'gemini',
    }
  }

  // 3. Check if user is asking to structurally add/remove a 3D part on the active model
  if (currentSpec) {
    const structEdit = tryApplyStructuralPartEdit(prompt, currentSpec)
    if (structEdit) {
      return {
        spec: structEdit.spec,
        explanation: structEdit.explanation,
        isNewMachine: false,
        matchedCatalogScene: null,
        source: 'compositional',
      }
    }
  }

  // 4. Check compositional 3D synthesis for open-ended machines
  const compSpec = compileCompositional3DScene(prompt)
  if (compSpec) {
    return {
      spec: compSpec,
      explanation: `Constructed 3D parametric assembly “${compSpec.title}” with ${compSpec.parts.length} cuttable/animatable parts (${compSpec.parts.map((p) => p.name).join(', ')}) and ${compSpec.calculations?.length ?? 0} live engineering formulas.`,
      isNewMachine: true,
      matchedCatalogScene,
      source: 'compositional',
    }
  }

  // 5. Run parametric archetype & refinement compiler
  const localRes = buildOrRefineModelFromText(prompt, currentSpec)
  return {
    ...localRes,
    source: 'compositional',
  }
}
