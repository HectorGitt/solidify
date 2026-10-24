import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { toLocal } from './Part'

/** World displacement produced by applying an assembly-frame offset inside `outer` (as Part does). */
function displacement(assembly: THREE.Object3D, outer: THREE.Object3D, offsetInAssembly: [number, number, number]) {
  assembly.updateMatrixWorld(true)
  const inner = new THREE.Object3D()
  inner.position.set(...toLocal(offsetInAssembly, assembly, outer))
  outer.add(inner)
  inner.updateMatrixWorld(true)
  const moved = inner.getWorldPosition(new THREE.Vector3())
  outer.remove(inner)
  return moved.sub(outer.getWorldPosition(new THREE.Vector3()))
}

describe('exploded parts on spinning shafts', () => {
  it('move out by the same world offset at every shaft angle, so they spin in place instead of orbiting', () => {
    const assembly = new THREE.Object3D()
    assembly.position.set(1, 2, 3)
    assembly.rotation.y = 0.7
    const shaft = new THREE.Object3D() // spins about its own X axis
    assembly.add(shaft)
    const gear = new THREE.Object3D() // a part carried on the shaft, off-centre
    gear.position.set(0.2, 0.05, 0)
    shaft.add(gear)

    const expected = new THREE.Vector3(0, 0.3, 0).applyQuaternion(assembly.quaternion)
    for (const angle of [0, 0.9, 2.1, 3.7, 5.2]) {
      shaft.rotation.x = angle
      expect(displacement(assembly, gear, [0, 0.3, 0]).distanceTo(expected)).toBeLessThan(1e-9)
    }
  })

  it('keeps the offset in the machine’s frame when the whole machine turns', () => {
    const assembly = new THREE.Object3D()
    const part = new THREE.Object3D()
    assembly.add(part)
    assembly.rotation.y = Math.PI / 2
    assembly.updateMatrixWorld(true)
    const [x, y, z] = toLocal([1, 0, 0], assembly, part)
    expect(x).toBeCloseTo(1, 9)
    expect(y).toBeCloseTo(0, 9)
    expect(z).toBeCloseTo(0, 9)
  })
})
