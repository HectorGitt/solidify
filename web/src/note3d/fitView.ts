import * as THREE from 'three'
import type { CameraPose } from '@/modules/types'
import { resolveAssembly } from './assembly'
import { evaluateCalculations, type NoteSceneSpec } from './schema'

/** the viewer's vertical field of view (Stage), degrees */
const FOV = 32
/** width over height of the narrowest place a model is framed for (the workspace's middle column) */
const VIEW_ASPECT = 0.85

/**
 * Frames a generated model from where its parts actually end up: the camera looks at the middle of the
 * assembled model from far enough back for all of it to fit, in the direction Gemini chose if it gave one
 * (it often gets the distance wrong: a 3 m beam framed like a 30 mm part). Extent and floor follow the real
 * size too. Gemini's own extent is a lower bound, so a model still streaming in is framed for its full size.
 */
export function fitView(
  spec: NoteSceneSpec,
  params: Record<string, number>,
  /** width over height of the view it is framed for, when known (the .slfy viewer measures its canvas) */
  aspect = VIEW_ASPECT,
): { extent: number; floorY: number; camera: CameraPose } {
  const box = new THREE.Box3()
  try {
    const { scope } = evaluateCalculations(spec.calculations, params)
    for (const f of resolveAssembly(spec, scope).frames.values()) box.union(f.box)
  } catch {
    /* a model that will not lay out: fall back to its stated size */
  }
  const stated = spec.extent && Number.isFinite(spec.extent) && spec.extent > 0 ? spec.extent : 0
  const size = box.isEmpty() ? new THREE.Vector3(stated || 0.35, stated || 0.35, stated || 0.35) : box.getSize(new THREE.Vector3())
  const center = box.isEmpty() ? new THREE.Vector3() : box.getCenter(new THREE.Vector3())
  const extent = Math.max(0.05, stated, Math.max(size.x, size.y, size.z) * 1.15)
  // the sphere round the model, and the distance at which it fills the view with a margin. The view is
  // narrower than it is tall in the workspace (about 0.85 wide to 1 tall on a desktop, nearly square on a
  // phone), so the sideways angle is the tighter one: fitting only the vertical angle let long models
  // (a 6 m beam) run off both sides
  const radius = Math.max(size.length() / 2, extent * 0.45)
  const half = Math.min((FOV / 2) * (Math.PI / 180), Math.atan(Math.tan(((FOV / 2) * Math.PI) / 180) * Math.max(0.3, aspect)))
  const distance = (radius / Math.sin(half)) * 1.08
  const given = spec.camera ? new THREE.Vector3(...spec.camera.position).sub(new THREE.Vector3(...spec.camera.target)) : null
  const dir = given && given.lengthSq() > 1e-9 ? given.normalize() : new THREE.Vector3(1.45, 1.05, 1.55).normalize()
  const position = center.clone().addScaledVector(dir, distance)
  const floorY = box.isEmpty() ? (spec.floorY ?? -extent * 0.45) : Math.min(spec.floorY ?? Infinity, box.min.y - extent * 0.02)
  return {
    extent,
    floorY,
    camera: { position: [position.x, position.y, position.z], target: [center.x, center.y, center.z] },
  }
}
