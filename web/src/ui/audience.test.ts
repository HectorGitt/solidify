import { describe, expect, it } from 'vitest'
import { sectionForAudience } from './audience'

describe('panel sections per audience', () => {
  const pro = (t: string) => sectionForAudience(t, false)
  it('hides exam drills from professionals', () => {
    for (const t of [
      'Exam presets',
      'Exam points',
      'Exam points (L4; Supp; TB Ch 7)',
      'Exam lists (PT p9)',
      'Exam: SANDEL Engineering costs',
      'Exam & worked-example presets',
      'Exam & textbook presets',
      'Marking-scheme tables: second joint at 15°',
    ])
      expect(pro(t).show, t).toBe(false)
  })
  it('keeps general sections and strips exam tags from their titles', () => {
    expect(pro('Presets')).toEqual({ show: true, title: 'Presets' })
    expect(pro('Operating presets').show).toBe(true)
    expect(pro('Examples').show).toBe(true)
    expect(pro('The twelve types (exam list)')).toEqual({ show: true, title: 'The twelve types' })
    expect(pro('Seed drill vs planter (exam)')).toEqual({ show: true, title: 'Seed drill vs planter' })
    expect(pro('Live')).toEqual({ show: true, title: 'Live' })
  })
  it('strips source references from titles for everyone', () => {
    for (const academic of [false, true]) {
      expect(sectionForAudience('Torque calculator (AEE503 M8)', academic).title).toBe('Torque calculator')
      expect(sectionForAudience('Tillage systems (AEE501 BUSH p4–7)', academic).title).toBe('Tillage systems')
      expect(sectionForAudience('Working — capacity (AEE501 2019/20)', academic).title).toBe('Working — capacity')
      expect(sectionForAudience('Line of drive (1/2/4WD)', academic).title).toBe('Line of drive (1/2/4WD)')
    }
    expect(sectionForAudience('Exam points (L4; Supp; TB Ch 7)', true).title).toBe('Exam points')
  })

  it('shows exam sections to academics', () => {
    expect(sectionForAudience('Exam presets', true)).toEqual({ show: true, title: 'Exam presets' })
    expect(sectionForAudience('Seed drill vs planter (exam)', true).title).toBe('Seed drill vs planter (exam)')
  })
})
