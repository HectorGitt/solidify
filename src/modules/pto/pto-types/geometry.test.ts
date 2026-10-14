import type * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { openEdges, volume } from '../shared/cardan.test'
import { clutchGeometry, engineGeometry, flywheelGeometry, gearX, shaftsGeometry, staticGeometry, stubGeometry } from './geometry'

describe('PTO-types schematic geometry is watertight and outward-facing', () => {
  const st = staticGeometry()
  const cl = clutchGeometry()
  const sh = shaftsGeometry()
  const cases: [string, THREE.BufferGeometry][] = [
    ['engine', engineGeometry()],
    ['flywheel', flywheelGeometry().disc],
    ['flywheel ring gear', flywheelGeometry().ring],
    ['gearbox shell', st.gearbox],
    ['bell housing', st.bell],
    ['trumpet', st.trumpet],
    ['PTO shield', st.shield],
    ['clutch disc linings', cl.discIn.friction],
    ['clutch disc hub', cl.discIn.hub],
    ['pressure plate', cl.pressurePlate],
    ['hollow PTO shaft', sh.hollow],
    ['layshaft', sh.lay],
    ['gear 39T', gearX(39, 0.016)],
    ['stub 540', stubGeometry('540')],
    ['stub 1000', stubGeometry('1000')],
    ['stub 1000L', stubGeometry('1000L')],
  ]
  for (const [name, g] of cases) {
    it(name, () => {
      expect(openEdges(g), `${name} open edges`).toBe(0)
      expect(volume(g), `${name} volume`).toBeGreaterThan(0)
    })
  }
})
