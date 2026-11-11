import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { resolveAssembly } from './assembly'
import { buildKinematics, mechanismProblems, playbackPace } from './kinematics'
import type { NotePartSpec } from './schema'

const M = 0.004
const gear = (id: string, teeth: number, extra: Partial<NotePartSpec> = {}): NotePartSpec => ({
  id,
  name: id,
  role: 'moving',
  shapes: [{ kind: 'gear', teeth, module: M, h: 0.02 }],
  ...extra,
})
const turn = (speed: number) => ({ kind: 'rotate' as const, axis: 'y' as const, speed })
/** a disc turning about Z (its face to the viewer), so a crank throws in the X–Y plane */
const crank = (extra: Partial<NotePartSpec> = {}): NotePartSpec => ({
  id: 'crank',
  name: 'crank',
  role: 'moving',
  rotation: [Math.PI / 2, 0, 0],
  shapes: [{ kind: 'cylinder', r: 0.07, h: 0.02 }],
  motion: turn(1),
  ...extra,
})

const spin = (kin: ReturnType<typeof buildKinematics>, id: string, t: number) => {
  kin.update(t)
  return kin.move(id)?.spin ?? NaN
}

describe('motion from the mounts', () => {
  it('meshed gears turn at the ratio of their teeth, opposite ways; a gear rides its shaft', () => {
    const parts: NotePartSpec[] = [
      gear('g1', 20, { motion: turn(2) }),
      gear('g2', 40, { mount: { kind: 'mesh', target: 'g1', side: '+x' }, motion: turn(5) }),
      { id: 'shaft2', name: 'shaft', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.008, h: 0.12 }], mount: { kind: 'coaxial', target: 'g2' } },
    ]
    const kin = buildKinematics({ parts }, {})
    const d1 = spin(kin, 'g1', 1) - spin(kin, 'g1', 0)
    const d2 = spin(kin, 'g2', 1) - spin(kin, 'g2', 0)
    const ds = spin(kin, 'shaft2', 1) - spin(kin, 'shaft2', 0)
    expect(Math.abs(d1)).toBeCloseTo(2, 6)
    expect(d2 / d1).toBeCloseTo(-0.5, 6)
    expect(Math.abs(ds)).toBeCloseTo(Math.abs(d2), 6)
  })

  it('one part drives each mechanism: a part named like an input wins, the speed written on the other is not used', () => {
    const parts: NotePartSpec[] = [
      gear('g2', 40, { motion: turn(9) }),
      gear('input_pinion', 20, { mount: { kind: 'mesh', target: 'g2', side: '+x' }, motion: turn(3) }),
    ]
    const kin = buildKinematics({ parts }, {})
    const dIn = spin(kin, 'input_pinion', 1) - spin(kin, 'input_pinion', 0)
    const dOut = spin(kin, 'g2', 1) - spin(kin, 'g2', 0)
    expect(Math.abs(dIn)).toBeCloseTo(3, 6)
    expect(dOut / dIn).toBeCloseTo(-0.5, 6)
  })

  it('meshed teeth interleave: the driven gear starts half a tooth round', () => {
    const parts: NotePartSpec[] = [gear('g1', 20, { motion: turn(1) }), gear('g2', 40, { mount: { kind: 'mesh', target: 'g1', side: '+x' } })]
    const kin = buildKinematics({ parts }, {})
    const pitch = (2 * Math.PI) / 40
    const s = spin(kin, 'g2', 0)
    const off = ((s % pitch) + pitch) % pitch
    expect(Math.abs(off - pitch / 2)).toBeLessThan(1e-6)
  })

  it('a rack slides the pitch radius times the pinion angle', () => {
    const parts: NotePartSpec[] = [
      gear('pinion', 20, { motion: turn(1) }),
      { id: 'rack', name: 'rack', role: 'moving', shapes: [{ kind: 'box', sx: 0.3, sy: 0.02, sz: 0.02 }], mount: { kind: 'mesh', target: 'pinion', side: '+z' } },
    ]
    const kin = buildKinematics({ parts }, {})
    kin.update(1)
    const r = (M * 20) / 2
    expect(kin.move('rack')!.pos.length()).toBeCloseTo(r * 1, 6)
  })

  it('a piston follows its crank: r cos θ + √(l² − r² sin² θ)', () => {
    const r = 0.05
    const l = 0.2
    const parts: NotePartSpec[] = [
      crank({ motion: turn(Math.PI / 2) }),
      { id: 'piston', name: 'piston', role: 'moving', shapes: [{ kind: 'box', sx: 0.04, sy: 0.04, sz: 0.04 }], mount: { kind: 'slider', target: 'crank', throw: r, rod: l } },
    ]
    const kin = buildKinematics({ parts }, {})
    expect(kin.derived.has('piston')).toBe(true)
    kin.update(1)
    expect(kin.move('piston')!.pos.length()).toBeCloseTo(r + l - Math.sqrt(l * l - r * r), 6)
  })

  it('a slotted lever points from its pivot through the crank pin; a ram follows its tip', () => {
    const r = 0.05
    const parts: NotePartSpec[] = [
      crank(),
      { id: 'pivot', name: 'pivot pin', role: 'static', position: [0, -0.3, 0], rotation: [Math.PI / 2, 0, 0], shapes: [{ kind: 'cylinder', r: 0.01, h: 0.03 }] },
      { id: 'lever', name: 'slotted lever', role: 'moving', shapes: [{ kind: 'box', sx: 0.03, sy: 0.5, sz: 0.01 }], mount: { kind: 'lever', target: 'crank', pivot: 'pivot', throw: r } },
      { id: 'ram', name: 'ram', role: 'moving', position: [0, 0.3, 0], shapes: [{ kind: 'box', sx: 0.3, sy: 0.03, sz: 0.03 }], mount: { kind: 'follower', target: 'lever', direction: '+x', of: 'tip' } },
    ]
    for (const th of [0, 0.7, 1.9, 3.5]) {
      const poses = resolveAssembly({ parts }, {}, { angles: new Map([['crank', th]]), checks: false }).poses
      const L = poses.get('lever')!
      const along = new THREE.Vector3(0, 1, 0).applyQuaternion(L.quat)
      // the pin, by the crank's frame: slide +y, across = axis × slide
      const axis = new THREE.Vector3(0, 1, 0).applyQuaternion(poses.get('crank')!.quat)
      const across = new THREE.Vector3().crossVectors(axis.z < 0 ? axis.negate() : axis, new THREE.Vector3(0, 1, 0)).normalize()
      const pin = new THREE.Vector3(0, r * Math.cos(th), 0).addScaledVector(across, r * Math.sin(th))
      const toPin = pin.clone().sub(new THREE.Vector3(0, -0.3, 0)).normalize()
      expect(Math.abs(along.dot(toPin))).toBeCloseTo(1, 6)
      // the tip: from the pivot, a lever length along the line through the pin
      const tip = new THREE.Vector3(0, -0.3, 0).addScaledVector(toPin, 0.5)
      const ram = poses.get('ram')!
      expect(ram.pos.x).toBeCloseTo(tip.x, 6)
      expect(ram.pos.y).toBeCloseTo(0.3, 6)
    }
  })

  it('the output of a universal joint turns by Hooke: tan θ₂ = tan θ₁ / cos β', () => {
    const beta = 30
    const parts: NotePartSpec[] = [
      { id: 'input', name: 'input shaft', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.01, h: 0.2 }], motion: turn(1) },
      { id: 'output', name: 'output shaft', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.01, h: 0.2 }], mount: { kind: 'hooke', target: 'input', angle: beta } },
    ]
    const kin = buildKinematics({ parts }, {})
    const b = (beta * Math.PI) / 180
    for (const t of [0.3, 0.6, 1.2, 2.5, 4]) {
      const a = Math.abs(spin(kin, 'input', t))
      expect(a).toBeCloseTo(t, 6)
      // atan2 wraps at half a turn; the output keeps turning, within half a turn of the input
      const raw = Math.atan2(Math.sin(t), Math.cos(t) * Math.cos(b))
      const want = raw + 2 * Math.PI * Math.round((t - raw) / (2 * Math.PI))
      expect(Math.abs(spin(kin, 'output', t))).toBeCloseTo(want, 6)
    }
  })

  it('a gear with a bore is still an outside gear (opposite way); a planet inside a ring gear turns the same way', () => {
    const bored = buildKinematics(
      {
        parts: [
          gear('g1', 20, { motion: turn(1) }),
          { ...gear('g2', 40, { mount: { kind: 'mesh', target: 'g1', side: '+x' } }), shapes: [{ kind: 'gear', teeth: 40, module: M, h: 0.02 }, { kind: 'cylinder', op: 'subtract', r: 0.01, h: 0.03 }] },
        ],
      },
      {},
    )
    expect((spin(bored, 'g2', 1) - spin(bored, 'g2', 0)) / (spin(bored, 'g1', 1) - spin(bored, 'g1', 0))).toBeCloseTo(-0.5, 6)

    const ring = buildKinematics(
      {
        parts: [
          { id: 'ring_gear', name: 'ring gear', role: 'moving', shapes: [{ kind: 'tube', rOuter: 0.13, rInner: 0.12, h: 0.02 }, { kind: 'gear', teeth: 60, module: M, h: 0.02 }], motion: turn(1) },
          gear('planet', 20, { mount: { kind: 'mesh', target: 'ring_gear', side: '+x' } }),
        ],
      },
      {},
    )
    const dr = spin(ring, 'ring_gear', 1) - spin(ring, 'ring_gear', 0)
    const dp = spin(ring, 'planet', 1) - spin(ring, 'planet', 0)
    expect(dp / dr).toBeGreaterThan(0)
  })

  it('a block on a crank pin is carried round the crank, not spun on the spot', () => {
    const parts: NotePartSpec[] = [crank(), { id: 'block', name: 'sliding block', role: 'moving', shapes: [{ kind: 'box', sx: 0.02, sy: 0.02, sz: 0.02 }], mount: { kind: 'coaxial', target: 'crank', shift: [0.05, 0, 0] } }]
    const kin = buildKinematics({ parts }, {})
    const P = resolveAssembly({ parts }, {}).poses
    const b = P.get('block')!
    const c = P.get('crank')!.pos
    const r0 = b.pos.distanceTo(c)
    expect(r0).toBeGreaterThan(0.04)
    kin.update(Math.PI / 2)
    const mv = kin.move('block')!
    expect(mv.spin).toBe(0)
    // where its centre is now, in the world: P₀ · (its move)
    const now = mv.pos.clone().applyQuaternion(b.quat).add(b.pos)
    expect(now.distanceTo(c)).toBeCloseTo(r0, 6)
    expect(now.distanceTo(b.pos)).toBeCloseTo(r0 * Math.SQRT2, 6)
  })

  it('a gear given a clearly different speed from the part it sits on runs free (a differential side gear)', () => {
    const parts: NotePartSpec[] = [
      { id: 'carrier', name: 'carrier', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.08, h: 0.1 }], motion: turn(5) },
      gear('side_left', 16, { mount: { kind: 'coaxial', target: 'carrier' }, motion: turn(4.5) }),
      gear('side_right', 16, { mount: { kind: 'coaxial', target: 'carrier' }, motion: turn(5) }),
    ]
    const kin = buildKinematics({ parts }, {})
    expect(Math.abs(spin(kin, 'side_left', 1) - spin(kin, 'side_left', 0))).toBeCloseTo(4.5, 6)
    expect(Math.abs(spin(kin, 'side_right', 1) - spin(kin, 'side_right', 0))).toBeCloseTo(5, 6)
  })

  it('a gear running free off its carrier axis spins on its own and is carried round too', () => {
    const parts: NotePartSpec[] = [crank(), gear('planet', 16, { mount: { kind: 'coaxial', target: 'crank', shift: [0.05, 0, 0] }, motion: turn(3) })]
    const kin = buildKinematics({ parts }, {})
    const P = resolveAssembly({ parts }, {}).poses
    const b = P.get('planet')!
    const c = P.get('crank')!.pos
    kin.update(Math.PI / 2)
    const mv = kin.move('planet')!
    expect(Math.abs(mv.spin)).toBeCloseTo((3 * Math.PI) / 2, 6)
    const now = mv.pos.clone().applyQuaternion(b.quat).add(b.pos)
    expect(now.distanceTo(c)).toBeCloseTo(b.pos.distanceTo(c), 6)
    expect(now.distanceTo(b.pos)).toBeGreaterThan(0.05)
  })

  it('the mechanism check passes a sound train and names what is wrong in a bad one', () => {
    const good: NotePartSpec[] = [gear('input_pinion', 20, { motion: turn(1) }), gear('g2', 40, { mount: { kind: 'mesh', target: 'input_pinion' } })]
    expect(mechanismProblems({ parts: good }, {}, 'a gear pair')).toEqual({ checked: true, problems: [] })

    const bad: NotePartSpec[] = [
      gear('input_pinion', 20, { motion: turn(1) }),
      { ...gear('g2', 40, { mount: { kind: 'mesh', target: 'input_pinion' } }), shapes: [{ kind: 'gear', teeth: 40, module: 0.006, h: 0.02 }] },
      gear('idler', 30),
      { id: 'rack', name: 'rack bar', role: 'moving', shapes: [{ kind: 'rack', sx: 0.3, sy: 0.02, sz: 0.02 }], motion: { kind: 'oscillate', axis: 'x', speed: 1, amplitude: 0.05 } },
      { id: 'lever', name: 'slotted lever', role: 'moving', shapes: [{ kind: 'box', sx: 0.02, sy: 0.4, sz: 0.01 }], motion: { kind: 'oscillate', axis: 'z', speed: 1, amplitude: 0.3 } },
    ]
    const { problems } = mechanismProblems({ parts: bad }, {}, 'a quick-return mechanism')
    expect(problems.some((p) => /different tooth sizes/.test(p))).toBe(true)
    expect(problems.some((p) => /idler does not turn/.test(p))).toBe(true)
    expect(problems.some((p) => /rack bar is not meshed/.test(p))).toBe(true)
    expect(problems.some((p) => /slotted lever is not a lever/.test(p))).toBe(true)
    // one message per part
    expect(problems.filter((p) => p.startsWith('rack bar')).length).toBe(1)
    expect(problems.filter((p) => p.startsWith('slotted lever')).length).toBe(1)

    expect(mechanismProblems({ parts: [{ id: 'plate', name: 'plate', shapes: [{ kind: 'box', sx: 1, sy: 0.01, sz: 1 }] }] }, {}).checked).toBe(false)
  })

  it('a lever aims at the crank pin as drawn (a die block on it), not at the angle its mount states', () => {
    const parts: NotePartSpec[] = [
      crank(),
      { id: 'block', name: 'die block', role: 'moving', shapes: [{ kind: 'box', sx: 0.02, sy: 0.02, sz: 0.02 }], mount: { kind: 'coaxial', target: 'crank', shift: [0.05, 0, 0] } },
      { id: 'pivot', name: 'pivot pin', role: 'static', position: [0, -0.3, 0], rotation: [Math.PI / 2, 0, 0], shapes: [{ kind: 'cylinder', r: 0.01, h: 0.03 }] },
      // the mount says the pin is at the top (angle 0); the block was drawn at +x
      { id: 'lever', name: 'slotted lever', role: 'moving', shapes: [{ kind: 'box', sx: 0.03, sy: 0.5, sz: 0.01 }], mount: { kind: 'lever', target: 'crank', pivot: 'pivot', throw: 0.05, angle: 0 } },
    ]
    const kin = buildKinematics({ parts }, {})
    const P = resolveAssembly({ parts }, {}).poses
    for (const t of [0, 0.8, 2.1, 4]) {
      kin.update(t)
      const at = (id: string, local: THREE.Vector3) => {
        const b = P.get(id)!
        const m = kin.move(id) ?? { quat: new THREE.Quaternion(), pos: new THREE.Vector3() }
        return local.clone().applyQuaternion(m.quat).add(m.pos).applyQuaternion(b.quat).add(b.pos)
      }
      const block = at('block', new THREE.Vector3())
      const pivot = new THREE.Vector3(0, -0.3, 0)
      const along = at('lever', new THREE.Vector3(0, 1, 0)).sub(at('lever', new THREE.Vector3()))
      const toBlock = block.clone().sub(pivot)
      // the block lies on the lever's line
      expect(toBlock.clone().cross(along.normalize()).length()).toBeLessThan(1e-6)
    }
  })

  it('parts in no mechanism are left to their own motion', () => {
    const parts: NotePartSpec[] = [{ id: 'fan', name: 'fan', role: 'moving', shapes: [{ kind: 'box', sx: 0.1, sy: 0.01, sz: 0.01 }], motion: turn(2) }]
    expect(buildKinematics({ parts }, {}).derived.size).toBe(0)
  })
})

describe('playback pace', () => {
  const shaft = (speed: number | string): NotePartSpec => ({ id: 's', name: 'shaft', role: 'moving', shapes: [{ kind: 'cylinder', r: 0.01, h: 0.2 }], motion: { kind: 'rotate', axis: 'y', speed } })
  const wheel = (teeth: number): NotePartSpec => ({ id: 'g', name: 'gear', role: 'moving', shapes: [{ kind: 'gear', teeth, module: 0.003 }], mount: { kind: 'coaxial', target: 's' } })
  it('leaves slow models in real time', () => {
    expect(playbackPace([shaft(1.5)], {})).toBe(1)
  })
  it('slows a 1,200 rpm geared shaft until its teeth move under half a pitch a frame', () => {
    const w = (1200 * 2 * Math.PI) / 60
    const shown = w * playbackPace([shaft(w), wheel(28)], {})
    expect(shown).toBeGreaterThan(2)
    expect(shown / 60).toBeLessThan((0.5 * 2 * Math.PI) / 28)
  })
  it('a faster setting still looks faster', () => {
    const at = (rpm: number) => ((rpm * 2 * Math.PI) / 60) * playbackPace([shaft('rpm * 2 * pi / 60'), wheel(28)], { rpm })
    expect(at(3000)).toBeGreaterThan(at(1200))
    expect(at(1200)).toBeGreaterThan(at(400))
    // clearly so: 3,000 rpm is shown at least half as fast again as 400 rpm
    expect(at(3000) / at(400)).toBeGreaterThan(1.5)
  })
})
