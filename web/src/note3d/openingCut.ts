import * as THREE from 'three'
import { resolveAssembly } from './assembly'
import { buildKinematics } from './kinematics'
import { evaluateCalculations, type NoteSceneSpec } from './schema'

/**
 * How a model should open: with its housing cut away when the mechanism is inside it. A model that closes its
 * gears inside a casing and did not ask for a section opened as a closed box with nothing to see moving; here a
 * housing round any part of the drive is cut through its middle, across the axis the opening view looks along
 * most (z, from the default three-quarter view), so the first thing seen is the mechanism working.
 */
export function openingCut(spec: NoteSceneSpec): { enabled: boolean; normal: [number, number, number]; pos: number } | null {
  try {
    const params = Object.fromEntries((spec.parameters ?? []).map((p) => [p.id, p.value]))
    const { scope } = evaluateCalculations(spec.calculations ?? [], params)
    const frames = resolveAssembly(spec, scope, { checks: false }).frames
    const kin = buildKinematics(spec, scope)
    const drive = spec.parts.filter((p) => kin.derived.has(p.id) || kin.drivers.has(p.id) || !!p.motion)
    if (!drive.length) return null
    // a casing round the works (hollowed out, or named as one), not a base plate with pedestals under a shaft
    const casing = (p: (typeof spec.parts)[number]) => p.shapes.some((s) => s.op === 'subtract') || /\b(casing|housing|gear ?box|gear ?case|crank ?case|cover|enclosure)\b/i.test(p.name)
    for (const h of spec.parts.filter((p) => p.role === 'housing' && casing(p))) {
      const box = frames.get(h.id)?.box
      if (!box) continue
      const inner = box.clone().expandByScalar(-0.002)
      const hides = drive.some((p) => {
        const c = frames.get(p.id)?.center
        return !!c && inner.containsPoint(c)
      })
      if (hides) return { enabled: true, normal: [0, 0, 1], pos: box.getCenter(new THREE.Vector3()).z }
    }
  } catch {
    /* a model that will not lay out: open it as it is */
  }
  return null
}
