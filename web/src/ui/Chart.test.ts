import { describe, expect, it } from 'vitest'
import { seriesInk } from './Chart'

describe('seriesInk', () => {
  it('leaves colours alone in dark mode', () => expect(seriesInk('#9bd17a', false)).toBe('#9bd17a'))
  it('darkens brights 40 % in light mode', () => expect(seriesInk('#9bd17a', true)).toBe('rgb(93, 125, 73)'))
  it('turns a near-white line into ink', () => expect(seriesInk('#ece9e1', true)).toBe('#0e120c'))
  it('passes through non-hex colours', () => expect(seriesInk('var(--color-accent)', true)).toBe('var(--color-accent)'))
})
