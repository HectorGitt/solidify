import { describe, expect, it } from 'vitest'
import { AX, LEFT, STROKE, TRACK_ROD, ackermannOuter, angleForLength, armEnd, cylLength, deg, gerotorPose, rad, rightAngle, rotorProfile, toeAngle, turnsLockToLock, GEROTOR } from './model'

describe('front-axle steering linkage (Ackermann geometry — beyond the notes)', () => {
  it('straight ahead: both wheels at 0 and the track rod fits', () => {
    expect(rightAngle(0)).toBeCloseTo(0, 9)
    const P = armEnd(1, 0)
    const Q = armEnd(-1, 0)
    expect(Math.hypot(P.x - Q.x, P.z - Q.z)).toBeCloseTo(TRACK_ROD, 9)
  })
  it('turning left the inner (left) wheel turns more than the outer — close to true Ackermann', () => {
    const dL = rad(30)
    const dR = rightAngle(dL)
    expect(dR).toBeGreaterThan(0)
    expect(dR).toBeLessThan(dL)
    expect(Math.abs(deg(dR) - deg(ackermannOuter(dL)))).toBeLessThan(2.5)
  })
  it('cylinder length is monotonic and invertible over the lock range', () => {
    for (const d of [-0.5, -0.2, 0, 0.3, 0.6]) expect(angleForLength(cylLength(d))).toBeCloseTo(d, 6)
    expect(cylLength(0.3)).toBeLessThan(cylLength(0))
    expect(STROKE).toBeGreaterThan(0.08)
    expect(STROKE).toBeLessThan(0.25)
    expect(LEFT.min).toBeLessThan(0)
  })
  it('a typical 80 cm³/rev metering unit gives 2–5 turns lock to lock', () => {
    const t = turnsLockToLock(80)
    expect(t).toBeGreaterThan(2)
    expect(t).toBeLessThan(5)
  })
  it('toe-in of 3–6 mm (Tractor Steering p5) is a fraction of a degree per wheel', () => {
    expect(deg(toeAngle(6))).toBeLessThan(0.5)
    expect(toeAngle(0)).toBe(0)
    expect(AX.lock).toBeCloseTo(rad(38), 9)
  })
})

describe('gerotor metering unit', () => {
  it('rotor profile is a closed star-shaped curve that stays inside the roller circle', () => {
    const pts = rotorProfile(720)
    let prev = Math.atan2(pts[0].y, pts[0].x)
    let total = 0
    for (let i = 1; i <= pts.length; i++) {
      const p = pts[i % pts.length]
      let a = Math.atan2(p.y, p.x) - prev
      if (a > Math.PI) a -= 2 * Math.PI
      if (a < -Math.PI) a += 2 * Math.PI
      expect(a).toBeGreaterThan(0) // polar angle strictly increasing → no self-intersection
      total += a
      prev = Math.atan2(p.y, p.x)
      expect(Math.hypot(p.x, p.y)).toBeLessThan(GEROTOR.Rp - GEROTOR.roller + GEROTOR.e + 1e-6)
    }
    expect(total).toBeCloseTo(2 * Math.PI, 6)
  })
  it('rotor centre orbits six times per steering-wheel turn', () => {
    const a = gerotorPose(0)
    const b = gerotorPose((2 * Math.PI) / 6)
    expect(a.cx).toBeCloseTo(b.cx, 9)
    expect(a.cy).toBeCloseTo(b.cy, 9)
  })
})
