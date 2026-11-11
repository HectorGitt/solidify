import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { partObjects } from '@/parts/registry'
import { UJ, ujCross, ujCups, ujYoke } from '@/parts/lib/driveline'
import { getMaterial } from '@/render/materials'
import type { PartFrame } from './assembly'

/**
 * A universal (Hooke's) joint, drawn by the app wherever a model joins two shafts with a `hooke` mount: the
 * same yokes, cross and needle-bearing cups as the hand-built lab rigs, sized to the shafts. A model that drew
 * its own yokes and cross from boxes and cylinders got them where it guessed (ears off the cross, a cross
 * floating in the middle); here they cannot be anywhere else.
 *
 * Each frame the input yoke turns with the input shaft as it is drawn; the cross's arms are its ears' line and
 * the line square to it and to the output shaft (so the cross always sits in both yokes), and the output yoke
 * follows that arm. That is Hooke's law worked out by the geometry itself.
 */

/** names of the pieces a model may have drawn itself for the joint: not drawn when the app draws the joint */
export { JOINT_PIECE } from './jointPieces'

export interface HookeJointSpec {
  input: string
  output: string
}

export function hookeJoints(parts: { id: string; mount?: { kind: string; target: string } }[]): HookeJointSpec[] {
  return parts.filter((p) => p.mount?.kind === 'hooke').map((p) => ({ input: p.mount!.target, output: p.id }))
}

export function HookeJoint({ joint, frames }: { joint: HookeJointSpec; frames: Map<string, PartFrame> }) {
  const inYoke = useRef<THREE.Group>(null)
  const outYoke = useRef<THREE.Group>(null)
  const cross = useRef<THREE.Group>(null)
  const geo = useMemo(() => ({ yoke: ujYoke(UJ), cross: ujCross(UJ), cups: ujCups(UJ) }), [])
  const steel = useMemo(() => getMaterial('steel', { variant: 'solid', highlight: 'none', intersection: false }), [])
  const bright = useMemo(() => getMaterial('chrome', { variant: 'solid', highlight: 'none', intersection: false }), [])

  // where the joint is, which way each shaft runs from it, and how big it is
  const layout = useMemo(() => {
    const a = frames.get(joint.input)
    const b = frames.get(joint.output)
    if (!a || !b) return null
    const inAxis = a.axis.clone().normalize()
    const centre = a.center.clone().addScaledVector(inAxis, a.length / 2)
    const out = b.center.clone().sub(centre)
    if (out.lengthSq() < 1e-10) return null
    out.normalize()
    // the bend axis: square to both shafts (or, with them in line, any line square to the input)
    let bend = new THREE.Vector3().crossVectors(inAxis, out)
    if (bend.lengthSq() < 1e-8) bend = new THREE.Vector3().crossVectors(inAxis, Math.abs(inAxis.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0))
    bend.normalize()
    // the shafts' radius: the input's thinnest side across its axis
    const size = a.box.getSize(new THREE.Vector3())
    const across = [size.x, size.y, size.z].filter((_, k) => Math.abs([inAxis.x, inAxis.y, inAxis.z][k]) < 0.5)
    const r = Math.max(0.004, Math.min(...(across.length ? across : [size.x, size.y, size.z])) / 2)
    return { centre, inAxis, out, bend, scale: r / UJ.shaftR }
  }, [frames, joint])

  // the input shaft's turning, read from how it is drawn: its rotation now against its rotation when first seen
  const start = useRef<THREE.Quaternion | null>(null)
  const q = useMemo(() => new THREE.Quaternion(), [])
  const basis = (x: THREE.Vector3, y: THREE.Vector3) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y)))
  useFrame(() => {
    if (!layout || !inYoke.current || !outYoke.current || !cross.current) return
    let mesh: THREE.Object3D | null = null
    partObjects.get(joint.input)?.traverse((o) => void (!mesh && (o as THREE.Mesh).isMesh && (mesh = o)))
    let turn = new THREE.Quaternion()
    if (mesh) {
      ;(mesh as THREE.Object3D).getWorldQuaternion(q)
      start.current ??= q.clone()
      turn = q.clone().multiply(start.current.clone().invert())
    }
    // the input yoke's ears: the bend axis, turned with the shaft
    const ears = layout.bend.clone().applyQuaternion(turn)
    ears.addScaledVector(layout.inAxis, -ears.dot(layout.inAxis)).normalize()
    // the output yoke's ears: square to the input's and to the output shaft (the cross's other arm)
    const other = new THREE.Vector3().crossVectors(layout.out, ears).normalize()
    inYoke.current.quaternion.copy(basis(layout.inAxis, ears))
    outYoke.current.quaternion.copy(basis(layout.out.clone().negate(), other))
    cross.current.quaternion.copy(basis(new THREE.Vector3().crossVectors(ears, other), ears))
  })

  if (!layout) return null
  return (
    <group position={layout.centre} scale={layout.scale}>
      <group ref={inYoke}>
        <mesh geometry={geo.yoke} material={steel} castShadow receiveShadow />
      </group>
      <group ref={outYoke}>
        <mesh geometry={geo.yoke} material={steel} castShadow receiveShadow />
      </group>
      <group ref={cross}>
        <mesh geometry={geo.cross} material={bright} castShadow />
        <mesh geometry={geo.cups} material={steel} castShadow />
      </group>
    </group>
  )
}
