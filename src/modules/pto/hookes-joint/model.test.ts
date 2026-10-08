import { describe, expect, it } from 'vitest'
import { DriveGraph, hookeJoint } from '@/core/drive'
import { hookeOutputAngle, rad } from '@/physics/joints'
import { jointPose } from './model'

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a))

describe("Hooke's joint rig — 3D geometry reproduces the notes' kinematics", () => {
  for (const d of [0, 10, 20, 35, 45]) {
    it(`δ = ${d}°: driven-shaft angle from the cross geometry equals atan(tan θ / cos δ)`, () => {
      for (let i = 0; i < 72; i++) {
        const th = (i / 72) * 2 * Math.PI
        const p = jointPose(th, rad(d))
        expect(wrap(p.phi - Math.PI - hookeOutputAngle(rad(d), th))).toBeCloseTo(0, 9)
        // cross arms stay square and each lies on its yoke's pin axis
        expect(p.u1.dot(p.u2)).toBeCloseTo(0, 12)
        expect(p.u2.dot(p.a2)).toBeCloseTo(0, 12)
      }
    })
  }
})

describe('the rig is driven by DriveGraph.hookeJoint', () => {
  it('graph output angle + π equals the driven-shaft angle solved from the cross geometry', () => {
    const g = new DriveGraph()
    g.body('in')
    g.body('out')
    g.addMap(hookeJoint('uj', 'in', 'out', () => rad(20)))
    g.drive('in', 104.72)
    for (let i = 0; i < 200; i++) {
      g.step(0.0007)
      const p = jointPose(g.get('in').theta, rad(20))
      expect(wrap(p.phi - Math.PI - g.get('out').theta)).toBeCloseTo(0, 9)
    }
  })
})
