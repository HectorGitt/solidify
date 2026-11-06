import { z } from 'zod'
import type { MaterialKey } from '@/render/materials'
import type { PartRole } from '@/parts/registry'

export const ALLOWED_MATERIALS: readonly MaterialKey[] = [
  'castIron',
  'steel',
  'steelMatte',
  'steelDark',
  'chrome',
  'forged',
  'aluminium',
  'bronze',
  'brass',
  'copper',
  'bearing',
  'rubber',
  'friction',
  'gasket',
  'ceramic',
  'plastic',
  'wood',
  'paintGreen',
  'paintYellow',
  'paintRed',
  'paintGrey',
  'paintBlack',
  'paintBlue',
  'paintOrange',
  'galvanised',
  'leather',
  'nylon',
  'concrete',
  'crop',
  'straw',
  'glass',
  'oil',
  'hydraulicOil',
  'coolant',
  'fuel',
  'water',
  'soil',
  'grain',
] as const

export const ALLOWED_ROLES: readonly PartRole[] = [
  'housing',
  'moving',
  'fluid',
  'static',
] as const

export type DimExpr = number | string
export type Vec3Expr = [DimExpr, DimExpr, DimExpr]

export interface NoteParameterSpec {
  id: string
  label: string
  symbol?: string
  value: number
  min: number
  max: number
  step: number
  unit: string
}

export type NoteShapeKind =
  | 'box'
  | 'cylinder'
  | 'tube'
  | 'cone'
  | 'sphere'
  | 'torus'
  | 'lathe'
  | 'extrude'
  | 'gear'
  | 'bevelGear'
  | 'rack'
  | 'pulley'
  | 'sprocket'
  | 'spring'
  | 'hexNut'
  | 'hexBolt'

export interface NoteShapeSpec {
  kind: NoteShapeKind
  /** CSG boolean operation against preceding shapes in the same part (default: 'add') */
  op?: 'add' | 'subtract' | 'intersect'
  /** Local translation [x, y, z] in scene units (meters) */
  position?: Vec3Expr
  /** Local Euler rotation [rx, ry, rz] in radians */
  rotation?: Vec3Expr
  /** Optional circular pattern around Y axis (e.g., bolt circle holes or ribs) */
  radialCount?: DimExpr
  radialRadius?: DimExpr
  // Box: sx, sy, sz
  sx?: DimExpr
  sy?: DimExpr
  sz?: DimExpr
  // Cylinder / Tube / Cone / Gear / Pulley / Sprocket / Spring
  r?: DimExpr
  rTop?: DimExpr
  rBot?: DimExpr
  rOuter?: DimExpr
  rInner?: DimExpr
  h?: DimExpr
  tubeRadius?: DimExpr
  // Gear / Sprocket / Rack
  teeth?: DimExpr
  module?: DimExpr
  pressureAngle?: number
  helixAngle?: number
  pitch?: DimExpr
  // Hex nut / hex bolt: thread diameter (bolt shank length is h)
  d?: DimExpr
  // Spring
  turns?: DimExpr
  wireRadius?: DimExpr
  // Lathe: array of [r, y] points
  profile?: [DimExpr, DimExpr][]
  // Extrude: array of [x, y] points + depth
  polygon?: [DimExpr, DimExpr][]
  depth?: DimExpr
}

export interface NoteMotionSpec {
  kind: 'rotate' | 'oscillate' | 'translate'
  axis: 'x' | 'y' | 'z'
  /** rad/s for rotate, Hz for oscillate/translate (number or parametric expression like "rpm * 2 * pi / 60") */
  speed: DimExpr
  /** radians for oscillate, meters for translate */
  amplitude?: DimExpr
  phase?: number
}

/**
 * Where a part goes, said as a relation to another part instead of coordinates; the assembly solver works
 * out the position (and, for coaxial and mesh, the rotation) from the parts' real geometry.
 * - coaxial: on the target's axis (a gear on a shaft, a shaft through a bore, a bearing on a journal);
 *   `at` = how far along the target, 0 = one end, 1 = the other (default 0.5); `offset` = metres more along it
 * - mesh: a gear meshing with the target gear: axes parallel, centres the sum of the pitch radii apart,
 *   on the `side` given (default: up, or +z when the axis is vertical)
 * - against: touching the target's `face` (+y = sitting on top of it), centred on that face
 * - centered: the same centre as the target (a housing round its gears)
 * `shift` moves the result a little more, in metres, in world axes.
 */
export type NoteMountSpec =
  | { kind: 'coaxial'; target: string; at?: DimExpr; offset?: DimExpr; shift?: Vec3Expr }
  | { kind: 'mesh'; target: string; side?: AxisDir; shift?: Vec3Expr }
  | { kind: 'against'; target: string; face: AxisDir; shift?: Vec3Expr }
  | { kind: 'centered'; target: string; shift?: Vec3Expr }

export type AxisDir = '+x' | '-x' | '+y' | '-y' | '+z' | '-z'

export interface NotePartSpec {
  id: string
  name: string
  material?: MaterialKey
  role?: PartRole
  position?: Vec3Expr
  rotation?: Vec3Expr
  explode?: [number, number, number]
  cut?: boolean
  info?: {
    summary: string
    role?: string
  }
  motion?: NoteMotionSpec
  /** placed by relation to another part (wins over `position`) */
  mount?: NoteMountSpec
  shapes: NoteShapeSpec[]
  children?: NotePartSpec[]
}

export interface NoteAnnotationSpec {
  id: string
  kind: 'force' | 'moment' | 'dimension' | 'label'
  label: string
  /** fixed text for the value (prefer `magnitude`, which follows the sliders) */
  value?: string
  /** the size of the force or moment, as an expression of the model's values (e.g. "P"), shown live */
  magnitude?: DimExpr
  unit?: string
  /** force: the arrow's tail (from) and the point it acts on (to). moment: the centre (from) and a point along its axis (to). */
  from: Vec3Expr
  to?: Vec3Expr
  color?: string
}

export interface NoteCalculationSpec {
  id: string
  label: string
  symbol: string
  /** Math expression evaluated live from `parameters` and preceding calculation IDs */
  formula: string
  unit: string
  /** Optional LaTeX equation string for display */
  latex?: string
  description?: string
  limit?: {
    kind: 'max' | 'min'
    value: DimExpr
    label?: string
  }
}

export interface EvaluatedCalculation {
  spec: NoteCalculationSpec
  value: number
  formatted: string
  status: 'ok' | 'warn'
  limitValue?: number
}

/**
 * A graph worked out live from the model's sizes and results: a bending moment or shear force diagram,
 * stress along a member, a pump or engine curve. Each series is a formula in `x` (plus parameter and
 * calculation ids), sampled from `x.from` to `x.to`.
 */
export interface NoteChartSpec {
  id: string
  title: string
  x: {
    label: string
    unit: string
    from: DimExpr
    to: DimExpr
  }
  y: {
    label: string
    unit: string
  }
  series: { id: string; label: string; formula: string }[]
  /** how many points to draw (default 80; more for sharp steps) */
  samples?: number
}

export interface EvaluatedChart {
  spec: NoteChartSpec
  xs: number[]
  series: { id: string; label: string; ys: number[]; max: { x: number; y: number }; min: { x: number; y: number } }[]
  yMin: number
  yMax: number
}

/** samples each series of a chart over its x range, from the model's live values */
export function evaluateChart(chart: NoteChartSpec, scope: Record<string, number>): EvaluatedChart | null {
  const from = evalDim(chart.x.from, scope, 0)
  const to = evalDim(chart.x.to, scope, 1)
  if (!Number.isFinite(from) || !Number.isFinite(to) || to === from) return null
  const n = Math.max(8, Math.min(400, Math.round(chart.samples ?? 120)))
  const xs = Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n)
  let yMin = 0
  let yMax = 0
  const series = chart.series.slice(0, 4).map((sr) => {
    const ys = xs.map((x) => {
      const v = evalDim(sr.formula, { ...scope, x }, 0)
      return Number.isFinite(v) ? v : 0
    })
    let max = { x: xs[0], y: ys[0] }
    let min = { x: xs[0], y: ys[0] }
    ys.forEach((y, i) => {
      if (y > max.y) max = { x: xs[i], y }
      if (y < min.y) min = { x: xs[i], y }
    })
    yMin = Math.min(yMin, min.y)
    yMax = Math.max(yMax, max.y)
    return { id: sr.id, label: sr.label, ys, max, min }
  })
  return { spec: chart, xs, series, yMin, yMax }
}

export interface NoteSceneSpec {
  id: string
  title: string
  summary: string
  /** Display unit for UI sliders; internal 3D geometry coordinates are in meters */
  units: 'mm' | 'm'
  extent?: number
  floorY?: number
  camera?: {
    position: [number, number, number]
    target: [number, number, number]
  }
  parameters: NoteParameterSpec[]
  parts: NotePartSpec[]
  annotations?: NoteAnnotationSpec[]
  calculations?: NoteCalculationSpec[]
  /** graphs worked out live: bending moment and shear force diagrams, curves */
  charts?: NoteChartSpec[]
  showProjectionPlanes?: 'none' | 'first-angle' | 'third-angle'
  recommendedCut?: {
    enabled: boolean
    normal: [number, number, number]
    pos: number
  }
}

export type FigureVisualization =
  | {
      kind: 'catalog'
      moduleId: string
      sceneId: string
      /** Parameters mapped to scene.applyParams(...) */
      params: Record<string, number>
      /** Parameter metadata so the student gets live sliders right inside the textbook figure */
      paramSpecs?: NoteParameterSpec[]
      cutPreset?: string
    }
  | {
      kind: 'procedural'
      spec: NoteSceneSpec
    }

export const CONFIDENCE_THRESHOLD = 0.75

export interface DetectedPageFigure {
  id: string
  pageNumber: number
  /** Normalized bounding box [ymin, xmin, ymax, xmax] in 0..1000 page coordinates */
  box: [number, number, number, number]
  title: string
  caption: string
  courseTag?: string
  /** Recognition confidence (0..1). Below CONFIDENCE_THRESHOLD (0.75), figure stays as original 2D by default. */
  confidence?: number
  /** Original 2D figure crop data URL (for the 3D <-> 2D Original switcher) */
  originalCropUrl?: string
  extractedGivens: {
    symbol: string
    label: string
    value: number
    unit: string
  }[]
  extractedFormulas?: {
    label: string
    latex: string
    result?: string
  }[]
  visualization: FigureVisualization
}

/* -------------------------------------------------------------------------- */
/* Safe Parametric Expression Evaluator                                       */
/* -------------------------------------------------------------------------- */

const IDENT_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

type Token =
  | { type: 'num'; value: number }
  | { type: 'id'; name: string }
  | { type: 'op'; op: '+' | '-' | '*' | '/' | '^' | '(' | ')' | ',' }

function tokenize(expr: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) {
      i++
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '^' || ch === '(' || ch === ')' || ch === ',') {
      out.push({ type: 'op', op: ch })
      i++
      continue
    }
    if (/[0-9.]/.test(ch)) {
      let start = i
      while (i < expr.length && /[0-9.eE+-]/.test(expr[i])) {
        if ((expr[i] === '+' || expr[i] === '-') && expr[i - 1] !== 'e' && expr[i - 1] !== 'E') break
        i++
      }
      const n = Number(expr.slice(start, i))
      out.push({ type: 'num', value: Number.isFinite(n) ? n : 0 })
      continue
    }
    if (/[a-zA-Z_]/.test(ch)) {
      let start = i
      while (i < expr.length && /[a-zA-Z0-9_]/.test(expr[i])) i++
      out.push({ type: 'id', name: expr.slice(start, i) })
      continue
    }
    // Skip unknown character safely
    i++
  }
  return out
}

/**
 * Safely evaluates a numeric literal or parametric expression string (e.g. "flangeOD / 2000", "L * 0.5")
 * against the current parameter map without `eval` or `Function`.
 */
export function evalDim(
  expr: DimExpr | undefined,
  params: Record<string, number>,
  fallback = 0,
): number {
  if (expr === undefined || expr === null) return fallback
  if (typeof expr === 'number') return Number.isFinite(expr) ? expr : fallback
  const trimmed = String(expr).trim()
  if (!trimmed) return fallback
  const direct = Number(trimmed)
  if (Number.isFinite(direct)) return direct
  if (IDENT_RE.test(trimmed)) {
    if (trimmed === 'PI' || trimmed === 'pi') return Math.PI
    return params[trimmed] !== undefined && Number.isFinite(params[trimmed]) ? params[trimmed] : fallback
  }

  try {
    const tokens = tokenize(trimmed)
    let pos = 0

    const peek = () => tokens[pos]
    const next = () => tokens[pos++]

    const parseExpr = (): number => {
      let left = parseTerm()
      while (pos < tokens.length) {
        const t = peek()
        if (t?.type === 'op' && (t.op === '+' || t.op === '-')) {
          next()
          const right = parseTerm()
          left = t.op === '+' ? left + right : left - right
        } else {
          break
        }
      }
      return left
    }

    const parseTerm = (): number => {
      let left = parsePower()
      while (pos < tokens.length) {
        const t = peek()
        if (t?.type === 'op' && (t.op === '*' || t.op === '/')) {
          next()
          const right = parsePower()
          left = t.op === '*' ? left * right : right === 0 ? 0 : left / right
        } else {
          break
        }
      }
      return left
    }

    const parsePower = (): number => {
      const base = parseFactor()
      const t = peek()
      if (t?.type === 'op' && t.op === '^') {
        next()
        const exp = parsePower()
        return Math.pow(base, exp)
      }
      return base
    }

    const parseFactor = (): number => {
      const t = peek()
      if (!t) return 0
      if (t.type === 'op' && (t.op === '+' || t.op === '-')) {
        next()
        const v = parseFactor()
        return t.op === '-' ? -v : v
      }
      if (t.type === 'op' && t.op === '(') {
        next()
        const v = parseExpr()
        if (peek()?.type === 'op' && (peek() as { op: string }).op === ')') next()
        return v
      }
      if (t.type === 'num') {
        next()
        return t.value
      }
      if (t.type === 'id') {
        next()
        const name = t.name
        if (peek()?.type === 'op' && (peek() as { op: string }).op === '(') {
          next() // consume '('
          const args: number[] = []
          if (!(peek()?.type === 'op' && (peek() as { op: string }).op === ')')) {
            args.push(parseExpr())
            while (peek()?.type === 'op' && (peek() as { op: string }).op === ',') {
              next()
              args.push(parseExpr())
            }
          }
          if (peek()?.type === 'op' && (peek() as { op: string }).op === ')') next()
          switch (name.toLowerCase()) {
            case 'sin':
              return Math.sin(args[0] ?? 0)
            case 'cos':
              return Math.cos(args[0] ?? 0)
            case 'tan':
              return Math.tan(args[0] ?? 0)
            case 'sqrt':
              return Math.sqrt(Math.max(0, args[0] ?? 0))
            case 'abs':
              return Math.abs(args[0] ?? 0)
            case 'min':
              return Math.min(...(args.length ? args : [0]))
            case 'max':
              return Math.max(...(args.length ? args : [0]))
            // Heaviside step: 1 from v = 0 on, else 0 (a load or support partway along a member)
            case 'step':
              return (args[0] ?? 0) >= 0 ? 1 : 0
            // Macaulay bracket <v>^n: 0 while v < 0, v^n after (beam deflection and moment by singularity functions)
            case 'mac': {
              const v = args[0] ?? 0
              return v <= 0 ? 0 : Math.pow(v, args[1] ?? 1)
            }
            case 'exp':
              return Math.exp(args[0] ?? 0)
            case 'log':
              return (args[0] ?? 0) > 0 ? Math.log(args[0] ?? 1) : 0
            case 'atan':
              return Math.atan(args[0] ?? 0)
            default:
              return args[0] ?? 0
          }
        }
        if (name === 'PI' || name === 'pi') return Math.PI
        return params[name] !== undefined && Number.isFinite(params[name]) ? params[name] : 0
      }
      next()
      return 0
    }

    const res = parseExpr()
    return Number.isFinite(res) ? res : fallback
  } catch {
    return fallback
  }
}

export function evalVec3(
  v: Vec3Expr | undefined,
  params: Record<string, number>,
  fallback: [number, number, number] = [0, 0, 0],
): [number, number, number] {
  if (!v) return fallback
  return [
    evalDim(v[0], params, fallback[0]),
    evalDim(v[1], params, fallback[1]),
    evalDim(v[2], params, fallback[2]),
  ]
}

export function evaluateCalculations(
  calculations: NoteCalculationSpec[] | undefined,
  params: Record<string, number>,
): { results: EvaluatedCalculation[]; scope: Record<string, number> } {
  const scope: Record<string, number> = { ...params }
  if (!calculations?.length) return { results: [], scope }
  const results: EvaluatedCalculation[] = []
  for (const spec of calculations) {
    const value = evalDim(spec.formula, scope, 0)
    scope[spec.id] = value
    if (spec.symbol && IDENT_RE.test(spec.symbol)) {
      scope[spec.symbol] = value
    }
    let status: 'ok' | 'warn' = 'ok'
    let limitValue: number | undefined
    if (spec.limit) {
      limitValue = evalDim(spec.limit.value, scope, 0)
      if (spec.limit.kind === 'max' && value > limitValue) status = 'warn'
      if (spec.limit.kind === 'min' && value < limitValue) status = 'warn'
    }
    const abs = Math.abs(value)
    const formatted =
      abs === 0
        ? '0'
        : abs >= 1000
          ? value.toFixed(0)
          : abs >= 100
            ? value.toFixed(1)
            : abs >= 1
              ? value.toFixed(2)
              : Number(value.toPrecision(3)).toString()
    results.push({ spec, value, formatted, status, limitValue })
  }
  return { results, scope }
}

/* -------------------------------------------------------------------------- */
/* Zod Validation Schemas                                                     */
/* -------------------------------------------------------------------------- */

const dimExprSchema = z.union([z.number(), z.string().max(120)])
const vec3ExprSchema = z.tuple([dimExprSchema, dimExprSchema, dimExprSchema])
const axisDirSchema = z.enum(['+x', '-x', '+y', '-y', '+z', '-z'])
export const noteMountSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('coaxial'), target: z.string().min(1).max(80), at: dimExprSchema.optional(), offset: dimExprSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('mesh'), target: z.string().min(1).max(80), side: axisDirSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('against'), target: z.string().min(1).max(80), face: axisDirSchema, shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('centered'), target: z.string().min(1).max(80), shift: vec3ExprSchema.optional() }),
])

export const noteParameterSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  symbol: z.string().max(30).optional(),
  value: z.number(),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  unit: z.string().max(24),
})

export const noteShapeSchema = z.object({
  kind: z.enum([
    'box',
    'cylinder',
    'tube',
    'cone',
    'sphere',
    'torus',
    'lathe',
    'extrude',
    'gear',
    'bevelGear',
    'rack',
    'pulley',
    'sprocket',
    'spring',
    'hexNut',
    'hexBolt',
  ]),
  op: z.enum(['add', 'subtract', 'intersect']).optional(),
  position: vec3ExprSchema.optional(),
  rotation: vec3ExprSchema.optional(),
  radialCount: dimExprSchema.optional(),
  radialRadius: dimExprSchema.optional(),
  sx: dimExprSchema.optional(),
  sy: dimExprSchema.optional(),
  sz: dimExprSchema.optional(),
  r: dimExprSchema.optional(),
  rTop: dimExprSchema.optional(),
  rBot: dimExprSchema.optional(),
  rOuter: dimExprSchema.optional(),
  rInner: dimExprSchema.optional(),
  h: dimExprSchema.optional(),
  tubeRadius: dimExprSchema.optional(),
  teeth: dimExprSchema.optional(),
  module: dimExprSchema.optional(),
  pressureAngle: z.number().optional(),
  helixAngle: z.number().optional(),
  pitch: dimExprSchema.optional(),
  d: dimExprSchema.optional(),
  turns: dimExprSchema.optional(),
  wireRadius: dimExprSchema.optional(),
  profile: z.array(z.tuple([dimExprSchema, dimExprSchema])).max(64).optional(),
  polygon: z.array(z.tuple([dimExprSchema, dimExprSchema])).max(64).optional(),
  depth: dimExprSchema.optional(),
})

export const notePartSchema: z.ZodType<NotePartSpec> = z.lazy(() =>
  z.object({
    id: z.string().min(1).max(80),
    name: z.string().min(1).max(120),
    material: z.enum(ALLOWED_MATERIALS as unknown as [MaterialKey, ...MaterialKey[]]).optional(),
    role: z.enum(ALLOWED_ROLES as unknown as [PartRole, ...PartRole[]]).optional(),
    position: vec3ExprSchema.optional(),
    rotation: vec3ExprSchema.optional(),
    explode: z.tuple([z.number(), z.number(), z.number()]).optional(),
    cut: z.boolean().optional(),
    info: z
      .object({
        summary: z.string().max(600),
        role: z.string().max(600).optional(),
      })
      .optional(),
    motion: z
      .object({
        kind: z.enum(['rotate', 'oscillate', 'translate']),
        axis: z.enum(['x', 'y', 'z']),
        speed: dimExprSchema,
        amplitude: dimExprSchema.optional(),
        phase: z.number().optional(),
      })
      .optional(),
    mount: noteMountSchema.optional(),
    shapes: z.array(noteShapeSchema).min(1).max(32),
    children: z.array(notePartSchema).max(24).optional(),
  }),
)

export const noteAnnotationSchema = z.object({
  id: z.string().min(1).max(60),
  kind: z.enum(['force', 'moment', 'dimension', 'label']),
  label: z.string().min(1).max(120),
  value: z.string().max(80).optional(),
  magnitude: dimExprSchema.optional(),
  unit: z.string().max(20).optional(),
  from: vec3ExprSchema,
  to: vec3ExprSchema.optional(),
  color: z.string().max(32).optional(),
})

export const noteCalculationSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  symbol: z.string().min(1).max(40),
  formula: z.string().min(1).max(240),
  unit: z.string().max(32),
  latex: z.string().max(240).optional(),
  description: z.string().max(400).optional(),
  limit: z
    .object({
      kind: z.enum(['max', 'min']),
      value: dimExprSchema,
      label: z.string().max(80).optional(),
    })
    .optional(),
})

export const noteChartSchema = z.object({
  id: z.string().min(1).max(60),
  title: z.string().min(1).max(120),
  x: z.object({ label: z.string().max(60), unit: z.string().max(20), from: dimExprSchema, to: dimExprSchema }),
  y: z.object({ label: z.string().max(60), unit: z.string().max(20) }),
  series: z.array(z.object({ id: z.string().min(1).max(60), label: z.string().max(60), formula: z.string().min(1).max(300) })).min(1).max(4),
  samples: z.number().int().min(8).max(400).optional(),
})

export const noteSceneSpecSchema = z.object({
  id: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  summary: z.string().max(1000),
  units: z.enum(['mm', 'm']).default('mm'),
  extent: z.number().positive().optional(),
  floorY: z.number().optional(),
  camera: z
    .object({
      position: z.tuple([z.number(), z.number(), z.number()]),
      target: z.tuple([z.number(), z.number(), z.number()]),
    })
    .optional(),
  parameters: z.array(noteParameterSchema).max(20).default([]),
  parts: z.array(notePartSchema).min(1).max(32),
  annotations: z.array(noteAnnotationSchema).max(24).optional(),
  calculations: z.array(noteCalculationSchema).max(20).optional(),
  charts: z.array(noteChartSchema).max(6).optional(),
  showProjectionPlanes: z.enum(['none', 'first-angle', 'third-angle']).optional(),
  recommendedCut: z
    .object({
      enabled: z.boolean(),
      normal: z.tuple([z.number(), z.number(), z.number()]),
      pos: z.number(),
    })
    .optional(),
})
