import { z } from 'zod'

/**
 * Create in 3D: the design spec. A design is shafts plus the parts mounted on them, joined by
 * gear meshes, belts and chains, and driven by one motor. Everything a generated or edited
 * design can say is in this schema; the app builds geometry and physics from it, so a design is
 * always safe, editable and buildable.
 *
 * Units: millimetres for sizes and positions, kW and rpm for the drive. Frame: Y up; every shaft
 * runs along Z from `z0` to `z0 + length`, through the point (x, y).
 */

const id = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/, 'use lowercase letters, digits and dashes')
const mm = (min: number, max: number) => z.number().finite().min(min).max(max)

export const shaftSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60).optional(),
  x: mm(-5000, 5000),
  y: mm(-5000, 5000),
  z0: mm(-5000, 5000).default(0),
  length: mm(20, 5000),
  diameter: mm(5, 400),
})

const mounted = { id, name: z.string().trim().min(1).max(60).optional(), shaft: id, at: mm(-5000, 5000) }

export const partSchema = z.discriminatedUnion('kind', [
  z.object({ ...mounted, kind: z.literal('spur'), teeth: z.number().int().min(8).max(300), module: mm(0.5, 30), width: mm(3, 400) }),
  z.object({ ...mounted, kind: z.literal('helical'), teeth: z.number().int().min(8).max(300), module: mm(0.5, 30), width: mm(3, 400), helix: z.number().min(5).max(45), hand: z.enum(['left', 'right']) }),
  z.object({ ...mounted, kind: z.literal('pulley'), diameter: mm(20, 3000), width: mm(10, 600), belt: z.enum(['flat', 'v']).default('v'), grooves: z.number().int().min(1).max(10).default(1) }),
  z.object({ ...mounted, kind: z.literal('sprocket'), teeth: z.number().int().min(9).max(150), pitch: z.number().refine((p) => [9.525, 12.7, 15.875, 19.05, 25.4, 31.75, 38.1].includes(p), 'a standard roller-chain pitch in mm'), strands: z.union([z.literal(1), z.literal(2)]).default(1) }),
  z.object({ ...mounted, kind: z.literal('bearing'), type: z.enum(['ball', 'roller', 'taper', 'plummer']).default('plummer') }),
  z.object({ ...mounted, kind: z.literal('motor'), power: z.number().positive().max(2000), rpm: z.number().positive().max(10000) }),
])

export const linkSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('mesh'), a: id, b: id }),
  z.object({ kind: z.literal('belt'), a: id, b: id, crossed: z.boolean().default(false) }),
  z.object({ kind: z.literal('chain'), a: id, b: id }),
])

export const blockSchema = z.object({
  id,
  name: z.string().trim().min(1).max(60).optional(),
  /** centre and size, mm */
  x: mm(-5000, 5000),
  y: mm(-5000, 5000),
  z: mm(-5000, 5000),
  w: mm(1, 10000),
  h: mm(1, 10000),
  d: mm(1, 10000),
  material: z.enum(['castIron', 'steel', 'paintGreen', 'paintRed', 'paintGrey', 'paintYellow', 'paintBlue', 'aluminium', 'wood', 'concrete']).default('paintGrey'),
  /** a housing is see-through in x-ray and sectioned in a cut */
  housing: z.boolean().default(false),
})

export const designSchema = z.object({
  version: z.literal(1),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional(),
  shafts: z.array(shaftSchema).min(1).max(30),
  parts: z.array(partSchema).max(120),
  links: z.array(linkSchema).max(60).default([]),
  blocks: z.array(blockSchema).max(40).default([]),
})

export type Design = z.infer<typeof designSchema>
export type ShaftSpec = z.infer<typeof shaftSchema>
export type PartSpec = z.infer<typeof partSchema>
export type LinkSpec = z.infer<typeof linkSchema>
export type BlockSpec = z.infer<typeof blockSchema>

/** Pitch diameter (mm) of a gear, or a sprocket on its pitch circle. */
export function pitchDiameter(p: PartSpec): number | null {
  if (p.kind === 'spur') return p.teeth * p.module
  if (p.kind === 'helical') return (p.teeth * p.module) / Math.cos((p.helix * Math.PI) / 180)
  if (p.kind === 'pulley') return p.diameter
  if (p.kind === 'sprocket') return p.pitch / Math.sin(Math.PI / p.teeth)
  return null
}

/** Parse untrusted JSON (from the assistant or a saved file) into a design, or explain why not. */
export function parseDesign(json: unknown): { ok: true; design: Design } | { ok: false; errors: string[] } {
  const r = designSchema.safeParse(json)
  if (r.success) return { ok: true, design: r.data }
  return { ok: false, errors: r.error.issues.slice(0, 12).map((i) => `${i.path.join('.') || 'design'}: ${i.message}`) }
}
