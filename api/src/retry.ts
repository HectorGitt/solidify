/** the model service turned the call away for load (429 rate limit, 503 overloaded): worth waiting and trying again */
export function isBusy(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e)
  const status = (e as { status?: unknown })?.status
  return status === 429 || status === 503 || /\b(429|503)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|overloaded/i.test(msg)
}

/**
 * Runs `call`, and while the model is busy, waits and tries again (by default after 2, 6 and 15 s); any
 * other failure, or still busy after the last wait, is thrown as it is.
 */
export async function retryBusy<T>(call: () => Promise<T>, waits: number[] = [2000, 6000, 15000]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await call()
    } catch (e) {
      if (i >= waits.length || !isBusy(e)) throw e
      await new Promise((r) => setTimeout(r, waits[i]))
    }
  }
}
