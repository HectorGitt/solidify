import { describe, expect, it } from 'vitest'
import { listPrice } from '../src/prices.js'

describe('list prices', () => {
  it('gives Gemini 3.8 Flash its introductory price this year and the standard price from 2027', () => {
    expect(listPrice('gemini-3.8-flash', Date.UTC(2026, 10, 6))).toEqual({ inputPerM: 0.75, outputPerM: 3.75 })
    expect(listPrice('gemini-3.8-flash', Date.UTC(2026, 11, 31, 23))).toEqual({ inputPerM: 0.75, outputPerM: 3.75 })
    expect(listPrice('gemini-3.8-flash', Date.UTC(2027, 0, 1))).toEqual({ inputPerM: 1.5, outputPerM: 7.5 })
  })

  it('knows no price for a model it has not been told about', () => {
    expect(listPrice('some-other-model', Date.now())).toBeUndefined()
  })
})
