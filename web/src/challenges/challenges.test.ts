import { beforeEach, describe, expect, it } from 'vitest'
import cvt from '@/modules/powertrain/cvt/challenges'
import { DEFAULTS as CVT_DEFAULTS, useCvt } from '@/modules/powertrain/cvt/model'
import dyno from '@/modules/testing/dynamometers/challenges'
import { DEFAULTS as DYNO_DEFAULTS, useDyno } from '@/modules/testing/dynamometers/model'
import traction from '@/modules/traction/traction-lab/challenges'
import { DEFAULTS as LAB_DEFAULTS, useLab } from '@/modules/traction/traction-lab/model'
import autosteer from '@/modules/precision/autosteer/challenges'
import { DEFAULTS as AS_DEFAULTS, live as asLive, useAutosteer } from '@/modules/precision/autosteer/model'
import { useProgress } from '@/study/progress'
import { isBetter, useChallenge } from './store'
import type { ChallengeDef } from './types'

const passes = (c: ChallengeDef) => c.criteria.every((k) => k.check().pass)
const byId = (list: ChallengeDef[], id: string) => list.find((c) => c.id === id)!

describe('every challenge starts unsolved and has a known solution', () => {
  beforeEach(() => {
    useLab.setState(LAB_DEFAULTS)
    useDyno.setState(DYNO_DEFAULTS)
    useCvt.setState(CVT_DEFAULTS)
    useAutosteer.setState(AS_DEFAULTS)
  })

  it('ballast: 0 kg fails, 500 kg passes', () => {
    const c = byId(traction, 'traction-ballast')
    useLab.setState(c.setup!)
    expect(passes(c)).toBe(false)
    useLab.setState({ ballast: 500 })
    expect(passes(c)).toBe(true)
    // too much rear ballast unloads the front axle
    useLab.setState({ ballast: 1500 })
    expect(passes(c)).toBe(false)
  })

  it('dyno peak: the start load fails, the peak load passes', () => {
    const c = byId(dyno, 'dyno-peak-power')
    useDyno.setState(c.setup!)
    expect(passes(c)).toBe(false)
    useDyno.setState({ load: 0.49 })
    expect(passes(c)).toBe(true)
  })

  it('PTO 540: reachable with the slider steps', () => {
    const c = byId(dyno, 'dyno-pto-540')
    useDyno.setState(c.setup!)
    expect(passes(c)).toBe(false)
    useDyno.setState({ load: 0.625 })
    expect(passes(c)).toBe(true)
  })

  it('CVT: road range at 2100 rpm fails; field range at 1700 rpm passes', () => {
    const c = byId(cvt, 'cvt-efficient-plough')
    useCvt.setState(c.setup!)
    expect(passes(c)).toBe(false)
    useCvt.setState({ range: 'field', rpm: 1700 })
    expect(passes(c)).toBe(true)
    // too low: the engine runs out of power
    useCvt.setState({ rpm: 1300 })
    expect(passes(c)).toBe(false)
  })

  it('auto-steer: judged on a finished pass', () => {
    const c = byId(autosteer, 'autosteer-fast-tight')
    useAutosteer.setState({ ...AS_DEFAULTS, ...c.setup })
    Object.assign(asLive, { lastPassNo: 0, lastRms: NaN, lastPeak: NaN, lastMinSpeed: NaN })
    expect(passes(c)).toBe(false)
    Object.assign(asLive, { lastPassNo: 2, lastRms: 0.011, lastPeak: 0.063, lastMinSpeed: 18 })
    expect(passes(c)).toBe(true)
    Object.assign(asLive, { lastMinSpeed: 10 })
    expect(passes(c)).toBe(false)
  })
})

describe('challenge runtime', () => {
  beforeEach(() => {
    useProgress.getState().reset()
    useLab.setState(LAB_DEFAULTS)
  })

  it('must hold for the set time, then records the win and the best score', () => {
    const c = { ...byId(traction, 'traction-ballast'), moduleId: 'traction', folder: 'traction-lab' }
    useChallenge.getState().start(c, (p) => useLab.setState(p))
    useLab.setState({ ballast: 600 })
    useChallenge.getState().tick(1)
    expect(useChallenge.getState().status).toBe('running')
    useChallenge.getState().tick(1)
    expect(useChallenge.getState().status).toBe('won')
    expect(useProgress.getState().challenges[c.id].best).toBe(600)
    // a better (lower) score replaces it; a worse one does not
    useChallenge.getState().start(c)
    useLab.setState({ ballast: 520 })
    useChallenge.getState().tick(2)
    expect(useProgress.getState().challenges[c.id].best).toBe(520)
    useChallenge.getState().start(c)
    useLab.setState({ ballast: 700 })
    useChallenge.getState().tick(2)
    expect(useProgress.getState().challenges[c.id].best).toBe(520)
  })

  it('a failing tick resets the hold', () => {
    const c = { ...byId(traction, 'traction-ballast'), moduleId: 'traction', folder: 'traction-lab' }
    useChallenge.getState().start(c, (p) => useLab.setState(p))
    useLab.setState({ ballast: 600 })
    useChallenge.getState().tick(1)
    useLab.setState({ ballast: 0 })
    useChallenge.getState().tick(1)
    expect(useChallenge.getState().held).toBe(0)
  })

  it('isBetter respects the direction', () => {
    expect(isBetter(1, 2, 'lower')).toBe(true)
    expect(isBetter(1, 2, 'higher')).toBe(false)
    expect(isBetter(5, null)).toBe(true)
  })
})
