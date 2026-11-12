import { beforeEach, describe, expect, it } from 'vitest'
import { useView } from './view'

const PRESETS = [
  { id: 'front', label: 'Front', planes: [{ normal: [0, 0, 1] as [number, number, number], pos: 0 }] },
  { id: 'plan', label: 'Plan', planes: [{ normal: [0, 1, 0] as [number, number, number], pos: 0 }] },
  { id: 'all', label: 'Gears too', planes: [{ normal: [0, 1, 0] as [number, number, number], pos: 0 }], sectionMoving: true },
]

describe('cut presets and moving parts', () => {
  beforeEach(() => {
    useView.getState().setCut({ sectionMoving: false, enabled: false })
    useView.getState().setPresets(PRESETS)
  })

  it('a preset that sections the gears does not leave them cut for the next preset', () => {
    const v = useView.getState()
    v.applyPreset('all')
    expect(useView.getState().cut.sectionMoving).toBe(true)
    v.setCut({ enabled: false })
    v.applyPreset('front')
    expect(useView.getState().cut.sectionMoving).toBe(false)
    v.applyPreset('plan')
    expect(useView.getState().cut.sectionMoving).toBe(false)
  })

  it('a student who ticks "section moving parts" keeps it across presets', () => {
    const v = useView.getState()
    v.setCut({ sectionMoving: true })
    v.applyPreset('front')
    expect(useView.getState().cut.sectionMoving).toBe(true)
    v.applyPreset('plan')
    expect(useView.getState().cut.sectionMoving).toBe(true)
  })
})
