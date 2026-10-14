import { describe, expect, it } from 'vitest'
import { faultsFor } from '@/content/faults'
import type { PartMeta } from '@/parts/registry'
import partIndex from '@/content/partIndex.json'
import { buildQuestions } from './PartExtras'
import { presentStages, TRACTOR_PATH } from './PowerPath'
import { seenIn } from './SeenIn'

const part = (id: string, name: string, role?: string): PartMeta => ({ id, name, parentId: null, role: 'moving', order: 0, info: role ? { role } : undefined })

describe('part extras', () => {
  it('finds faults by name and id', () => {
    expect(faultsFor({ id: 'tractor-clutch-disc', name: 'Clutch disc' })[0].fault).toMatch(/slip/i)
    expect(faultsFor({ id: 'x', name: 'Rear tyre' }).length).toBeGreaterThan(0)
    expect(faultsFor({ id: 'tractor-bonnet', name: 'Bonnet' })).toEqual([])
  })

  it('builds fair questions with one right answer', () => {
    const all = [
      part('a', 'Clutch disc', 'Connects the engine to the gearbox. Friction lining both sides.'),
      part('b', 'Radiator', 'Sheds engine heat to the air.'),
      part('c', 'Flywheel', 'Stores energy between power strokes.'),
      part('d', 'Gearbox', 'Chooses the speed ratio.'),
    ]
    const qs = buildQuestions(all[0], all)
    expect(qs).toHaveLength(2)
    for (const q of qs) {
      expect(q.options[q.answer]).toBeTruthy()
      expect(new Set(q.options).size).toBe(q.options.length)
    }
    expect(qs[0].options[qs[0].answer]).toBe('Connects the engine to the gearbox.')
    // deterministic
    expect(buildQuestions(all[0], all)).toEqual(qs)
    // alone, no fair question
    expect(buildQuestions(all[0], [all[0]])).toEqual([])
  })

  it('follows the power through the parts present', () => {
    const st = presentStages(TRACTOR_PATH, { 'tractor-engine': 1, 'tractor-gearbox': 1, 'tractor-rear-wheel-l': 1 })
    expect(st.map((s) => s.id)).toEqual(['tractor-engine', 'tractor-gearbox', 'tractor-rear-wheel-l'])
  })

  it('lists where a detail scene also appears', () => {
    const hits = seenIn(partIndex as Record<string, string[]>, 'traction/tyre')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.every((h) => h.route !== 'traction/tyre' && h.title)).toBe(true)
  })
})
