import * as THREE from 'three'

/**
 * Placing a straight bevel gear (from `bevelGear()`: axis local +Z, large end at z = 0, apex on
 * +Z) so that its pitch-cone apex sits on a common apex and its teeth interlock with a mate.
 * Angles are measured about the apex-pointing axis, so a meshing pair obeys
 * ω_b = −(z_a/z_b)·ω_a — the same relation as `gearMesh` in the DriveGraph.
 */
export interface BevelPlacement {
  position: THREE.Vector3
  quaternion: THREE.Quaternion
  /** static phase about local Z so that teeth interlock at θ = 0 */
  phase: number
}

export function placeBevelGear(apex: THREE.Vector3, axis: THREE.Vector3, pitchR: number, pitchAngle: number, contactDir: THREE.Vector3, teeth: number, toothAtContact: boolean): BevelPlacement {
  const a = axis.clone().normalize()
  const position = apex.clone().addScaledVector(a, -pitchR / Math.tan(pitchAngle))
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a)
  const local = contactDir.clone().applyQuaternion(quaternion.clone().invert())
  const beta = Math.atan2(local.y, local.x)
  return { position, quaternion, phase: beta + (toothAtContact ? 0 : Math.PI / teeth) }
}

/**
 * Angle gear A (z_a teeth, centre at the origin of its line of centres) must have so that it
 * interlocks with gear B whose absolute tooth-0 angle is φ_B, B lying in direction γ from A
 * (external mesh). Inverse of `meshPhase` in ./geo.
 */
export function phaseToMeet(za: number, zb: number, phiB: number, gamma: number) {
  return gamma + (Math.PI - (phiB - gamma - Math.PI) * zb) / za
}
