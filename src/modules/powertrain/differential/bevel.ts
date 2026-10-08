import * as THREE from 'three'

/**
 * Placing straight bevel gears so that their pitch-cone apexes meet and their teeth interlock.
 *
 * `bevelGear()` (src/geometry/parts) builds a gear with its axis along local +Z, the large end
 * at z = 0 and the apex on +Z at distance R/tan γ. A gear here is described by the unit vector
 * `axis` pointing from the gear TOWARDS the common apex; its angle θ is a rotation about that
 * axis. For two bevel gears meshing on a common apex, matching pitch-line speeds gives
 * ω_b = −(z_a/z_b)·ω_a with both angles measured about their apex-pointing axes — the same
 * relation as an external spur mesh.
 */
export interface BevelPlacement {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  /** static phase about the local Z axis (rad) so that teeth interlock at θ = 0 */
  phase: number
}

/**
 * @param apex common apex (parent frame)
 * @param axis unit vector from the gear towards the apex
 * @param pitchR pitch radius at the large end
 * @param pitchAngleRad pitch-cone half angle γ
 * @param contactDir direction (perpendicular to the axis) from the gear axis to the mesh point
 * @param teeth tooth count
 * @param toothAtContact true: a tooth sits on the contact line; false: a tooth space does
 */
export function placeBevel(
  apex: THREE.Vector3,
  axis: THREE.Vector3,
  pitchR: number,
  pitchAngleRad: number,
  contactDir: THREE.Vector3,
  teeth: number,
  toothAtContact: boolean,
): BevelPlacement {
  const a = axis.clone().normalize()
  const apexDist = pitchR / Math.tan(pitchAngleRad)
  const position = apex.clone().addScaledVector(a, -apexDist)
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a)
  const local = contactDir.clone().applyQuaternion(quaternion.clone().invert())
  const beta = Math.atan2(local.y, local.x)
  return { position, quaternion, phase: beta + (toothAtContact ? 0 : Math.PI / teeth) }
}

/** Euler-free helper: quaternion that rotates a +Y-axis solid onto `dir`. */
export function yTo(dir: THREE.Vector3) {
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
}
