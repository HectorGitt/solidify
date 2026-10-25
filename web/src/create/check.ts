import { pitchDiameter, type Design, type PartSpec } from './spec'

/**
 * Engineering checks on a design: the mistakes a designer (or the assistant) can make that the
 * schema can't see. Each problem names the parts involved and says how to fix it.
 */

export interface Problem {
  level: 'error' | 'warning'
  message: string
  /** part, shaft or link ids involved, for highlighting */
  ids: string[]
}

const TOL = 0.005 // 0.5 % on centre distances

export function checkDesign(d: Design): Problem[] {
  const out: Problem[] = []
  const err = (message: string, ...ids: string[]) => out.push({ level: 'error', message, ids })
  const warn = (message: string, ...ids: string[]) => out.push({ level: 'warning', message, ids })

  const ids = new Set<string>()
  for (const x of [...d.shafts, ...d.parts, ...d.blocks]) {
    if (ids.has(x.id)) err(`Two things are called “${x.id}”. Every id must be unique.`, x.id)
    ids.add(x.id)
  }
  const shaft = new Map(d.shafts.map((s) => [s.id, s]))
  const part = new Map(d.parts.map((p) => [p.id, p]))

  // parts sit on real shafts, within their length
  for (const p of d.parts) {
    const s = shaft.get(p.shaft)
    if (!s) {
      err(`${label(p)} is on shaft “${p.shaft}”, which doesn't exist.`, p.id)
      continue
    }
    const half = (partWidth(p) ?? 0) / 2
    if (p.at - half < s.z0 - 0.5 || p.at + half > s.z0 + s.length + 0.5) err(`${label(p)} hangs off the end of shaft ${s.id} (it runs from ${s.z0} to ${s.z0 + s.length} mm).`, p.id, s.id)
    const pd = pitchDiameter(p)
    if (pd !== null && pd < s.diameter * 1.6) err(`${label(p)} is too small for its ${s.diameter} mm shaft: its pitch diameter is only ${round(pd)} mm.`, p.id, s.id)
  }

  // exactly one motor
  const motors = d.parts.filter((p) => p.kind === 'motor')
  if (!motors.length) err('Add a motor to drive the design.')
  if (motors.length > 1) err('Only one motor can drive a design for now.', ...motors.map((m) => m.id))

  // links
  for (const l of d.links) {
    const a = part.get(l.a)
    const b = part.get(l.b)
    if (!a || !b) {
      err(`A ${l.kind} joins “${l.a}” and “${l.b}”, but ${!a ? l.a : l.b} doesn't exist.`, l.a, l.b)
      continue
    }
    const sa = shaft.get(a.shaft)
    const sb = shaft.get(b.shaft)
    if (!sa || !sb) continue
    if (sa.id === sb.id) {
      err(`${label(a)} and ${label(b)} are on the same shaft, so they can't drive each other.`, a.id, b.id)
      continue
    }
    const centre = Math.hypot(sa.x - sb.x, sa.y - sb.y)
    if (Math.abs(a.at - b.at) > Math.max(partWidth(a) ?? 0, partWidth(b) ?? 0) / 2 + 1) warn(`${label(a)} and ${label(b)} aren't lined up along the shafts (at ${a.at} and ${b.at} mm).`, a.id, b.id)

    if (l.kind === 'mesh') {
      const gear = (p: PartSpec) => p.kind === 'spur' || p.kind === 'helical'
      if (!gear(a) || !gear(b)) {
        err(`Only gears can mesh: ${label(a)} with ${label(b)}.`, a.id, b.id)
        continue
      }
      if (a.module !== b.module) err(`${label(a)} (module ${a.module}) and ${label(b)} (module ${b.module}) can't mesh: meshing gears need the same module.`, a.id, b.id)
      if (a.kind !== b.kind) err(`${label(a)} and ${label(b)} can't mesh: a spur gear only meshes with a spur gear, a helical with a helical.`, a.id, b.id)
      if (a.kind === 'helical' && b.kind === 'helical') {
        if (a.helix !== b.helix) err(`${label(a)} and ${label(b)} need the same helix angle to mesh.`, a.id, b.id)
        if (a.hand === b.hand) err(`${label(a)} and ${label(b)} are both ${a.hand}-hand; meshing helical gears on parallel shafts need opposite hands.`, a.id, b.id)
      }
      const need = ((pitchDiameter(a) ?? 0) + (pitchDiameter(b) ?? 0)) / 2
      if (Math.abs(centre - need) > need * TOL) err(`${label(a)} and ${label(b)} don't mesh: their shafts are ${round(centre)} mm apart but these gears need ${round(need)} mm.`, a.id, b.id, sa.id, sb.id)
    } else {
      const ok = l.kind === 'belt' ? a.kind === 'pulley' && b.kind === 'pulley' : a.kind === 'sprocket' && b.kind === 'sprocket'
      if (!ok) {
        err(`A ${l.kind} needs ${l.kind === 'belt' ? 'two pulleys' : 'two sprockets'}: ${label(a)} and ${label(b)}.`, a.id, b.id)
        continue
      }
      if (l.kind === 'chain' && a.kind === 'sprocket' && b.kind === 'sprocket' && a.pitch !== b.pitch) err(`${label(a)} and ${label(b)} need the same chain pitch.`, a.id, b.id)
      const ra = (pitchDiameter(a) ?? 0) / 2
      const rb = (pitchDiameter(b) ?? 0) / 2
      if (centre <= ra + rb) err(`${label(a)} and ${label(b)} overlap: their shafts are only ${round(centre)} mm apart.`, a.id, b.id, sa.id, sb.id)
      else if (l.kind === 'belt' && centre < 1.5 * (ra + rb)) warn(`The belt between ${label(a)} and ${label(b)} is very short; a centre distance of at least ${round(1.5 * (ra + rb))} mm wraps the small pulley better.`, a.id, b.id)
    }
  }

  // every geared, belted or chained part should do something
  const linked = new Set(d.links.flatMap((l) => [l.a, l.b]))
  for (const p of d.parts) if ((p.kind === 'spur' || p.kind === 'helical' || p.kind === 'pulley' || p.kind === 'sprocket') && !linked.has(p.id)) warn(`${label(p)} isn't connected to anything.`, p.id)

  return out
}

export function partWidth(p: PartSpec): number | null {
  if (p.kind === 'spur' || p.kind === 'helical' || p.kind === 'pulley') return p.width
  if (p.kind === 'sprocket') return 0.6 * p.pitch * p.strands
  if (p.kind === 'bearing') return 0.6 * 30
  if (p.kind === 'motor') return 0
  return null
}

const round = (x: number) => Number(x.toPrecision(4))
export const label = (p: PartSpec) => p.name ?? `${p.kind} ${p.id}`
