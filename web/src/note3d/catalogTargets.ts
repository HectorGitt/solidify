/**
 * The rigs a figure in a document can open as, and how a figure's values become each rig's own settings.
 *
 * Values arrive under whatever names the page or the vision model used (span, l2, mainR…) and in the
 * page's units. Each target lists its rig's real setting keys, the other names it accepts with the factor
 * that converts them, and the range the rig can show. Anything unrecognised is dropped; a figure with no
 * usable value stays as the original drawing rather than showing a rig at its defaults.
 *
 * The API's prompt (api/src/noteCatalog.ts) lists the same targets and keys; a test keeps the two in step.
 */

export interface TargetKey {
  /** the unit the rig works in, as shown to the student */
  unit: string
  min: number
  max: number
  /** other names for this value, each with the factor from that name's unit to the rig's */
  aliases?: Record<string, number>
  /** a setting that takes one of a few words, with numeric or other spellings mapped to them */
  choices?: Record<string, string | boolean>
}

export interface CatalogTarget {
  moduleId: string
  sceneId: string
  keys: Record<string, TargetKey>
  /** settings a figure that doesn't mention them should not inherit from the rig's defaults */
  unset?: Record<string, number | string | boolean>
}

export const CATALOG_TARGETS: CatalogTarget[] = [
  {
    moduleId: 'materials',
    sceneId: 'beam',
    keys: {
      L: { unit: 'm', min: 1, max: 12, aliases: { span: 1, length: 1, l: 1 } },
      P1: { unit: 'kN', min: 0, max: 200, aliases: { p1: 1, p: 1, load: 1 } },
      x1: { unit: 'm', min: 0, max: 12, aliases: { a: 1 } },
      P2: { unit: 'kN', min: 0, max: 200, aliases: { p2: 1 } },
      x2: { unit: 'm', min: 0, max: 12 },
      w: { unit: 'kN/m', min: 0, max: 60, aliases: { udl: 1, q: 1 } },
      support: { unit: '', min: 0, max: 1, choices: { simple: 'simple', cantilever: 'cantilever', '0': 'simple', '1': 'cantilever', 'simply supported': 'simple' } },
    },
    unset: { P2: 0, w: 0 },
  },
  {
    moduleId: 'materials',
    sceneId: 'stress-state',
    keys: {
      sx: { unit: 'MPa', min: -400, max: 400, aliases: { sigmax: 1, sigma_x: 1 } },
      sy: { unit: 'MPa', min: -400, max: 400, aliases: { sigmay: 1, sigma_y: 1 } },
      txy: { unit: 'MPa', min: -300, max: 300, aliases: { tauxy: 1, tau_xy: 1, tau: 1 } },
      theta: { unit: '°', min: -180, max: 180, aliases: { angle: 1 } },
    },
    unset: { mode: 'stress' },
  },
  {
    moduleId: 'materials',
    sceneId: 'pressure-vessel',
    keys: {
      p: { unit: 'MPa', min: 0.1, max: 50, aliases: { pressure: 1 } },
      r: { unit: 'mm', min: 50, max: 1500, aliases: { radius: 1, d: 0.5, diameter: 0.5 } },
      t: { unit: 'mm', min: 2, max: 60, aliases: { thickness: 1, wall: 1 } },
      length: { unit: 'mm', min: 200, max: 6000, aliases: { l: 1 } },
    },
  },
  {
    moduleId: 'materials',
    sceneId: 'torsion',
    keys: {
      T: { unit: 'kN·m', min: 0.1, max: 200, aliases: { torque: 1 } },
      L: { unit: 'm', min: 0.2, max: 10, aliases: { length: 1 } },
      D: { unit: 'mm', min: 10, max: 400, aliases: { outer: 1, od: 1 } },
      d: { unit: 'mm', min: 0, max: 380, aliases: { inner: 1, id: 1 } },
      hollow: { unit: '', min: 0, max: 1, choices: { true: true, false: false, '1': true, '0': false } },
    },
  },
  {
    moduleId: 'materials',
    sceneId: 'buckling',
    keys: {
      L: { unit: 'm', min: 0.3, max: 8, aliases: { length: 1 } },
      D: { unit: 'mm', min: 10, max: 300, aliases: { diameter: 1, od: 1 } },
      d: { unit: 'mm', min: 0, max: 280, aliases: { id: 1 } },
      ends: { unit: '', min: 0, max: 0, choices: { 'pinned-pinned': 'pinned-pinned', 'fixed-fixed': 'fixed-fixed', 'fixed-free': 'fixed-free', 'fixed-pinned': 'fixed-pinned', pinned: 'pinned-pinned', fixed: 'fixed-fixed' } },
    },
  },
  {
    moduleId: 'mechanisms',
    sceneId: 'four-bar',
    // the rig is laid out in centimetres
    keys: {
      frame: { unit: 'cm', min: 2, max: 30, aliases: { l1: 0.1, ground: 0.1 } },
      crank: { unit: 'cm', min: 1, max: 30, aliases: { l2: 0.1, input: 0.1 } },
      coupler: { unit: 'cm', min: 2, max: 40, aliases: { l3: 0.1 } },
      rocker: { unit: 'cm', min: 1, max: 30, aliases: { l4: 0.1, output: 0.1 } },
      rpm: { unit: 'rpm', min: 1, max: 120 },
    },
  },
  {
    moduleId: 'drawing',
    sceneId: 'true-length',
    keys: {
      dx: { unit: 'mm', min: 10, max: 120 },
      dy: { unit: 'mm', min: 10, max: 120 },
      dz: { unit: 'mm', min: 10, max: 120 },
    },
  },
  {
    moduleId: 'drawing',
    sceneId: 'interpenetration',
    keys: {
      R: { unit: 'mm', min: 20, max: 80, aliases: { mainr: 1, main: 1 } },
      r: { unit: 'mm', min: 10, max: 80, aliases: { branchr: 1, branch: 1 } },
      angle: { unit: '°', min: 40, max: 90 },
      offset: { unit: 'mm', min: 0, max: 50, aliases: { e: 1 } },
    },
  },
  {
    moduleId: 'thermal',
    sceneId: 'heat-exchanger',
    keys: {
      flow: { unit: '', min: 0, max: 0, choices: { parallel: 'parallel', counter: 'counter', counterflow: 'counter', 'parallel-flow': 'parallel' } },
      Thi: { unit: '°C', min: 30, max: 400 },
      Tci: { unit: '°C', min: 0, max: 80 },
      mh: { unit: 'kg/s', min: 0.02, max: 10 },
      mc: { unit: 'kg/s', min: 0.02, max: 10 },
      U: { unit: 'W/m²K', min: 50, max: 1500 },
      A: { unit: 'm²', min: 0.1, max: 15, aliases: { area: 1 } },
    },
  },
  {
    moduleId: 'thermal',
    sceneId: 'refrigeration',
    keys: {
      fluid: { unit: '', min: 0, max: 0, choices: { ammonia: 'ammonia', nh3: 'ammonia', r134a: 'r134a' } },
      Te: { unit: '°C', min: -38, max: 10, aliases: { evaporator: 1 } },
      Tc: { unit: '°C', min: 20, max: 55, aliases: { condenser: 1 } },
    },
  },
  {
    moduleId: 'thermal',
    sceneId: 'steam-plant',
    keys: {
      pb: { unit: 'bar', min: 5, max: 170, aliases: { boiler: 1 } },
      pc: { unit: 'bar', min: 0.04, max: 1, aliases: { condenser: 1 } },
      T: { unit: '°C', min: 200, max: 600, aliases: { temperature: 1 } },
    },
  },
]

export const findTarget = (moduleId: string, sceneId: string) => CATALOG_TARGETS.find((t) => t.moduleId === moduleId && t.sceneId === sceneId)

/** a figure's values, as the rig's own settings; `usable` is how many of them the rig understood */
export function toSceneParams(moduleId: string, sceneId: string, given: Record<string, unknown>) {
  const target = findTarget(moduleId, sceneId)
  if (!target) return { params: {} as Record<string, unknown>, usable: 0, supported: false }
  const out: Record<string, unknown> = { ...(target.unset ?? {}) }
  let usable = 0
  const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const [rawKey, rawValue] of Object.entries(given)) {
    let hit: [string, TargetKey, number] | null = null
    for (const [key, spec] of Object.entries(target.keys)) {
      if (key === rawKey) hit = [key, spec, 1]
      else if (norm(key) === norm(rawKey) && !hit) hit = [key, spec, 1]
      else {
        const f = Object.entries(spec.aliases ?? {}).find(([a]) => norm(a) === norm(rawKey))
        if (f && !hit) hit = [key, spec, f[1]]
      }
    }
    if (!hit) continue
    const [key, spec, factor] = hit
    if (spec.choices) {
      const choice = spec.choices[String(rawValue).toLowerCase()]
      if (choice === undefined) continue
      out[key] = choice
      usable++
      continue
    }
    const v = typeof rawValue === 'number' ? rawValue : Number(rawValue)
    if (!Number.isFinite(v)) continue
    out[key] = Math.min(spec.max, Math.max(spec.min, v * factor))
    usable++
  }
  return { params: out, usable, supported: true }
}
