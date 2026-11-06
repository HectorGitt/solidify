/** a model's list price, US dollars per million tokens */
export interface ModelPrice {
  inputPerM: number
  outputPerM: number
}

/**
 * Google's published standard prices for the models the API uses (global endpoint), with the date each one
 * starts. Checked 6 November 2026 against cloud.google.com/vertex-ai/generative-ai/pricing. A model not
 * listed has no built-in price: set it on the admin page or with MODEL_PRICE.
 */
const LIST_PRICES: Record<string, { from: string; price: ModelPrice }[]> = {
  'gemini-3.8-flash': [
    { from: '2000-01-01', price: { inputPerM: 0.75, outputPerM: 3.75 } }, // introductory, to 31 December 2026
    { from: '2027-01-01', price: { inputPerM: 1.5, outputPerM: 7.5 } },
  ],
}

/** the list price of `model` on date `t` (ms), or undefined if it is not known */
export function listPrice(model: string, t: number): ModelPrice | undefined {
  const steps = LIST_PRICES[model]
  if (!steps) return undefined
  return [...steps].reverse().find((s) => t >= Date.parse(s.from))?.price
}
