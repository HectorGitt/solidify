import { describe, expect, it } from 'vitest'
import { EVAL_CASES } from './cases'
import { scoreBuild } from './score'

const beamCase = EVAL_CASES.find((c) => c.id === 'beam-ss')!

/** a good answer to "simply supported beam, 4 m, 10 kN at mid-span" */
const good = {
  explanation: 'A simply supported beam.',
  isNewMachine: true,
  spec: {
    title: 'Simply supported beam',
    parameters: [
      { id: 'L', label: 'Span', symbol: 'L', value: 4, min: 1, max: 10, step: 0.1, unit: 'm' },
      { id: 'P', label: 'Load', symbol: 'P', value: 10, min: 1, max: 50, step: 1, unit: 'kN' },
    ],
    calculations: [{ id: 'Mmax', label: 'Maximum bending moment', symbol: 'M', formula: 'P * L / 4', unit: 'kN·m' }],
    charts: [{ id: 'bmd', title: 'Bending moment', x: { label: 'x', unit: 'm', from: 0, to: 'L' }, y: { label: 'M', unit: 'kN·m' }, series: [{ id: 'M', label: 'M', formula: 'P / 2 * x - P * mac(x - L / 2, 1)' }] }],
    annotations: [{ id: 'P', kind: 'force', label: 'P', magnitude: 'P', unit: 'kN', anchor: { part: 'beam', at: '+y' } }],
    parts: [
      { id: 'left', name: 'Pin support', shapes: [{ kind: 'box', sx: 0.05, sy: 0.05, sz: 0.05 }], position: [-0.2, 0, 0] },
      { id: 'beam', name: 'Beam', mount: { kind: 'against', target: 'left', face: '+y', shift: [0.2, 0, 0] }, shapes: [{ kind: 'box', sx: 0.45, sy: 0.03, sz: 0.03 }] },
      { id: 'right', name: 'Roller support', mount: { kind: 'against', target: 'beam', face: '-y', shift: [0.2, 0, 0] }, shapes: [{ kind: 'box', sx: 0.05, sy: 0.05, sz: 0.05 }] },
    ],
  },
}

describe('scoring a build', () => {
  it('gives a good beam full marks', () => {
    const { score, checks } = scoreBuild(beamCase, good, 55)
    expect(checks.filter((c) => !c.ok)).toEqual([])
    expect(score).toBe(100)
  })

  it('accepts the right answer in other units', () => {
    const inNm = structuredClone(good)
    inNm.spec.calculations[0] = { ...inNm.spec.calculations[0], formula: 'P * 1000 * L / 4', unit: 'N·m' }
    expect(scoreBuild(beamCase, inNm, 55).checks.find((c) => c.name === 'right answer')!.ok).toBe(true)
  })

  it('names what went wrong: a wrong answer, a test rig, loose arrows, a dropped shape, a slow build', () => {
    const bad = structuredClone(good) as typeof good & { spec: { parts: unknown[] } }
    bad.spec.calculations[0] = { ...bad.spec.calculations[0], formula: 'P * L / 8' }
    bad.spec.annotations[0] = { ...bad.spec.annotations[0], anchor: undefined as never, from: [0, 0.2, 0] } as never
    ;(bad.spec.parts as unknown[]).push({ id: 'dial', name: 'Deflection dial indicator', mount: { kind: 'against', target: 'beam', face: '-y' }, shapes: [{ kind: 'cylinder', r: 0.02, h: 0.02 }, { kind: 'dial' }] })
    const { score, checks } = scoreBuild(beamCase, bad, 150)
    const failed = Object.fromEntries(checks.filter((c) => !c.ok).map((c) => [c.name, c.detail]))
    expect(Object.keys(failed).sort()).toEqual(['every shape drawable', 'loads as attached arrows', 'no test rig', 'right answer', 'under two minutes'].sort())
    expect(failed['right answer']).toMatch(/expected 10/)
    expect(failed['no test rig']).toMatch(/dial indicator/i)
    expect(score).toBeLessThan(60)
  })

  it('scores an unusable answer zero', () => {
    expect(scoreBuild(beamCase, { explanation: 'oops' }, 10).score).toBe(0)
  })

  it('has 36 cases with unique ids', () => {
    expect(EVAL_CASES).toHaveLength(36)
    expect(new Set(EVAL_CASES.map((c) => c.id)).size).toBe(36)
  })
})

describe('nightly drafting topics', () => {
  it('works through the whole list in turn, a few a night, without repeats', async () => {
    const { DRAFT_TOPICS, topicsFor } = await import('./topics')
    expect(new Set(DRAFT_TOPICS.map((t) => t.prompt)).size).toBe(DRAFT_TOPICS.length)
    const nights = Math.ceil(DRAFT_TOPICS.length / 3)
    const seen = new Set(Array.from({ length: nights }, (_, d) => topicsFor(d, 3).map((t) => t.prompt)).flat())
    expect(seen.size).toBe(DRAFT_TOPICS.length)
    expect(topicsFor(5, 0)).toEqual([])
  })
})

describe('mechanisms and labels', () => {
  const box = (s = 0.05) => [{ kind: 'box', sx: s, sy: s, sz: s }]
  /** the two-stage compressor that scored 100: rods and pistons set by coordinates, the flywheel loose, two labels on one spot */
  const compressor = {
    explanation: 'A compressor.',
    spec: {
      title: 'Two-stage compressor',
      parameters: [{ id: 'P2', label: 'Delivery', value: 1000, min: 500, max: 2000, step: 10, unit: 'kPa' }],
      calculations: [{ id: 'Pi', label: 'Interstage pressure', formula: 'sqrt(101 * P2)', unit: 'kPa' }],
      annotations: [
        { id: 'a', kind: 'force', label: 'Interstage cooling', anchor: { part: 'block', at: '+y' } },
        { id: 'b', kind: 'force', label: 'Suction', anchor: { part: 'block', at: '+y', along: 0.55 } },
      ],
      parts: [
        { id: 'block', name: 'Crankcase', role: 'housing', shapes: box(0.3) },
        { id: 'crank', name: 'Crankshaft', mount: { kind: 'centered', target: 'block' }, shapes: [{ kind: 'cylinder', r: 0.01, h: 0.25, rotation: [0, 0, Math.PI / 2] }] },
        { id: 'fly', name: 'Flywheel', position: [0.2, 0, 0], rotation: [0.6, 0, 0.3], shapes: [{ kind: 'cylinder', r: 0.1, h: 0.02 }] },
        { id: 'rod', name: 'LP connecting rod', position: [0, 0.05, 0], shapes: box(0.02) },
        { id: 'pis', name: 'LP piston', position: [0, 0.12, 0], shapes: [{ kind: 'cylinder', r: 0.04, h: 0.04 }] },
      ],
    },
  }

  it('finds rods, pistons and a flywheel not joined the way they move, and labels on top of each other', () => {
    const { checks } = scoreBuild({ id: 'compressor', prompt: 'A two-stage compressor' }, compressor, 60)
    const failed = Object.fromEntries(checks.filter((c) => !c.ok).map((c) => [c.name, c.detail ?? '']))
    expect(failed['moving parts connected']).toMatch(/LP connecting rod is not linked/)
    expect(failed['moving parts connected']).toMatch(/LP piston does not slide/)
    expect(failed['moving parts connected']).toMatch(/Flywheel is not mounted on its shaft/)
    expect(failed['labels clear']).toMatch(/Interstage cooling.*Suction/)
  })

  it('passes the same machine joined properly, with its labels apart', () => {
    const fixed = structuredClone(compressor)
    const parts = fixed.spec.parts as Record<string, unknown>[]
    Object.assign(parts[2], { mount: { kind: 'coaxial', target: 'crank', at: 1 }, position: undefined, rotation: undefined })
    Object.assign(parts[3], { mount: { kind: 'link', target: 'crank', to: 'pis', throw: 0.03 }, position: undefined })
    Object.assign(parts[4], { mount: { kind: 'slider', target: 'crank', throw: 0.03, rod: 0.1 }, position: undefined })
    ;(fixed.spec.annotations[1].anchor as Record<string, unknown>).at = '-x'
    const { checks } = scoreBuild({ id: 'compressor', prompt: 'A two-stage compressor' }, fixed, 60)
    expect(checks.find((c) => c.name === 'moving parts connected')!.ok).toBe(true)
    expect(checks.find((c) => c.name === 'labels clear')!.ok).toBe(true)
  })
})
