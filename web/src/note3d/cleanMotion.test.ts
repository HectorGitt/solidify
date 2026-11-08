import { describe, expect, it } from 'vitest'
import { cleanMotion } from './sanitize'

describe('a part motion from the model', () => {
  it('takes an axis given as a vector or a signed letter', () => {
    expect(cleanMotion({ kind: 'rotate', axis: [0, 1, 0], speed: 'w' })?.axis).toBe('y')
    expect(cleanMotion({ kind: 'rotate', axis: [0, 0, -1], speed: 1 })?.axis).toBe('z')
    expect(cleanMotion({ kind: 'oscillate', axis: '-X', speed: 1, amplitude: 0.2 })).toEqual({ kind: 'oscillate', axis: 'x', speed: 1, amplitude: 0.2 })
  })
  it('drops a motion it cannot use, and fills a missing axis or speed', () => {
    expect(cleanMotion({ kind: 'wobble', axis: 'y', speed: 1 })).toBeUndefined()
    expect(cleanMotion('spin')).toBeUndefined()
    expect(cleanMotion({ kind: 'rotate' })).toEqual({ kind: 'rotate', axis: 'y', speed: 1 })
  })
})
