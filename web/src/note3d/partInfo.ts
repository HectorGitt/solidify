import type * as THREE from 'three'
import type { MaterialKey } from '@/render/materials'
import { evalDim, type NoteCalculationSpec, type NotePartSpec, type NoteSceneSpec, type NoteShapeSpec } from './schema'

/**
 * What the part inspector shows about a part: its engineering material properties, its real sizes, its
 * mass, and which of the model's sizes and calculations it is tied to.
 */

/** typical values for design work: density (kg/m³), Young's modulus (GPa), yield or proof strength (MPa) */
export const MATERIAL_PROPS: Partial<Record<MaterialKey, { density: number; E?: number; yield?: number; note?: string }>> = {
  castIron: { density: 7200, E: 110, yield: 200, note: 'grey iron, tensile strength' },
  steel: { density: 7850, E: 205, yield: 350, note: 'medium-carbon steel' },
  steelMatte: { density: 7850, E: 205, yield: 350 },
  steelDark: { density: 7850, E: 205, yield: 650, note: 'quenched and tempered' },
  forged: { density: 7850, E: 205, yield: 450 },
  chrome: { density: 7850, E: 205, yield: 500, note: 'chrome-plated steel' },
  galvanised: { density: 7850, E: 205, yield: 275 },
  aluminium: { density: 2700, E: 70, yield: 240, note: '6061-T6' },
  bronze: { density: 8800, E: 110, yield: 140, note: 'phosphor bronze' },
  brass: { density: 8500, E: 100, yield: 200 },
  copper: { density: 8940, E: 120, yield: 70 },
  bearing: { density: 7300, E: 50, yield: 40, note: 'white metal' },
  rubber: { density: 1150, E: 0.01 },
  nylon: { density: 1140, E: 2.8, yield: 70 },
  plastic: { density: 1050, E: 2.5, yield: 45 },
  wood: { density: 600, E: 11, yield: 40, note: 'along the grain' },
  concrete: { density: 2400, E: 30, yield: 30, note: 'compressive strength' },
  ceramic: { density: 3900, E: 370 },
  glass: { density: 2500, E: 70 },
  leather: { density: 900 },
  friction: { density: 2000 },
  gasket: { density: 1500 },
  paintGreen: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintYellow: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintRed: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintGrey: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintBlack: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintBlue: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
  paintOrange: { density: 7850, E: 205, yield: 275, note: 'painted steel' },
}

export function findPart(spec: NoteSceneSpec | null, id: string | null): NotePartSpec | null {
  if (!spec || !id) return null
  const walk = (list: NotePartSpec[]): NotePartSpec | null => {
    for (const p of list) {
      if (p.id === id) return p
      const c = p.children?.length ? walk(p.children) : null
      if (c) return c
    }
    return null
  }
  return walk(spec.parts)
}

const mm = (m: number) => {
  const v = m * 1000
  return `${Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(1) : v.toFixed(2)} mm`
}

/** the sizes that matter for one shape, worked out from the model's values */
export function shapeSizes(sh: NoteShapeSpec, scope: Record<string, number>): { label: string; value: string }[] {
  const d = (e: unknown, f = 0) => evalDim(e as never, scope, f)
  const hole = sh.op === 'subtract'
  const pre = hole ? 'Hole ' : ''
  switch (sh.kind) {
    case 'gear':
    case 'bevelGear':
    case 'sprocket': {
      const z = Math.round(d(sh.teeth, 20))
      const m = d(sh.module, 0.004)
      return [
        { label: 'Teeth', value: String(z) },
        { label: 'Module', value: mm(m) },
        { label: 'Pitch diameter', value: mm(z * m) },
        { label: 'Outside diameter', value: mm((z + 2) * m) },
        { label: 'Face width', value: mm(d(sh.h ?? sh.depth, 0.024)) },
        ...(sh.rInner !== undefined ? [{ label: 'Bore', value: mm(2 * d(sh.rInner)) }] : []),
        ...(sh.helixAngle ? [{ label: 'Helix angle', value: `${sh.helixAngle}°` }] : []),
      ]
    }
    case 'cylinder': {
      const r = d(sh.r ?? sh.rTop, 0.04)
      return [
        { label: `${pre}Diameter`, value: mm(2 * r) },
        { label: hole ? 'Hole depth' : 'Length', value: mm(d(sh.h, 0.1)) },
      ]
    }
    case 'tube':
      return [
        { label: 'Outside diameter', value: mm(2 * d(sh.rOuter ?? sh.r, 0.05)) },
        { label: 'Inside diameter', value: mm(2 * d(sh.rInner, 0.03)) },
        { label: 'Wall', value: mm(d(sh.rOuter ?? sh.r, 0.05) - d(sh.rInner, 0.03)) },
        { label: 'Length', value: mm(d(sh.h, 0.1)) },
      ]
    case 'cone':
      return [
        { label: 'Base diameter', value: mm(2 * d(sh.rBot ?? sh.r, 0.05)) },
        { label: 'Top diameter', value: mm(2 * d(sh.rTop, 0)) },
        { label: 'Height', value: mm(d(sh.h, 0.1)) },
      ]
    case 'box':
    case 'rack':
      return [{ label: `${pre}Size`, value: `${mm(d(sh.sx, 0.08)).replace(' mm', '')} × ${mm(d(sh.sy, 0.08)).replace(' mm', '')} × ${mm(d(sh.sz ?? sh.depth, 0.08))}` }]
    case 'sphere':
      return [{ label: `${pre}Diameter`, value: mm(2 * d(sh.r, 0.04)) }]
    case 'torus':
      return [
        { label: 'Ring diameter', value: mm(2 * d(sh.r ?? sh.rOuter, 0.05)) },
        { label: 'Section diameter', value: mm(2 * d(sh.tubeRadius ?? sh.rInner, 0.01)) },
      ]
    case 'pulley':
      return [
        { label: 'Outside diameter', value: mm(2 * d(sh.rOuter ?? sh.r, 0.06)) },
        { label: 'Bore', value: mm(2 * d(sh.rInner, 0.012)) },
        { label: 'Width', value: mm(d(sh.h, 0.028)) },
      ]
    case 'spring':
      return [
        { label: 'Coil diameter', value: mm(2 * d(sh.r ?? sh.rOuter, 0.025)) },
        { label: 'Wire diameter', value: mm(2 * d(sh.wireRadius ?? sh.tubeRadius, 0.0035)) },
        { label: 'Free length', value: mm(d(sh.h, 0.1)) },
        { label: 'Turns', value: String(Math.round(d(sh.turns, 6))) },
      ]
    case 'hexNut': {
      const dd = d(sh.d ?? sh.rInner, 0.02)
      return [
        { label: 'Thread', value: `M${(dd * 1000).toFixed(0)}` },
        { label: 'Across flats', value: mm(1.5 * dd) },
        { label: 'Height', value: mm(d(sh.h, 0.8 * dd)) },
      ]
    }
    case 'hexBolt': {
      const dd = d(sh.d ?? sh.r, 0.016)
      return [
        { label: 'Thread', value: `M${(dd * 1000).toFixed(0)}` },
        { label: 'Length', value: mm(d(sh.h, 5 * dd)) },
      ]
    }
    case 'lathe':
      return [{ label: 'Turned profile', value: `${sh.profile?.length ?? 0} points` }]
    case 'extrude':
      return [
        { label: 'Profile', value: `${sh.polygon?.length ?? 0} corners` },
        { label: 'Depth', value: mm(d(sh.depth ?? sh.h, 0.04)) },
      ]
    default:
      return []
  }
}

/** a shape's name in plain words */
export const SHAPE_NAMES: Record<string, string> = {
  gear: 'Spur gear', bevelGear: 'Bevel gear', sprocket: 'Sprocket', cylinder: 'Cylinder', tube: 'Tube', cone: 'Cone', box: 'Block',
  rack: 'Rack', sphere: 'Sphere', torus: 'Ring', pulley: 'Pulley', spring: 'Spring', hexNut: 'Hex nut', hexBolt: 'Hex bolt', lathe: 'Turned part', extrude: 'Profile',
}

/** volume of a closed mesh (m³), from the signed volumes of its triangles */
export function meshVolume(g: THREE.BufferGeometry): number {
  const pos = g.getAttribute('position')
  if (!pos) return 0
  const idx = g.getIndex()
  const n = idx ? idx.count : pos.count
  let v = 0
  for (let i = 0; i + 2 < n; i += 3) {
    const a = idx ? idx.getX(i) : i
    const b = idx ? idx.getX(i + 1) : i + 1
    const c = idx ? idx.getX(i + 2) : i + 2
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a)
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b)
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c)
    v += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
  }
  return Math.abs(v)
}

const IDENT = /[A-Za-z_][A-Za-z0-9_]*/g

/** the model's sizes this part's shape, position or motion is written in terms of */
export function partParameters(part: NotePartSpec, parameterIds: string[]): string[] {
  const text = JSON.stringify([part.shapes, part.position, part.rotation, part.motion, part.children])
  const used = new Set(text.match(IDENT) ?? [])
  return parameterIds.filter((id) => used.has(id))
}

/** calculations that use any of the given sizes, directly or through an earlier result */
export function relatedCalculations(calcs: NoteCalculationSpec[] | undefined, params: string[]): NoteCalculationSpec[] {
  const touched = new Set(params)
  const out: NoteCalculationSpec[] = []
  for (const c of calcs ?? []) {
    const ids = c.formula.match(IDENT) ?? []
    if (ids.some((id) => touched.has(id))) {
      out.push(c)
      touched.add(c.id)
    }
  }
  return out
}
