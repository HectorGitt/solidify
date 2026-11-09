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
  /** degrees; a number or an expression of the model's values (a helix angle slider: "beta") */
  pressureAngle?: DimExpr
  helixAngle?: DimExpr
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
  /** beside the target gear (on `side`, or turned `angle` degrees about its axis from there: planets at 0, 120, 240) */
  | { kind: 'mesh'; target: string; side?: AxisDir; angle?: DimExpr; shift?: Vec3Expr }
  | { kind: 'against'; target: string; face: AxisDir; shift?: Vec3Expr }
  | { kind: 'centered'; target: string; shift?: Vec3Expr }
  /** a piston or slider driven by a crank: on the line from the crank's centre (along `direction`, default up),
   *  at r cos θ + √(l² − r² sin² θ) from it, for crank radius `throw`, rod length `rod` and crank angle
   *  `angle` (degrees from top dead centre) */
  | { kind: 'slider'; target: string; throw: DimExpr; rod: DimExpr; angle?: DimExpr; direction?: AxisDir; shift?: Vec3Expr }
  /** a link (a connecting rod) from the crank pin of `target` to the centre of `to`, its long side along the line */
  | { kind: 'link'; target: string; to: string; throw: DimExpr; angle?: DimExpr; direction?: AxisDir; shift?: Vec3Expr }
  /** a slotted lever: pivots on the centre of `pivot` and always points through the crank pin of `target`
   *  (crank radius `throw`, starting `angle` degrees), so the pin stays in its slot (a quick-return mechanism) */
  | { kind: 'lever'; target: string; pivot: string; throw: DimExpr; angle?: DimExpr; direction?: AxisDir; shift?: Vec3Expr }
  /** a part that slides along `direction` with a point of `target`: its crank pin (a scotch yoke's slide, given
   *  `throw`), or the far end of a lever ('tip': a shaper's ram); across that direction it stays where it is */
  | { kind: 'follower'; target: string; direction: AxisDir; of?: 'pin' | 'tip'; throw?: DimExpr; angle?: DimExpr; offset?: DimExpr; shift?: Vec3Expr }
  /** the output shaft of a universal (Hooke's) joint: from the end of the input shaft `target`, its axis turned
   *  `angle` degrees off the input's; it turns by Hooke's law, tan θ₂ = tan θ₁ / cos β */
  | { kind: 'hooke'; target: string; angle: DimExpr; shift?: Vec3Expr }

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
  /**
   * Attached to a part, so it stays with the part wherever the assembly puts it: `at` is the point on the part
   * (`center`, a face such as `+y` for the top, or `start` / `end` of its axis; `along` 0..1 picks a point
   * along the axis). A force's arrow ends on that point and acts along `direction` (default -y, downward),
   * `length` metres long; a moment turns about the part's axis there; a dimension spans the part's length.
   */
  anchor?: { part: string; at?: AxisDir | 'center' | 'start' | 'end'; along?: DimExpr }
  direction?: AxisDir
  length?: DimExpr
  /** force: the arrow's tail (from) and the point it acts on (to). moment: the centre (from) and a point along its axis (to). */
  from?: Vec3Expr
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
  /** in a worked solution: what this step does, in one sentence ("Take moments about A to find R_B.") */
  step?: string
  /** in a worked solution: this is one of the results the question asks for */
  answer?: boolean
  limit?: {
    kind: 'max' | 'min'
    value: DimExpr
    label?: string
  }
}

export interface EvaluatedCalculation {
  spec: NoteCalculationSpec
  /** 0 when broken (see `broken`) */
  value: number
  /** the step could not be worked out with these numbers */
  broken?: boolean
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

export interface NoteQuestionSpec {
  text: string
  /** what is asked, one item each ("the reactions at A and B") */
  find: string[]
  /** a derivation with no numbers given: solved in symbols; the sliders' values only draw the model */
  symbolic?: boolean
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
  /** a pasted problem being solved: the question as given and what it asks for (its givens are the parameters,
   *  its worked solution the calculations, in order) */
  question?: NoteQuestionSpec
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
  /** the student picked this figure, or asked for it in 3D: shown in 3D whatever the confidence */
  chosen?: boolean
}

/** a drawing the page reader found that is not a lab rig or a single part: built on request (Create in 3D's pipeline) */
export interface FigureCandidate {
  id: string
  pageNumber: number
  box: [number, number, number, number]
  title: string
  caption: string
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
/** every function a formula may use (the prompt in api/src/createPrompt.ts lists the same; a test keeps them in step) */
export const FORMULA_FUNCTIONS = ['sqrt', 'pow', 'hypot', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'ln', 'log10', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'step', 'mac'] as const

export function evalDim(
  expr: DimExpr | undefined,
  params: Record<string, number>,
  fallback = 0,
  /** calculations: a root of a negative, a log of zero or less, or a name that isn't there can't be worked out
   *  (the fallback); for sizes they are guarded to 0 so a part still draws */
  strict = false,
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
          // a division by zero: in a calculation it can't be worked out; in a size, 0 so the part still draws
          left = t.op === '*' ? left * right : right === 0 ? (strict ? Number.NaN : 0) : left / right
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
              if (strict && (args[0] ?? 0) < 0) return Number.NaN
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
              if (strict && !((args[0] ?? 0) > 0)) return Number.NaN
              return (args[0] ?? 0) > 0 ? Math.log(args[0] ?? 1) : 0
            case 'atan':
              return Math.atan(args[0] ?? 0)
            case 'asin':
            case 'acos': {
              const x = args[0] ?? 0
              if (Math.abs(x) > 1) return strict ? Number.NaN : name === 'asin' ? Math.asin(Math.sign(x)) : Math.acos(Math.sign(x))
              return name === 'asin' ? Math.asin(x) : Math.acos(x)
            }
            case 'atan2':
              return Math.atan2(args[0] ?? 0, args[1] ?? 1)
            case 'ln':
              if (strict && !((args[0] ?? 0) > 0)) return Number.NaN
              return (args[0] ?? 0) > 0 ? Math.log(args[0] ?? 1) : 0
            case 'log10':
              if (strict && !((args[0] ?? 0) > 0)) return Number.NaN
              return (args[0] ?? 0) > 0 ? Math.log10(args[0] ?? 1) : 0
            case 'pow':
              return Math.pow(args[0] ?? 0, args[1] ?? 1)
            case 'sinh':
              return Math.sinh(args[0] ?? 0)
            case 'cosh':
              return Math.cosh(args[0] ?? 0)
            case 'tanh':
              return Math.tanh(args[0] ?? 0)
            case 'hypot':
              return Math.hypot(...args)
            case 'floor':
              return Math.floor(args[0] ?? 0)
            case 'ceil':
              return Math.ceil(args[0] ?? 0)
            case 'round':
              return Math.round(args[0] ?? 0)
            default:
              // a function it doesn't know: in a calculation that can't be worked out; in a size, its argument
              return strict ? Number.NaN : (args[0] ?? 0)
          }
        }
        if (name === 'PI' || name === 'pi') return Math.PI
        return params[name] !== undefined && Number.isFinite(params[name]) ? params[name] : strict ? Number.NaN : 0
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
    // a step that can't be worked out (a root of a negative, a division by zero, a name that isn't there) is
    // marked broken and shown as such; it never passes as a plausible 0. Later steps still read it as 0.
    const raw = evalDim(spec.formula, scope, Number.NaN, true)
    const broken = !Number.isFinite(raw)
    const value = broken ? 0 : raw
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
    const formatted = broken
      ? '—'
      : abs === 0
        ? '0'
        : abs >= 1000
          ? value.toFixed(0)
          : abs >= 100
            ? value.toFixed(1)
            : abs >= 1
              ? value.toFixed(2)
              : Number(value.toPrecision(3)).toString()
    results.push({ spec, value, formatted, status, limitValue, ...(broken ? { broken } : {}) })
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
  z.object({ kind: z.literal('mesh'), target: z.string().min(1).max(80), side: axisDirSchema.optional(), angle: dimExprSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('against'), target: z.string().min(1).max(80), face: axisDirSchema, shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('centered'), target: z.string().min(1).max(80), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('slider'), target: z.string().min(1).max(80), throw: dimExprSchema, rod: dimExprSchema, angle: dimExprSchema.optional(), direction: axisDirSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('link'), target: z.string().min(1).max(80), to: z.string().min(1).max(80), throw: dimExprSchema, angle: dimExprSchema.optional(), direction: axisDirSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('lever'), target: z.string().min(1).max(80), pivot: z.string().min(1).max(80), throw: dimExprSchema, angle: dimExprSchema.optional(), direction: axisDirSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('follower'), target: z.string().min(1).max(80), direction: axisDirSchema, of: z.enum(['pin', 'tip']).optional(), throw: dimExprSchema.optional(), angle: dimExprSchema.optional(), offset: dimExprSchema.optional(), shift: vec3ExprSchema.optional() }),
  z.object({ kind: z.literal('hooke'), target: z.string().min(1).max(80), angle: dimExprSchema, shift: vec3ExprSchema.optional() }),
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
  pressureAngle: dimExprSchema.optional(),
  helixAngle: dimExprSchema.optional(),
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
  anchor: z.object({ part: z.string().min(1).max(80), at: z.enum(['+x', '-x', '+y', '-y', '+z', '-z', 'center', 'start', 'end']).optional(), along: dimExprSchema.optional() }).optional(),
  direction: z.enum(['+x', '-x', '+y', '-y', '+z', '-z']).optional(),
  length: dimExprSchema.optional(),
  from: vec3ExprSchema.optional(),
  to: vec3ExprSchema.optional(),
  color: z.string().max(32).optional(),
})

export const noteCalculationSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1).max(120),
  symbol: z.string().min(1).max(40),
  formula: z.string().min(1).max(240),
  unit: z.string().max(32),
  latex: z.string().max(400).optional(),
  description: z.string().max(400).optional(),
  /** a worked solution's step: what it does, and whether it is a result the question asks for */
  step: z.string().max(400).optional(),
  answer: z.boolean().optional(),
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
  question: z.object({ text: z.string().min(1).max(4000), find: z.array(z.string().max(300)).max(8), symbolic: z.boolean().optional() }).optional(),
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
